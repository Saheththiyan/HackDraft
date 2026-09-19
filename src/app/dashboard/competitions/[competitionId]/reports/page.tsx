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
  return <main className="py-10"><Link href={`/dashboard/competitions/${competitionId}`} className="text-sm text-emerald-400 hover:underline">← {competition.name}</Link><p className="eyebrow mt-8">Report builder</p><h1 className="mt-3 text-4xl font-bold">{competition.name}</h1><p className="mt-3 text-slate-400">Choose reviewed challenges and arrange their order. Creating a report saves a fixed copy of their approved write-ups.</p>
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]"><ReportBuilder competitionId={competitionId} challenges={(challenges ?? []).map(challenge => ({ id: challenge.id, name: challenge.name, category: challenge.category, reviewed: challenge.reviewed_version === challenge.version && Boolean(challenge.latest_revision_id) }))} /><aside className="panel h-fit p-6"><h2 className="text-lg font-semibold">Saved reports</h2>{reports?.length ? <div className="mt-4 space-y-3">{reports.map(report => <Link className="block rounded-lg border border-slate-700 p-3 hover:border-emerald-400" key={report.id} href={`/dashboard/competitions/${competitionId}/reports/${report.id}`}><span className="block font-medium">{report.title}</span><span className="mt-1 block text-xs text-slate-400">{new Date(report.created_at).toLocaleString()}</span></Link>)}</div> : <p className="mt-4 text-sm text-slate-400">No reports saved yet.</p>}</aside></div>
  </main>;
}
