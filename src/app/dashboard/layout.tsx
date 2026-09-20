import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark, BrandWordmark } from "@/components/brand";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="app-shell"><header className="topbar"><Link href="/dashboard" className="brand-lockup" aria-label="HackDraft dashboard"><BrandMark /><BrandWordmark /></Link><div className="topbar-right"><ThemeToggle /><form action={signOut}><Button variant="outline">Sign out</Button></form></div></header>{children}</div>;
}
