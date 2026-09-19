import { redirect } from "next/navigation";
import { supabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./form";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark, BrandLockupImage } from "@/components/brand";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!supabaseConfig()) redirect("/setup");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/dashboard");
  return <main className="auth-shell mx-auto grid max-w-7xl items-stretch gap-8 px-4 py-4 sm:px-6 lg:min-h-screen lg:grid-cols-[1.1fr_.9fr] lg:gap-12 lg:px-8 lg:py-8">
    <section className="auth-art flex min-h-[320px] flex-col justify-between p-8 sm:p-12 lg:min-h-[calc(100vh-4rem)]"><div className="relative z-10"><BrandLockupImage className="auth-logo" /><h1 className="mt-10 max-w-xl text-4xl font-bold leading-[1.12] tracking-[-.06em] sm:text-5xl lg:mt-24 lg:text-6xl">From first clue to final report.</h1><p className="mt-6 max-w-md text-sm leading-7 text-[#bdd6d1]">A focused place to capture the solve, shape a write-up, and deliver documentation your whole team can stand behind.</p></div><div className="relative z-10 mt-16 max-w-md"><p className="mb-3 font-mono text-xs uppercase tracking-widest text-[#81e2c0]">The workflow</p><div className="auth-step"><strong>01</strong> Capture notes and evidence</div><div className="auth-step"><strong>02</strong> Generate and review the write-up</div><div className="auth-step"><strong>03</strong> Export the final report</div></div></section>
    <section className="flex flex-col justify-center pb-10 lg:pb-0"><div className="mb-10 flex items-center justify-between"><span className="brand-lockup"><BrandMark /><span className="brand-name"><span>Hack<em>Draft</em></span><small>Private team access</small></span></span><ThemeToggle /></div><div className="mx-auto w-full max-w-md"><p className="eyebrow">Welcome back</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Open your workspace</h2><p className="mt-3 mb-8 text-sm leading-7 text-slate-400">Sign in with your shared team account to continue documenting the competition.</p><div className="panel p-6 sm:p-8"><LoginForm /></div><p className="mt-5 text-sm text-slate-500">Need access? Ask your team for the shared credentials.</p></div></section>
  </main>;
}
