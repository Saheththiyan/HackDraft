import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/button";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { BrandMark } from "@/components/brand";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="app-shell mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8"><header className="topbar relative z-10 flex flex-wrap items-center justify-between gap-3 py-5"><Link href="/dashboard" className="brand-lockup" aria-label="HackDraft dashboard"><BrandMark /><span className="brand-name"><span>Hack<em>Draft</em></span><small>CTF workspace</small></span></Link><nav aria-label="Main navigation" className="hidden items-center gap-2 md:flex"><Link href="/dashboard" className="nav-pill">Workspace</Link><span className="nav-separator"/><span className="nav-hint">Capture → Draft → Deliver</span></nav><div className="flex items-center gap-2"><ThemeToggle /><form action={signOut}><Button variant="outline">Sign out</Button></form></div></header>{children}</div>;
}
