"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { challengeInput, competitionInput, type ChallengeInput } from "@/lib/capture";

type Result = { ok: true; version: number } | { ok: false; reason: "conflict" | "invalid" | "failed"; message: string };
const uuid = z.uuid();
async function workspaceContext() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("workspaces").select("id").single();
  if (error || !data) throw new Error("Team workspace is unavailable.");
  return { supabase, workspaceId: data.id as string };
}
function failure(error: { message: string; code?: string } | null): Result {
  if (error?.message.includes("version_conflict")) return { ok: false, reason: "conflict", message: "Someone changed this challenge in another tab. Your edits have not been overwritten. Copy them before reloading." };
  return { ok: false, reason: "failed", message: "Unable to save. Your unsaved changes are still on this page." };
}
export async function createCompetition(form: FormData) {
  const parsed = competitionInput.safeParse({ name: form.get("name"), description: form.get("description"), event_date: form.get("event_date") });
  if (!parsed.success) return { error: "Enter a competition name (up to 200 characters)." };
  const { supabase, workspaceId } = await workspaceContext();
  const { data, error } = await supabase.from("competitions").insert({ workspace_id: workspaceId, name: parsed.data.name, description: parsed.data.description, event_date: parsed.data.event_date || null }).select("id").single();
  if (error || !data) return { error: "Could not create the competition. Please try again." };
  revalidatePath("/dashboard");
  redirect(`/dashboard/competitions/${data.id}`);
}
export async function updateCompetition(id: string, form: FormData) {
  if (!uuid.safeParse(id).success) return { error: "Invalid competition." };
  const parsed = competitionInput.safeParse({ name: form.get("name"), description: form.get("description"), event_date: form.get("event_date") });
  if (!parsed.success) return { error: "Check the competition details and try again." };
  const { supabase, workspaceId } = await workspaceContext();
  const { data, error } = await supabase.from("competitions").update({ name: parsed.data.name, description: parsed.data.description, event_date: parsed.data.event_date || null, updated_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", workspaceId).select("id").single();
  if (error || !data) return { error: "Could not update the competition." };
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/competitions/${id}`);
  return { error: null };
}
export async function createChallenge(competitionId: string, form: FormData) {
  if (!uuid.safeParse(competitionId).success) return { error: "Invalid competition." };
  const name = z.string().trim().min(1).max(200).safeParse(form.get("name"));
  if (!name.success) return { error: "Enter a challenge name (up to 200 characters)." };
  const { supabase, workspaceId } = await workspaceContext();
  const { data: competition } = await supabase.from("competitions").select("id").eq("id", competitionId).eq("workspace_id", workspaceId).single();
  if (!competition) return { error: "Competition not found." };
  const { data, error } = await supabase.from("challenges").insert({ workspace_id: workspaceId, competition_id: competitionId, name: name.data }).select("id").single();
  if (error || !data) return { error: "Could not create the challenge." };
  revalidatePath(`/dashboard/competitions/${competitionId}`);
  redirect(`/dashboard/competitions/${competitionId}/challenges/${data.id}`);
}
export async function saveChallenge(id: string, expectedVersion: number, input: ChallengeInput): Promise<Result> {
  if (!uuid.safeParse(id).success || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) return { ok: false, reason: "invalid", message: "Invalid challenge." };
  const parsed = challengeInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid", message: "Check field lengths and points, then try again." };
  const { supabase } = await workspaceContext();
  const { data, error } = await supabase.rpc("save_challenge", {
    p_id: id, p_version: expectedVersion,
    p_name: parsed.data.name, p_category: parsed.data.category,
    p_points: parsed.data.points, p_author_label: parsed.data.author_label,
    p_description: parsed.data.description, p_source_notes: parsed.data.source_notes,
    p_commands: parsed.data.commands, p_flag: parsed.data.flag,
  });
  if (error || typeof data !== "number") return failure(error);
  return { ok: true, version: data };
}
export async function attachEvidence(challengeId: string, expectedVersion: number, path: string, caption: string): Promise<Result> {
  if (!uuid.safeParse(challengeId).success || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || caption.length > 500 || path.length > 500) return { ok: false, reason: "invalid", message: "Invalid image details." };
  const { supabase } = await workspaceContext();
  const { data, error } = await supabase.rpc("attach_evidence", { p_challenge_id: challengeId, p_version: expectedVersion, p_storage_path: path, p_caption: caption });
  if (error || typeof data !== "number") return failure(error);
  return { ok: true, version: data };
}
export async function saveEvidenceOrder(challengeId: string, expectedVersion: number, items: { id: string; caption: string }[]): Promise<Result> {
  if (!uuid.safeParse(challengeId).success || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || items.length > 100 || items.some(item => !uuid.safeParse(item.id).success || item.caption.length > 500)) return { ok: false, reason: "invalid", message: "Invalid image order or caption." };
  const { supabase } = await workspaceContext();
  const { data, error } = await supabase.rpc("update_evidence_order", { p_challenge_id: challengeId, p_version: expectedVersion, p_items: items });
  if (error || typeof data !== "number") return failure(error);
  return { ok: true, version: data };
}
export async function removeEvidence(challengeId: string, expectedVersion: number, evidenceId: string): Promise<Result> {
  if (![challengeId, evidenceId].every(value => uuid.safeParse(value).success) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) return { ok: false, reason: "invalid", message: "Invalid image." };
  const { supabase } = await workspaceContext();
  const { data, error } = await supabase.rpc("remove_evidence", { p_challenge_id: challengeId, p_version: expectedVersion, p_evidence_id: evidenceId });
  if (error || !Array.isArray(data) || data.length !== 1 || typeof data[0].next_version !== "number") return failure(error);
  const { error: storageError } = await supabase.storage.from("evidence").remove([data[0].removed_path]);
  if (storageError) return { ok: false, reason: "failed", message: "Image removed from the challenge, but file cleanup failed. Reload to continue." };
  return { ok: true, version: data[0].next_version };
}
