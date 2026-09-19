import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createCompetition } from "./actions";
import { CreateForm } from "@/components/create-form";

export default async function DashboardPage() {
  const { supabase } = await requireUser();
  const { data: workspace, error } = await supabase.from("workspaces").select("id, name").maybeSingle();
  if (error) throw new Error("Unable to load the team workspace.");
  if (!workspace) return <main className="py-12"><section className="page-hero p-8 sm:p-12"><p className="hero-label">Account connected</p><h1 className="hero-title mt-5">Your workspace is waiting to be provisioned.</h1><p className="hero-subtitle mt-5">Ask the administrator to link this account to the team workspace using the setup guide.</p></section></main>;
  const { data: competitions, error: listError } = await supabase.from("competitions").select("id, name, description, event_date, created_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false });
  if (listError) throw new Error("Unable to load competitions.");
  return <main className="py-9"><section className="page-hero p-8 sm:p-10 lg:p-12"><p className="hero-label">Private team workspace</p><h1 className="hero-title mt-5">{workspace.name}</h1><p className="hero-subtitle mt-4">A home for every clue, command, screenshot, and final write-up. Pick up where your team left off.</p><div className="hero-metrics mt-8"><span className="metric-chip"><strong>{competitions?.length ?? 0}</strong> competitions</span><span className="metric-chip"><strong>01 → 03</strong> Capture · Draft · Deliver</span></div></section>
    <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_350px]">
      <section><div className="flex items-end justify-between"><div><p className="section-kicker">YOUR EVENTS / 01</p><h2 className="section-heading mt-2">Competitions</h2></div><span className="text-xs text-slate-500">Most recent first</span></div>{competitions?.length ? <div className="mt-5 space-y-3">{competitions.map((item, index) => <Link key={item.id} href={`/dashboard/competitions/${item.id}`} className="item-card"><span className="item-index">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1"><span className="block truncate text-base font-bold">{item.name}</span><span className="mt-1 block line-clamp-2 text-sm text-slate-400">{item.description || "Open competition workspace"}</span><span className="mt-3 block text-xs text-slate-500">{item.event_date ? `Event date: ${item.event_date}` : `Created ${new Date(item.created_at).toLocaleDateString()}`}</span></span><span className="item-arrow" aria-hidden="true">↗</span></Link>)}</div> : <div className="panel mt-5 p-8 text-slate-400">No competitions yet. Create your first one to begin capturing challenges.</div>}</section>
      <aside className="panel h-fit p-6 sm:p-7"><p className="section-kicker">START SOMETHING / 02</p><h2 className="section-heading mt-2">New competition</h2><p className="mt-2 mb-6 text-sm leading-6 text-slate-400">Set up a place for your team’s challenge notes and evidence.</p><CreateForm action={createCompetition} label="Create competition" nameLabel="Competition name" showDetails /></aside>
    </div>
  </main>;
}
