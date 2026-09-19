import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createChallenge } from "@/app/dashboard/actions";
import { CreateForm } from "@/components/create-form";
import { CompetitionDetails } from "./settings";
import { ChallengeLibrary } from "@/components/challenge-library";

export default async function CompetitionPage({ params }: { params: Promise<{ competitionId: string }> }) {
  const { competitionId } = await params;
  const { supabase } = await requireUser();
  const { data: competition } = await supabase.from("competitions").select("id, name, description, event_date").eq("id", competitionId).maybeSingle();
  if (!competition) notFound();
  const { data: challenges, error } = await supabase.from("challenges").select("id, name, category, points, author_label, updated_at, version, reviewed_version, latest_revision_id").eq("competition_id", competitionId).order("created_at", { ascending: true });
  if (error) throw new Error("Unable to load challenges.");
  const action = createChallenge.bind(null, competitionId);
  const reviewedCount = challenges?.filter(item => item.latest_revision_id && item.reviewed_version === item.version).length ?? 0;
  const total = challenges?.length ?? 0;
  const needsReview = challenges?.filter(item => item.latest_revision_id && item.reviewed_version !== item.version).length ?? 0;
  const captured = total - reviewedCount - needsReview;
  return <main className="py-9"><Link href="/dashboard" className="text-sm text-emerald-400 hover:underline">← All competitions</Link><section className="page-hero mt-6 p-8 sm:p-10 lg:p-12"><p className="hero-label">Competition workspace</p><div className="mt-5 flex flex-wrap items-center justify-between gap-5"><h1 className="hero-title">{competition.name}</h1><Link href={`/dashboard/competitions/${competitionId}/reports`} className="cta-link">Build report →</Link></div><p className="hero-subtitle mt-4 whitespace-pre-wrap">{competition.description || "Collect the evidence, shape each solve, and deliver the final report."}</p><div className="hero-metrics mt-8"><span className="metric-chip"><strong>{challenges?.length ?? 0}</strong> challenges</span><span className="metric-chip"><strong>{reviewedCount}</strong> reviewed</span>{competition.event_date && <span className="metric-chip">Event date <strong>{competition.event_date}</strong></span>}</div></section>
    <section className="readiness-board mt-6" aria-label="Documentation progress"><div className="readiness-intro"><p className="section-kicker">ROAD TO SUBMISSION</p><strong>{total ? `${Math.round(reviewedCount / total * 100)}% reviewed` : "Ready for the first solve"}</strong><div className="readiness-track" role="progressbar" aria-label="Reviewed challenges" aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={reviewedCount}><span style={{ width: `${total ? reviewedCount / total * 100 : 0}%` }} /></div></div><div className="readiness-stage"><span className="stage-marker">01</span><div><strong>{captured}</strong><span>Captured</span></div></div><div className="readiness-stage"><span className="stage-marker">02</span><div><strong>{needsReview}</strong><span>Needs review</span></div></div><div className="readiness-stage" data-ready="true"><span className="stage-marker">03</span><div><strong>{reviewedCount}</strong><span>Report ready</span></div></div></section>
    <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_350px]"><ChallengeLibrary competitionId={competitionId} challenges={challenges ?? []} />
    <aside className="space-y-5"><div className="creation-panel panel p-6 sm:p-7"><div className="creation-heading"><p className="section-kicker">NEXT BREAKTHROUGH</p><span aria-hidden="true">+</span></div><h2 className="section-heading mt-2">Add challenge</h2><p className="mt-2 mb-5 text-sm text-slate-400">Start with a name; fill in notes and screenshots next.</p><CreateForm action={action} label="Add challenge" nameLabel="Challenge name" /></div><CompetitionDetails competition={competition} /></aside></div>
  </main>;
}
