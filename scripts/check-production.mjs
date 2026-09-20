// Reads local configuration without printing credentials or contacting services.
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const errors = [];
try {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (url.protocol !== "https:" || /^(localhost|127\.|\[?::1)/.test(url.hostname) || url.username || url.password) errors.push("Use the HTTPS URL of your hosted Supabase project.");
} catch { errors.push("Set NEXT_PUBLIC_SUPABASE_URL to your hosted Supabase project URL."); }
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
let publicKey = key.startsWith("sb_publishable_");
if (!publicKey) {
  try { publicKey = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "anon"; } catch { /* invalid key */ }
}
if (!publicKey) errors.push("Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to a publishable/anon key, never a secret/service-role key.");
if (!process.env.GEMINI_API_KEY?.trim()) errors.push("Set GEMINI_API_KEY on the server to enable production drafting.");
if (!/^[a-zA-Z0-9._-]+$/.test(process.env.GEMINI_MODEL || "gemini-3.6-flash")) errors.push("GEMINI_MODEL must be a model ID.");
for (const name of Object.keys(process.env)) {
  if (name.startsWith("NEXT_PUBLIC_") && /GEMINI|SERVICE_ROLE|SECRET/.test(name)) errors.push(`Remove the public credential variable ${name}.`);
}
if (process.env.HACKDRAFT_E2E) errors.push("Unset HACKDRAFT_E2E for deployment.");
if (errors.length) {
  errors.forEach(error => console.error(`FAIL: ${error}`));
  process.exitCode = 1;
} else console.log("Production environment checks passed. Verify migrations, Auth settings, storage backups, and the hosted smoke test in docs/PRODUCTION.md.");
