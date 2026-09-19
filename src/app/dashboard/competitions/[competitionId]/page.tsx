import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createChallenge } from "@/app/dashboard/actions";
import { CreateForm } from "@/components/create-form";
import { CompetitionDetails } from "./settings";

export default async function CompetitionPage({ params }: { params: Promise<{ competitionId: string }> }) {
  const { competitionId } = await params;
  const { supabase } = await requireUser();
  const { data: competition } = await supabase.from("competitions").select("id, name, description, event_date").eq("id", competitionId).maybeSingle();
  if (!competition) notFound();
  const { data: challenges, error } = await supabase.from("challenges").select("id, name, category, points, author_label, updated_at, version, reviewed_version, latest_revision_id").eq("competition_id", competitionId).order("created_at", { ascending: true });
  if (error) throw new Error("Unable to load challenges.");
  const action = createChallenge.bind(null, competitionId);
  const reviewedCount = challenges?.filter(item => item.reviewed_version === item.version).length ?? 0;
  return <main className="py-9"><Link href="/dashboard" className="text-sm text-emerald-400 hover:underline">← All competitions</Link><section className="page-hero mt-6 p-8 sm:p-10 lg:p-12"><p className="hero-label">Competition workspace</p><div className="mt-5 flex flex-wrap items-center justify-between gap-5"><h1 className="hero-title">{competition.name}</h1><Link href={`/dashboard/competitions/${competitionId}/reports`} className="cta-link">Build report →</Link></div><p className="hero-subtitle mt-4 whitespace-pre-wrap">{competition.description || "Collect the evidence, shape each solve, and deliver the final report."}</p><div className="hero-metrics mt-8"><span className="metric-chip"><strong>{challenges?.length ?? 0}</strong> challenges</span><span className="metric-chip"><strong>{reviewedCount}</strong> reviewed</span>{competition.event_date && <span className="metric-chip">Event date <strong>{competition.event_date}</strong></span>}</div></section>
    <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_350px]"><section><div className="flex items-end justify-between"><div><p className="section-kicker">SOLVE LIBRARY / 01</p><h2 className="section-heading mt-2">Challenges <span className="text-slate-500">{challenges?.length ?? 0}</span></h2></div></div>{challenges?.length ? <div className="mt-5 space-y-3">{challenges.map((item, index) => { const state = item.reviewed_version === item.version ? "reviewed" : item.latest_revision_id ? "review" : "captured"; return <Link key={item.id} href={`/dashboard/competitions/${competitionId}/challenges/${item.id}`} className="item-card"><span className="item-index">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1"><span className="block truncate font-bold">{item.name}</span><span className="mt-1 block text-sm text-slate-400">{[item.category, item.author_label].filter(Boolean).join(" · ") || "Add category and author"}</span><span className="status-pill mt-3" data-status={state}>{state === "reviewed" ? "Reviewed" : state === "review" ? "Needs review" : "Captured"}</span></span><span className="shrink-0 text-xs text-slate-500">{item.points != null ? `${item.points} pts` : "Open →"}</span></Link>; })}</div> : <div className="panel mt-5 p-8 text-slate-400">No challenges yet. Add your first solve and capture the details while they’re fresh.</div>}</section>
    <aside className="space-y-5"><div className="panel p-6 sm:p-7"><p className="section-kicker">NEW SOLVE / 02</p><h2 className="section-heading mt-2">Add challenge</h2><p className="mt-2 mb-5 text-sm text-slate-400">Start with a name; fill in notes and screenshots next.</p><CreateForm action={action} label="Add challenge" nameLabel="Challenge name" /></div><CompetitionDetails competition={competition} /></aside></div>
  </main>;
}
