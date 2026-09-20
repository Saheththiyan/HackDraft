import { z } from "zod";

const schema = z.object({
  url: z.url(),
  key: z.string().min(1).refine((value) => {
    if (value.startsWith("sb_publishable_")) return true;
    try { return JSON.parse(atob(value.split(".")[1].replaceAll("-", "+").replaceAll("_", "/"))).role === "anon"; }
    catch { return false; }
  }),
});
export function supabaseConfig() {
  const result = schema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return result.success ? result.data : null;
}
