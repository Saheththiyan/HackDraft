import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createCompetition } from "./actions";
import { CreateForm } from "@/components/create-form";

export default async function DashboardPage() {
  const { supabase } = await requireUser();
  const { data: workspace, error } = await supabase.from("workspaces").select("id, name").maybeSingle();
  if (error) throw new Error("Unable to load the team workspace.");
  if (!workspace) return <main className="py-16"><p className="eyebrow">Account connected</p><h1 className="mt-4 text-3xl font-bold">Your workspace is waiting to be provisioned.</h1><p className="mt-4 text-slate-400">Ask the administrator to link this account to the team workspace using the setup guide.</p></main>;
  const { data: competitions, error: listError } = await supabase.from("competitions").select("id, name, description, event_date, created_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false });
  if (listError) throw new Error("Unable to load competitions.");
  return <main className="py-12"><p className="eyebrow">Private team workspace</p><h1 className="mt-3 text-4xl font-bold">{workspace.name}</h1><p className="mt-3 text-slate-400">Keep every solve and screenshot together from the start.</p>
    <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section><h2 className="text-xl font-semibold">Competitions</h2>{competitions?.length ? <div className="mt-5 space-y-3">{competitions.map(item => <Link key={item.id} href={`/dashboard/competitions/${item.id}`} className="panel block p-5 transition hover:border-emerald-500/60"><h3 className="text-lg font-semibold">{item.name}</h3><p className="mt-2 line-clamp-2 text-sm text-slate-400">{item.description || "Open competition workspace"}</p><p className="mt-3 text-xs text-slate-500">{item.event_date ? `Event date: ${item.event_date}` : `Created ${new Date(item.created_at).toLocaleDateString()}`}</p></Link>)}</div> : <div className="panel mt-5 p-8 text-slate-400">No competitions yet. Create your first one to begin capturing challenges.</div>}</section>
      <aside className="panel h-fit p-6"><h2 className="text-xl font-semibold">New competition</h2><p className="mt-2 mb-5 text-sm text-slate-400">Set up a place for your team’s challenge notes.</p><CreateForm action={createCompetition} label="Create competition" nameLabel="Competition name" showDetails /></aside>
    </div>
  </main>;
}
