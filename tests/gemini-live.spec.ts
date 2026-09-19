import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

test.skip(process.env.RUN_LIVE_GEMINI_TEST !== "1", "Run explicitly with npm run test:ai:live to make a real Gemini request.");

const admin = createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SUPABASE_ADMIN_KEY!, { auth: { persistSession: false } });
const email = `gemini-live-${randomUUID()}@example.test`;
const password = randomUUID();
let userId: string;

test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
  const { error: workspaceError } = await admin.from("workspaces").insert({ owner_id: userId, name: "Gemini smoke team" });
  if (workspaceError) throw workspaceError;
});

test.afterAll(async () => {
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
});

test("saved solve notes become an editable Gemini draft", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/login");
  await page.getByLabel("Team email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Open team workspace" }).click();
  await page.getByLabel("Competition name").fill("Gemini smoke CTF");
  await page.getByRole("button", { name: "Create competition" }).click();
  await expect(page).toHaveURL(/\/dashboard\/competitions\/[0-9a-f-]+$/);
  await page.getByLabel("Challenge name").fill("Metadata note");
  await page.getByRole("button", { name: "Add challenge" }).click();
  await expect(page).toHaveURL(/\/challenges\/[0-9a-f-]+$/);
  const challengeId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByLabel("Challenge prompt or description").fill("Find the hidden flag in the image metadata.");
  await page.getByLabel("How we solved it").fill("We ran exiftool on the supplied PNG image. Its Comment field contained the flag. We copied the flag from that field and submitted it successfully. No other exploit or tool was used.");
  await page.getByLabel("Commands, code, and output").fill("exiftool challenge.png\nComment : CTF{gemini-smoke}");
  await page.getByLabel("Flag (optional)").fill("CTF{gemini-smoke}");
  await page.getByRole("button", { name: /Generate \/ review write-up/ }).click();
  await expect(page).toHaveURL(/\/writeup$/);
  await page.getByRole("button", { name: "Generate from solve notes" }).click();
  await expect.poll(async () => {
    if (await page.getByText("Generated draft ready to review").isVisible()) return "draft";
    const alert = page.locator("main p[role='alert']");
    return await alert.count() ? await alert.innerText() : "waiting";
  }, { timeout: 70_000 }).not.toBe("waiting");
  const alert = page.locator("main p[role='alert']");
  if (await alert.count()) throw new Error(`Generation failed: ${await alert.innerText()}`);
  await expect(page.getByText("Generated draft ready to review")).toBeVisible();
  page.on("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Use this draft" }).click();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("status")).toContainText("Draft saved", { timeout: 20_000 });
  await page.getByRole("navigation", { name: "Write-up sections" }).getByRole("button", { name: /Solution steps/ }).click();
  await expect(page.getByLabel("Solution steps content")).not.toHaveValue("");
  await page.getByRole("navigation", { name: "Write-up sections" }).getByRole("button", { name: /Flag recovery and result/ }).click();
  await expect(page.getByLabel("Flag recovery and result content")).toContainText("CTF{gemini-smoke}");
  const { data: challenge, error } = await admin.from("challenges").select("latest_revision_id").eq("id", challengeId).single();
  expect(error).toBeNull();
  expect(challenge?.latest_revision_id).toBeTruthy();
});
