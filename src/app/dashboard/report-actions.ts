"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { readyForReview, sectionsSchema, type WriteupSection } from "@/lib/writeup";

const uuid = z.uuid();
type EditResult = { ok: true; version: number; revisionId?: string } | { ok: false; reason: "conflict" | "invalid" | "failed"; message: string };
function failure(error: { message: string } | null): EditResult {
  if (error?.message.includes("version_conflict")) return { ok: false, reason: "conflict", message: "This challenge changed in another tab. Copy your edits, then reload the latest version." };
  if (error?.message.includes("incomplete_writeup")) return { ok: false, reason: "invalid", message: "Complete the overview, solution steps, and result before approving." };
  return { ok: false, reason: "failed", message: "Could not save the write-up. Your edits remain on this page." };
}
export async function saveWriteup(challengeId: string, version: number, sections: WriteupSection[]): Promise<EditResult> {
  if (!uuid.safeParse(challengeId).success || !Number.isSafeInteger(version) || version < 1) return { ok: false, reason: "invalid", message: "Invalid challenge version." };
  const parsed = sectionsSchema.safeParse(sections);
  if (!parsed.success) return { ok: false, reason: "invalid", message: "Check the section text and screenshots before saving." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("save_writeup", { p_challenge_id: challengeId, p_version: version, p_sections: parsed.data });
  if (error || !Array.isArray(data) || data.length !== 1) return failure(error);
  revalidatePath("/dashboard");
  return { ok: true, version: data[0].next_version, revisionId: data[0].revision_id };
}
export async function approveWriteup(challengeId: string, version: number): Promise<EditResult> {
  if (!uuid.safeParse(challengeId).success || !Number.isSafeInteger(version) || version < 1) return { ok: false, reason: "invalid", message: "Invalid challenge version." };
  const { supabase } = await requireUser();
  const { data: challenge } = await supabase.from("challenges").select("latest_revision_id").eq("id", challengeId).single();
  if (!challenge?.latest_revision_id) return { ok: false, reason: "invalid", message: "Save a write-up before approving it." };
  const { data: revision } = await supabase.from("writeup_revisions").select("sections").eq("id", challenge.latest_revision_id).single();
  const sections = sectionsSchema.safeParse(revision?.sections);
  if (!sections.success || !readyForReview(sections.data)) return { ok: false, reason: "invalid", message: "Complete the overview, solution steps, and result before approving." };
  const { data, error } = await supabase.rpc("approve_writeup", { p_challenge_id: challengeId, p_version: version });
  if (error || typeof data !== "number") return failure(error);
  revalidatePath("/dashboard");
  return { ok: true, version: data };
}
export async function createReportSnapshot(competitionId: string, challengeIds: string[]): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (!uuid.safeParse(competitionId).success || challengeIds.length < 1 || challengeIds.length > 100 || challengeIds.some(id => !uuid.safeParse(id).success) || new Set(challengeIds).size !== challengeIds.length) return { ok: false, message: "Select between 1 and 100 reviewed challenges." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_report_snapshot", { p_competition_id: competitionId, p_challenge_ids: challengeIds });
  if (error || typeof data !== "string") return { ok: false, message: error?.message.includes("challenge_not_reviewed") ? "One selected challenge needs review again. Refresh the page." : "Could not create the report. Try again." };
  revalidatePath(`/dashboard/competitions/${competitionId}`);
  return { ok: true, id: data };
}
