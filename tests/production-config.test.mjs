import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function check(overrides = {}) {
  return spawnSync(process.execPath, ["scripts/check-production.mjs"], {
    encoding: "utf8",
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test", GEMINI_API_KEY: "test-secret-never-print", GEMINI_MODEL: "gemini-3.6-flash", HACKDRAFT_E2E: "", ...overrides },
  });
}
test("hosted public configuration passes without printing credentials", () => {
  const result = check();
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout + result.stderr, /test-secret-never-print|sb_publishable_test/);
});
test("local URLs and secret/service-role/public AI keys fail preflight", () => {
  const serviceRole = `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
  for (const overrides of [
    { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" },
    { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_private" },
    { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: serviceRole },
    { NEXT_PUBLIC_GEMINI_API_KEY: "private" },
    { GEMINI_API_KEY: "" },
    { HACKDRAFT_E2E: "1" },
  ]) assert.equal(check(overrides).status, 1);
});
