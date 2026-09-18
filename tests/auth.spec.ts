import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
const admin = createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SUPABASE_ADMIN_KEY!, { auth: { persistSession: false } });
const email = `team-${randomUUID()}@example.test`;
const password = randomUUID();
let userId: string;
test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
  const { error: workspaceError } = await admin.from("workspaces").insert({ owner_id: userId, name: "Integration team" });
  if (workspaceError) throw workspaceError;
});
test.afterAll(async () => {
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
});
test("private routes redirect, credentials are validated, and sign out removes access", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Team email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Open team workspace" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Unable to sign in" })).toContainText("Unable to sign in");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Open team workspace" }).click();
  await expect(page.getByRole("heading", { name: "Integration team" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Integration team" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
test("an account without a provisioned workspace cannot see team content", async ({ page }) => {
  const otherEmail = `other-${randomUUID()}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email: otherEmail, password, email_confirm: true });
  if (error) throw error;
  try {
    await page.goto("/login");
    await page.getByLabel("Team email").fill(otherEmail);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Open team workspace" }).click();
    await expect(page.getByRole("heading", { name: "Your workspace is waiting to be provisioned." })).toBeVisible();
    await expect(page.getByText("Integration team")).toHaveCount(0);
  } finally {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(data.user.id);
    if (cleanupError) throw cleanupError;
  }
});
test("storage API permits owner operations and denies anonymous or unrelated downloads", async () => {
  const owner = createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SUPABASE_PUBLIC_KEY!, { auth: { persistSession: false } });
  const anonymous = createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SUPABASE_PUBLIC_KEY!, { auth: { persistSession: false } });
  const { error: loginError } = await owner.auth.signInWithPassword({ email, password });
  if (loginError) throw loginError;
  const { data: workspace, error: workspaceError } = await owner.from("workspaces").select("id").single();
  if (workspaceError) throw workspaceError;
  const path = `${workspace.id}/${randomUUID()}.png`;
  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
  const { error: uploadError } = await owner.storage.from("evidence").upload(path, image, { contentType: "image/png" });
  expect(uploadError).toBeNull();
  try {
    expect((await owner.storage.from("evidence").download(path)).error).toBeNull();
    expect((await anonymous.storage.from("evidence").download(path)).error).not.toBeNull();
    const { error: updateError } = await owner.storage.from("evidence").update(path, image, { contentType: "image/png" });
    expect(updateError).toBeNull();
    const { data, error } = await admin.auth.admin.createUser({ email: `storage-${randomUUID()}@example.test`, password, email_confirm: true });
    if (error) throw error;
    try {
      const other = createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SUPABASE_PUBLIC_KEY!, { auth: { persistSession: false } });
      const { error: otherLoginError } = await other.auth.signInWithPassword({ email: data.user.email!, password });
      if (otherLoginError) throw otherLoginError;
      expect((await other.storage.from("evidence").download(path)).error).not.toBeNull();
    } finally { await admin.auth.admin.deleteUser(data.user.id); }
  } finally {
    const { error } = await owner.storage.from("evidence").remove([path]);
    expect(error).toBeNull();
  }
});
test("public signup is disabled", async () => {
  const client = createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SUPABASE_PUBLIC_KEY!, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signUp({ email: `blocked-${randomUUID()}@example.test`, password });
  // Cleanup even if this assertion exposes an accidentally enabled signup setting.
  if (data.user) await admin.auth.admin.deleteUser(data.user.id);
  expect(error).not.toBeNull();
  expect(error?.message).toMatch(/signup.*not allowed|signup.*disabled/i);
});
