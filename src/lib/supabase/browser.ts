"use client";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "@/lib/env";

export function createBrowserSupabase() {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase is not configured.");
  return createBrowserClient(config.url, config.key);
}
