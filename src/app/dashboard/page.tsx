import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createCompetition } from "./actions";
import { CreateForm } from "@/components/create-form";
import { SolveDiagram } from "@/components/solve-diagram";

export default async function DashboardPage() {
  const { supabase } = await requireUser();
  const { data: workspace, error } = await supabase.from("workspaces").select("id, name").maybeSingle();
  if (error) throw new Error("Unable to load the team workspace.");
  if (!workspace) return <main className="py-12"><section className="page-hero p-8 sm:p-12"><p className="hero-label">Account connected</p><h1 className="hero-title mt-5">Your workspace is waiting to be provisioned.</h1><p className="hero-subtitle mt-5">Ask the administrator to link this account to the team workspace using the setup guide.</p></section></main>;
  const { data: competitions, error: listError } = await supabase.from("competitions").select("id, name, description, event_date, created_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false });
  if (listError) throw new Error("Unable to load competitions.");
  return <main className="py-9"><section className="workspace-intro"><div className="workspace-copy"><p className="hero-label">Your team’s solve notebook</p><h1 className="hero-title mt-5">{workspace.name}</h1><p className="workspace-manifesto">Great solves deserve<br /><em>great stories.</em></p><p className="hero-subtitle mt-4">Keep the clues. Capture the breakthrough. Turn what your team figured out into a report worth submitting.</p><div className="mt-7 flex flex-wrap gap-3"><a href="#new-competition" className="cta-link">Start a competition <span aria-hidden="true">↗</span></a><span className="workspace-count"><strong>{competitions?.length ?? 0}</strong> competitions in your notebook</span></div></div><SolveDiagram /></section>
    <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_350px]">
      <section><div className="flex items-end justify-between gap-3"><div><p className="section-kicker">THE COLLECTION</p><h2 className="section-heading mt-2">Competitions</h2></div><span className="text-xs text-slate-500">Most recent first</span></div>{competitions?.length ? <div className="competition-grid mt-5">{competitions.map((item, index) => <Link key={item.id} href={`/dashboard/competitions/${item.id}`} className="competition-card"><span className="competition-card-top"><span className="section-kicker">CASE / {String(index + 1).padStart(2, "0")}</span><span className="item-arrow" aria-hidden="true">↗</span></span><span className="competition-card-title">{item.name}</span><span className="line-clamp-2 text-sm text-slate-400">{item.description || "A new collection of clues, solves, and write-ups."}</span><span className="competition-card-footer"><span>{item.event_date ? item.event_date : `Created ${new Date(item.created_at).toLocaleDateString()}`}</span><span>Open notebook →</span></span></Link>)}</div> : <div className="library-empty mt-5"><span aria-hidden="true">{ "{ }" }</span><h3>An empty notebook. Endless possibilities.</h3><p>Create your first competition to give every solve a place to land.</p></div>}</section>
      <aside id="new-competition" className="creation-panel panel h-fit p-6 sm:p-7"><div className="creation-heading"><p className="section-kicker">A FRESH PAGE</p><span aria-hidden="true">+</span></div><h2 className="section-heading mt-2">New competition</h2><p className="mt-2 mb-6 text-sm leading-6 text-slate-400">Set up a place for your team’s challenge notes and evidence.</p><CreateForm action={createCompetition} label="Create competition" nameLabel="Competition name" showDetails /></aside>
    </div>
  </main>;
}
