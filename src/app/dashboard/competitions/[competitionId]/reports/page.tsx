import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ReportBuilder } from "./report-builder";

export default async function ReportsPage({ params }: { params: Promise<{ competitionId: string }> }) {
  const { competitionId } = await params;
  const { supabase } = await requireUser();
  const { data: competition } = await supabase.from("competitions").select("id, name").eq("id", competitionId).maybeSingle();
  if (!competition) notFound();
  const [{ data: challenges, error: challengeError }, { data: reports, error: reportError }] = await Promise.all([
    supabase.from("challenges").select("id, name, category, version, reviewed_version, latest_revision_id, created_at").eq("competition_id", competitionId).order("created_at"),
    supabase.from("report_snapshots").select("id, title, created_at").eq("competition_id", competitionId).order("created_at", { ascending: false }),
  ]);
  if (challengeError || reportError) throw new Error("Unable to load report data.");
  const reviewed = (challenges ?? []).filter(item => item.reviewed_version === item.version && Boolean(item.latest_revision_id)).length;
  return <main><nav className="crumbs mt-6" aria-label="Breadcrumb"><Link href="/dashboard">Competitions</Link><span aria-hidden="true">/</span><Link href={`/dashboard/competitions/${competitionId}`}>{competition.name}</Link><span aria-hidden="true">/</span><span>Reports</span></nav>
    <section className="page-head"><div className="page-head-copy"><p className="page-context">Report builder</p><h1 className="page-title">{competition.name}</h1><p className="page-lede">Choose reviewed challenges and set their order. Saving a report keeps a fixed copy of the approved write-ups and their screenshots.</p><p className="page-facts"><span><strong>{reviewed}</strong> reviewed {reviewed === 1 ? "challenge" : "challenges"}</span><span><strong>{reports?.length ?? 0}</strong> saved {reports?.length === 1 ? "report" : "reports"}</span></p></div></section>
    <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]"><ReportBuilder competitionId={competitionId} challenges={(challenges ?? []).map(challenge => ({ id: challenge.id, name: challenge.name, category: challenge.category, reviewed: challenge.reviewed_version === challenge.version && Boolean(challenge.latest_revision_id) }))} /><aside className="panel h-fit p-6"><h2 className="panel-heading">Saved reports</h2>{reports?.length ? <div className="mt-4 space-y-2">{reports.map(report => <Link className="subpanel block p-3 hover:border-[var(--ink)]" key={report.id} href={`/dashboard/competitions/${competitionId}/reports/${report.id}`}><span className="block font-medium">{report.title}</span><span className="mt-1 block t-xs t-muted">{new Date(report.created_at).toLocaleString()}</span></Link>)}</div> : <p className="mt-3 t-small t-muted">No reports saved yet.</p>}</aside></div>
  </main>;
}
