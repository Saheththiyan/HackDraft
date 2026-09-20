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
  const percent = total ? Math.round(reviewedCount / total * 100) : 0;
  return <main><nav className="crumbs mt-6" aria-label="Breadcrumb"><Link href="/dashboard">Competitions</Link><span aria-hidden="true">/</span><span>{competition.name}</span></nav>
    <section className="page-head"><div className="page-head-copy"><p className="page-context">Competition</p><h1 className="page-title">{competition.name}</h1>{competition.description && <p className="page-lede whitespace-pre-wrap">{competition.description}</p>}{competition.event_date && <p className="page-facts"><span>Event date <strong>{competition.event_date}</strong></span></p>}</div><div className="page-head-actions"><Link href={`/dashboard/competitions/${competitionId}/reports`} className="button button-primary">Build report</Link></div></section>
    <section className="progress-strip mt-6" aria-label="Documentation progress"><div className="progress-summary"><strong>{total ? `${percent}% reviewed` : "No challenges yet"}</strong><span>{total ? `${reviewedCount} of ${total} write-ups approved for the report` : "Add the first challenge to start tracking progress"}</span><div className="progress-track" role="progressbar" aria-label="Reviewed challenges" aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={reviewedCount}><span style={{ width: `${percent}%` }} /></div></div><div className="progress-cell"><strong>{captured}</strong><span>Captured</span></div><div className="progress-cell" data-tone="review"><strong>{needsReview}</strong><span>Needs review</span></div><div className="progress-cell" data-tone="ready"><strong>{reviewedCount}</strong><span>Report ready</span></div></section>
    <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]"><ChallengeLibrary competitionId={competitionId} challenges={challenges ?? []} />
    <aside className="space-y-5"><div className="panel p-6"><h2 className="panel-heading">Add challenge</h2><p className="mt-1 mb-5 t-small t-muted">Start with a name. Notes and screenshots come next.</p><CreateForm action={action} label="Add challenge" nameLabel="Challenge name" /></div><CompetitionDetails competition={competition} /></aside></div>
  </main>;
}
