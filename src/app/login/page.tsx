import { redirect } from "next/navigation";
import { supabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./form";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark, BrandWordmark } from "@/components/brand";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!supabaseConfig()) redirect("/setup");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/dashboard");
  return <main className="auth-shell">
    <section className="auth-art brand-hero" aria-label="About HackDraft">
      <div><span className="auth-brand"><BrandMark size={36} /><BrandWordmark tagline="CTF documentation workspace" /></span><p className="auth-headline mt-12 lg:mt-20">Every solve, written up the way you would present it.</p><p className="auth-lede">Capture notes, commands, and screenshots as you go. Draft the write-up from what you recorded, review it, and export the finished report.</p></div>
      <div className="specimen" aria-hidden="true">
        <div className="specimen-head"><span>Midnight CTF 2026</span><span>Challenge 4 of 12</span></div>
        <h2>Hidden in Plain Sight</h2>
        <p>Forensics · 250 points</p>
        <h3>Solution steps</h3>
        <p>The image metadata held a base64 comment. Decoding it revealed the flag directly.</p>
        <pre>$ exiftool evidence.png | grep Comment{"\n"}Comment: Q1RGe20zdGFkYXRhX20xbmR9</pre>
        <div className="specimen-figure"><span /><span /></div>
        <h3>Flag recovery and result</h3>
        <p>Recovered flag: <span className="flag-chip">CTF{"{"}m3tadata_m1nd{"}"}</span></p>
        <div className="specimen-foot"><span>Reviewed write-up</span><span>Page 9</span></div>
      </div>
    </section>
    <section className="auth-form-side"><div className="auth-form-top"><ThemeToggle /></div><div className="auth-form-body"><h1>Sign in</h1><p>Use the shared team account to open the workspace.</p><div className="mt-8"><LoginForm /></div><p className="mt-6 t-small t-faint">Need access? Ask your team for the shared credentials.</p></div></section>
  </main>;
}
