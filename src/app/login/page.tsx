import { redirect } from "next/navigation";
import { supabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!supabaseConfig()) redirect("/setup");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/dashboard");
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
    <p className="eyebrow">HackDraft / Team access</p><h1 className="mt-4 text-4xl font-bold">Every solve deserves a clear story.</h1>
    <p className="mt-4 mb-8 text-slate-400">Sign in with your shared team account to access your competition workspace.</p>
    <section className="panel p-6"><LoginForm /></section>
    <p className="mt-5 text-sm text-slate-500">Need access? Ask your team for the shared credentials.</p>
  </main>;
}
