import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark, BrandWordmark } from "@/components/brand";
export default function SetupPage() {
  return <main className="app-shell"><header className="topbar"><span className="brand-lockup"><BrandMark /><BrandWordmark /></span><ThemeToggle /></header><section className="page-head"><div className="page-head-copy"><p className="page-context">Workspace setup</p><h1 className="page-title">Connect your team workspace.</h1><p className="page-lede">An administrator needs to finish setup before the team can sign in.</p></div></section><ol className="setup-steps mt-6"><li>Apply the Supabase migrations.</li><li>Disable public signup and provision the shared team account.</li><li>Set the Supabase URL and publishable key in the app environment.</li><li>Restart the app and open the sign-in page.</li></ol><p className="mt-6 t-small t-muted">See README.md for local and hosted setup instructions.</p></main>;
}
