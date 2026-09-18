import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/button";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="mx-auto max-w-6xl px-6 py-8"><header className="flex items-center justify-between border-b border-slate-800 pb-6"><span className="text-xl font-bold">Hack<span className="text-emerald-400">Draft</span></span><form action={signOut}><Button variant="outline">Sign out</Button></form></header>{children}</div>;
}
