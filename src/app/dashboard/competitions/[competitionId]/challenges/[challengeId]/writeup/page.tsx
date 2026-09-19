import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { emptySections, sectionsSchema } from "@/lib/writeup";
import { WriteupEditor } from "./writeup-editor";

export default async function WriteupPage({ params }: { params: Promise<{ competitionId: string; challengeId: string }> }) {
  const { competitionId, challengeId } = await params;
  const { supabase } = await requireUser();
  const { data: challenge } = await supabase.from("challenges").select("id, competition_id, name, description, flag, version, latest_revision_id, approved_revision_id, reviewed_version").eq("id", challengeId).eq("competition_id", competitionId).maybeSingle();
  if (!challenge) notFound();
  const [{ data: revision }, { data: evidence, error }] = await Promise.all([
    challenge.latest_revision_id ? supabase.from("writeup_revisions").select("sections").eq("id", challenge.latest_revision_id).single() : Promise.resolve({ data: null }),
    supabase.from("evidence").select("id, caption, storage_path, position").eq("challenge_id", challengeId).order("position"),
  ]);
  if (error) throw new Error("Unable to load screenshots.");
  const parsed = sectionsSchema.safeParse(revision?.sections);
  const sections = parsed.success ? parsed.data : emptySections();
  if (!parsed.success) {
    sections[0].markdown = challenge.description;
    sections[3].markdown = challenge.flag ? `Recovered flag: \`${challenge.flag}\`` : "";
  }
  const images = await Promise.all((evidence ?? []).map(async item => {
    const { data } = await supabase.storage.from("evidence").createSignedUrl(item.storage_path, 3600);
    return { id: item.id, caption: item.caption, url: data?.signedUrl ?? "" };
  }));
  return <main className="py-10"><Link href={`/dashboard/competitions/${competitionId}/challenges/${challengeId}`} className="text-sm text-emerald-400 hover:underline">← Challenge capture</Link><p className="eyebrow mt-8">Manual write-up</p><WriteupEditor challenge={{ id: challenge.id, name: challenge.name, version: challenge.version, latestRevisionId: challenge.latest_revision_id, reviewed: challenge.reviewed_version === challenge.version && challenge.approved_revision_id === challenge.latest_revision_id }} initialSections={sections} images={images} /></main>;
}
