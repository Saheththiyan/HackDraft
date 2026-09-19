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
  return <main className="py-10"><Link href="/dashboard" className="text-sm text-emerald-400 hover:underline">← All competitions</Link><p className="eyebrow mt-8">Competition workspace</p><div className="mt-3 flex flex-wrap items-center justify-between gap-4"><h1 className="text-4xl font-bold">{competition.name}</h1><Link href={`/dashboard/competitions/${competitionId}/reports`} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300">Build report →</Link></div>{competition.description && <p className="mt-3 max-w-2xl whitespace-pre-wrap text-slate-400">{competition.description}</p>}
    <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]"><section><h2 className="text-xl font-semibold">Challenges <span className="text-slate-500">{challenges?.length ?? 0}</span></h2>{challenges?.length ? <div className="mt-5 space-y-3">{challenges.map(item => <Link key={item.id} href={`/dashboard/competitions/${competitionId}/challenges/${item.id}`} className="panel flex items-center justify-between gap-4 p-5 transition hover:border-emerald-500/60"><div><h3 className="font-semibold">{item.name}</h3><p className="mt-1 text-sm text-slate-400">{[item.category, item.author_label].filter(Boolean).join(" · ") || "Add category and author"}</p><p className={`mt-2 text-xs ${item.reviewed_version === item.version ? "text-emerald-300" : "text-amber-300"}`}>{item.reviewed_version === item.version ? "Reviewed" : item.latest_revision_id ? "Needs review" : "Captured"}</p></div><span className="shrink-0 text-xs text-slate-500">{item.points != null ? `${item.points} pts` : "Capture notes →"}</span></Link>)}</div> : <div className="panel mt-5 p-8 text-slate-400">No challenges yet. Add your first solve and capture the details while they’re fresh.</div>}</section>
    <aside className="space-y-5"><div className="panel p-6"><h2 className="text-xl font-semibold">Add challenge</h2><p className="mt-2 mb-5 text-sm text-slate-400">Start with a name; fill in notes and screenshots next.</p><CreateForm action={action} label="Add challenge" nameLabel="Challenge name" /></div><CompetitionDetails competition={competition} /></aside></div>
  </main>;
}
