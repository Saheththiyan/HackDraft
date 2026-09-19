import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { snapshotSchema } from "@/lib/writeup";
import { ReportViewer } from "./report-viewer";

export default async function ReportPage({ params }: { params: Promise<{ competitionId: string; reportId: string }> }) {
  const { competitionId, reportId } = await params;
  const { supabase } = await requireUser();
  const { data: report } = await supabase.from("report_snapshots").select("id, title, content, created_at").eq("id", reportId).eq("competition_id", competitionId).maybeSingle();
  if (!report) notFound();
  const parsed = snapshotSchema.safeParse(report.content);
  if (!parsed.success) throw new Error("This saved report has an invalid content format.");
  return <main className="py-10"><Link href={`/dashboard/competitions/${competitionId}/reports`} className="text-sm text-emerald-400 hover:underline">← Saved reports</Link><ReportViewer reportId={report.id} createdAt={report.created_at} content={parsed.data} /></main>;
}
