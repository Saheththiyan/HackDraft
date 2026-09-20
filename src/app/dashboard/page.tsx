import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createCompetition } from "./actions";
import { CreateForm } from "@/components/create-form";

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

export default async function DashboardPage() {
  const { supabase } = await requireUser();
  const { data: workspace, error } = await supabase.from("workspaces").select("id, name").maybeSingle();
  if (error) throw new Error("Unable to load the team workspace.");
  if (!workspace) return <main><section className="page-head"><div className="page-head-copy"><p className="page-context">Account connected</p><h1 className="page-title">Your workspace is waiting to be provisioned.</h1><p className="page-lede">Ask the administrator to link this account to the team workspace using the setup guide.</p></div></section></main>;
  const { data: competitions, error: listError } = await supabase.from("competitions").select("id, name, description, event_date, created_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false });
  if (listError) throw new Error("Unable to load competitions.");
  const count = competitions?.length ?? 0;
  return <main><section className="page-head"><div className="page-head-copy"><p className="page-context">Team workspace</p><h1 className="page-title">{workspace.name}</h1><p className="page-lede">Each competition holds its challenges, solve notes, and the reports built from them.</p></div><p className="page-facts"><span><strong>{count}</strong> {count === 1 ? "competition" : "competitions"}</span></p></section>
    <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section><div className="section-head"><h2 className="section-heading">Competitions</h2><span className="t-small t-faint">Newest first</span></div>{competitions?.length ? <div className="ledger mt-4">{competitions.map(item => <Link key={item.id} href={`/dashboard/competitions/${item.id}`} className="ledger-row"><span className="ledger-title">{item.name}</span><span className="ledger-date">{item.event_date ? dateFormat.format(new Date(`${item.event_date}T00:00:00`)) : `Added ${dateFormat.format(new Date(item.created_at))}`}</span>{item.description && <span className="ledger-desc line-clamp-2">{item.description}</span>}</Link>)}</div> : <div className="empty mt-4"><h3>No competitions yet</h3><p>Create one to start capturing challenges. Name and date are enough to begin.</p></div>}</section>
      <aside id="new-competition" className="panel h-fit p-6"><h2 className="panel-heading">New competition</h2><p className="mt-1 mb-5 t-small t-muted">A place for this event’s challenges and evidence.</p><CreateForm action={createCompetition} label="Create competition" nameLabel="Competition name" showDetails /></aside>
    </div>
  </main>;
}
