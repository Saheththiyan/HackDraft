import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ChallengeEditor } from "./editor";

export default async function ChallengePage({ params }: { params: Promise<{ competitionId: string; challengeId: string }> }) {
  const { competitionId, challengeId } = await params;
  const { supabase } = await requireUser();
  const { data: competition } = await supabase.from("competitions").select("id, name").eq("id", competitionId).maybeSingle();
  if (!competition) notFound();
  const { data: challenge } = await supabase.from("challenges").select("id, competition_id, workspace_id, name, category, points, author_label, description, source_notes, commands, flag, version").eq("id", challengeId).eq("competition_id", competitionId).maybeSingle();
  if (!challenge) notFound();
  const { data: evidence, error } = await supabase.from("evidence").select("id, storage_path, caption, position").eq("challenge_id", challengeId).order("position");
  if (error) throw new Error("Unable to load screenshots.");
  return <main className="py-10"><Link href={`/dashboard/competitions/${competitionId}`} className="text-sm text-emerald-400 hover:underline">← {competition.name}</Link><div className="mt-8 flex items-center justify-between gap-3"><p className="eyebrow">Challenge capture</p><Link href={`/dashboard/competitions/${competitionId}/challenges/${challengeId}/writeup`} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300">Edit write-up →</Link></div><ChallengeEditor challenge={{ ...challenge, category: challenge.category ?? "", author_label: challenge.author_label ?? "", evidence: evidence ?? [] }} /></main>;
}
