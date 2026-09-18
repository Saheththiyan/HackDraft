"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/env";

export type LoginState = { error: string | null };
export async function signIn(_previous: LoginState, form: FormData): Promise<LoginState> {
  if (!supabaseConfig()) return { error: "The team workspace has not been configured yet." };
  const input = z.object({ email: z.email(), password: z.string().min(1).max(1024) }).safeParse({
    email: String(form.get("email") ?? "").trim(), password: form.get("password"),
  });
  if (!input.success) return { error: "Enter a valid email address and password." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(input.data);
    if (error) return { error: "Unable to sign in. Check your team credentials and try again." };
  } catch {
    return { error: "Unable to reach the sign-in service. Try again shortly." };
  }
  redirect("/dashboard");
}
export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("Sign out failed. Please try again.");
  redirect("/login");
}
