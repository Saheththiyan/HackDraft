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
  return <main><nav className="crumbs mt-6" aria-label="Breadcrumb"><Link href="/dashboard">Competitions</Link><span aria-hidden="true">/</span><Link href={`/dashboard/competitions/${competitionId}`}>{competition.name}</Link><span aria-hidden="true">/</span><span>{challenge.name}</span></nav><ChallengeEditor challenge={{ ...challenge, category: challenge.category ?? "", author_label: challenge.author_label ?? "", evidence: evidence ?? [] }} /></main>;
}
