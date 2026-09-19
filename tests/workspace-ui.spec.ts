import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

test("challenge search and filters work in both themes and on mobile", async ({ page }, testInfo) => {
  const admin = createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SUPABASE_ADMIN_KEY!, { auth: { persistSession: false } });
  const email = `ui-${randomUUID()}@example.test`;
  const password = randomUUID();
  const { data: account, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  try {
    const { data: workspace, error: workspaceError } = await admin.from("workspaces").insert({ owner_id: account.user.id, name: "Cipher Collective" }).select("id").single();
    if (workspaceError) throw workspaceError;
    const { data: competitions, error: competitionError } = await admin.from("competitions").insert([
      { workspace_id: workspace.id, name: "Midnight CTF", description: "A weekend of curious clues, late-night breakthroughs, and flags worth chasing." },
      { workspace_id: workspace.id, name: "Autumn Invitational", description: "Our team's notes from the autumn competition." },
    ]).select("id, name");
    if (competitionError) throw competitionError;
    const competition = competitions.find(item => item.name === "Midnight CTF")!;
    const { error: challengeError } = await admin.from("challenges").insert([
      { workspace_id: workspace.id, competition_id: competition.id, name: "Hidden in Plain Sight", category: "Forensics", author_label: "Alex", points: 150 },
      { workspace_id: workspace.id, competition_id: competition.id, name: "The Last Cookie", category: "Web", author_label: "Sam", points: 300 },
      { workspace_id: workspace.id, competition_id: competition.id, name: "A Beautiful Cipher", category: "Crypto", author_label: "Alex", points: 250 },
    ]);
    if (challengeError) throw challengeError;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/login");
    await page.getByLabel("Team email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Open team workspace" }).click();
    await expect(page.getByRole("heading", { name: "Cipher Collective" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("workspace-light.png"), fullPage: true });
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await page.screenshot({ path: testInfo.outputPath("workspace-dark.png"), fullPage: true });
    await page.getByRole("link", { name: /Midnight CTF/ }).click();
    await expect(page.getByRole("progressbar", { name: "Reviewed challenges" })).toHaveAttribute("aria-valuenow", "0");
    const cards = page.locator(".challenge-card");
    await expect(cards).toHaveCount(3);
    await page.getByLabel("Search challenges").fill("FORENSICS");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Hidden in Plain Sight");
    await page.getByLabel("Search challenges").fill("alex");
    await expect(cards).toHaveCount(2);
    await page.getByRole("button", { name: "Reviewed 0", exact: true }).click();
    await expect(page.getByRole("heading", { name: "No matching solves" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(cards).toHaveCount(3);
    await page.getByRole("button", { name: "Captured 3", exact: true }).click();
    await expect(cards).toHaveCount(3);
    await page.screenshot({ path: testInfo.outputPath("competition-dark.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.waitForTimeout(250);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("competition-mobile-light.png"), fullPage: true });
    await page.getByRole("link", { name: /Hidden in Plain Sight/ }).click();
    await expect(page.getByLabel("How we solved it")).toBeVisible();
  } finally {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(account.user.id);
    if (cleanupError) throw cleanupError;
  }
});
