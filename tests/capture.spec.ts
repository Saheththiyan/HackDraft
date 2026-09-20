import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
const admin = createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SUPABASE_ADMIN_KEY!, { auth: { persistSession: false } });
const email = `capture-${randomUUID()}@example.test`;
const password = randomUUID();
let userId: string;
let competitionId: string;
let challengeId: string;
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Team email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Open team workspace" }).click();
  await expect(page.getByRole("heading", { name: "Capture team" })).toBeVisible();
}
// A fresh navigation paints from SSR HTML before React finishes hydrating and
// attaching listeners. Interacting immediately after goto()/reload() (e.g.
// setInputFiles(), fill()) can land in that gap: the native browser event
// fires with nobody listening, and gets lost or interleaved with whatever
// React commits once hydration does catch up (production's fast first paint
// makes this race far more likely to land than in dev). The theme toggle is
// a safe probe for "hydration is live": it flips purely through client
// state with no network round trip, so round-tripping it here can't disturb
// the challenge data or its optimistic-concurrency version.
async function confirmHydrated(page: Page) {
  const toggle = page.getByRole("button", { name: /Switch to (light|dark) mode/ });
  const before = await toggle.getAttribute("aria-label");
  await toggle.click();
  await expect(toggle).not.toHaveAttribute("aria-label", before!);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-label", before!);
}
test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
  const { error: workspaceError } = await admin.from("workspaces").insert({ owner_id: userId, name: "Capture team" });
  if (workspaceError) throw workspaceError;
});
test.afterAll(async () => {
  if (userId) {
    const { data: workspace } = await admin.from("workspaces").select("id").eq("owner_id", userId).single();
    if (workspace) {
      const { data: files } = await admin.storage.from("evidence").list(`${workspace.id}/${challengeId ?? ""}`);
      if (files?.length) await admin.storage.from("evidence").remove(files.map(file => `${workspace.id}/${challengeId}/${file.name}`));
    }
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
});
test("create competition, capture challenge, autosave, screenshots, and ordering", async ({ page }) => {
  page.on("dialog", dialog => dialog.accept());
  await login(page);
  await page.getByLabel("Competition name").fill("Autumn CTF");
  await page.getByLabel("Event date").fill("2026-09-19");
  await page.getByRole("button", { name: "Create competition" }).click();
  await expect(page.getByRole("heading", { name: "Autumn CTF" })).toBeVisible();
  competitionId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByLabel("Challenge name").fill("Hidden in Plain Sight");
  await page.getByRole("button", { name: "Add challenge" }).click();
  await expect(page.getByRole("heading", { name: "Hidden in Plain Sight" })).toBeVisible();
  challengeId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByLabel("Category").fill("Forensics");
  await page.getByLabel("Points").fill("150");
  await page.getByLabel("Author name").fill("Alex");
  await page.getByLabel("Challenge prompt or description").fill("Find the secret in the image.");
  await page.getByLabel("How we solved it").fill("Used strings, then inspected metadata.");
  await page.getByLabel("Commands, code, and output").fill("strings image.png | head");
  await page.getByLabel("Flag (optional)").fill("CTF{example}");
  await expect(page.getByRole("status")).toContainText("Saved", { timeout: 20_000 });
  await page.reload();
  await expect(page.getByLabel("How we solved it")).toHaveValue("Used strings, then inspected metadata.");
  await expect(page.getByLabel("Flag (optional)")).toHaveValue("CTF{example}");
  await confirmHydrated(page);
  await page.route("**/storage/v1/object/evidence/**", route => route.abort());
  await page.getByLabel("Choose screenshots").setInputFiles({ name: "interrupted.png", mimeType: "image/png", buffer: tinyPng });
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add screenshots" })).toBeEnabled();
  await expect(page.getByText("Screenshots 0")).toBeVisible();
  await page.unroute("**/storage/v1/object/evidence/**");
  await page.getByLabel("Choose screenshots").setInputFiles([
    { name: "first.png", mimeType: "image/png", buffer: tinyPng },
    { name: "second.png", mimeType: "image/png", buffer: tinyPng },
  ]);
  await expect(page.getByText("Screenshots 2")).toBeVisible();
  await page.getByLabel("Caption").first().fill("Flag found in metadata");
  await page.getByLabel("Caption").first().blur();
  await expect(page.getByLabel("Caption").first()).toHaveValue("Flag found in metadata");
  await page.getByRole("button", { name: "↓ Down" }).first().click();
  await expect(page.getByLabel("Caption").last()).toHaveValue("Flag found in metadata");
  await page.reload();
  await expect(page.getByLabel("Caption").last()).toHaveValue("Flag found in metadata");
  await page.getByRole("button", { name: "Remove" }).first().click();
  await expect(page.getByText("Screenshots 1")).toBeVisible();
  await page.goto(`/dashboard/competitions/${competitionId}`);
  await expect(page.getByText("Forensics · Alex")).toBeVisible();
});
test("stale editor cannot overwrite another tab's save", async ({ browser }) => {
  const context = await browser.newContext();
  const pageA = await context.newPage();
  await login(pageA);
  const pageB = await context.newPage();
  await pageA.goto(`/dashboard/competitions/${competitionId}/challenges/${challengeId}`);
  await pageB.goto(`/dashboard/competitions/${competitionId}/challenges/${challengeId}`);
  await confirmHydrated(pageA);
  await confirmHydrated(pageB);
  await pageA.getByLabel("How we solved it").fill("First tab's new explanation");
  await expect(pageA.getByRole("status")).toContainText("Saved", { timeout: 20_000 });
  await pageB.getByLabel("How we solved it").fill("Second tab's conflicting explanation");
  await expect(pageB.getByRole("status")).toContainText("Edit conflict", { timeout: 20_000 });
  await pageA.reload();
  await expect(pageA.getByLabel("How we solved it")).toHaveValue("First tab's new explanation");
  await context.close();
});

test("interrupted saves keep the edits and can be retried", async ({ page }) => {
  await login(page);
  await page.goto(`/dashboard/competitions/${competitionId}/challenges/${challengeId}`);
  await confirmHydrated(page);
  await page.route("**/dashboard/**", route => route.request().method() === "POST" ? route.abort() : route.continue());
  await page.getByLabel("How we solved it").fill("These notes must survive a temporary connection failure.");
  await expect(page.getByRole("status")).toContainText("Save failed");
  await expect(page.getByLabel("How we solved it")).toHaveValue("These notes must survive a temporary connection failure.");
  await page.unroute("**/dashboard/**");
  await page.getByRole("button", { name: "Retry or reload" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await page.reload();
  await expect(page.getByLabel("How we solved it")).toHaveValue("These notes must survive a temporary connection failure.");
});
