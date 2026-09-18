import { defineConfig } from "@playwright/test";
import { execFileSync } from "node:child_process";

// Local-only integration tests: never point administrative test fixtures at a hosted project.
const status = JSON.parse(execFileSync("node_modules/.bin/supabase", ["status", "--output", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
process.env.E2E_SUPABASE_URL = status.API_URL;
process.env.E2E_SUPABASE_PUBLIC_KEY = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
process.env.E2E_SUPABASE_ADMIN_KEY = status.SERVICE_ROLE_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL)) throw new Error("E2E fixtures require local Supabase.");
export default defineConfig({
  timeout: 60_000, expect: { timeout: 15_000 },
  testDir: "./tests", fullyParallel: false, workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", browserName: "chromium" },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/login", reuseExistingServer: false, timeout: 120_000,
    env: { HACKDRAFT_E2E: "1", NEXT_PUBLIC_SUPABASE_URL: status.API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY ?? status.ANON_KEY },
  },
});
