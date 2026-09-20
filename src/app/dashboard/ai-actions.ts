"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requestGeminiDraft } from "@/lib/gemini.mjs";
import { readyForReview, sectionIds, type WriteupSection } from "@/lib/writeup";

const generatedSchema = z.object({
  overview: z.string().max(30000),
  observations: z.string().max(30000),
  solution: z.string().max(30000),
  result: z.string().max(30000),
  tools: z.string().max(30000),
});
type DraftResult = { ok: true; sections: WriteupSection[] } | { ok: false; message: string };

export async function generateWriteupDraft(challengeId: string, version: number): Promise<DraftResult> {
  if (!z.uuid().safeParse(challengeId).success || !Number.isSafeInteger(version) || version < 1) {
    return { ok: false, message: "Invalid challenge. Reload the page and try again." };
  }
  const { supabase } = await requireUser();
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, message: "Gemini is not configured. Add GEMINI_API_KEY to the server environment and restart the app." };
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) return { ok: false, message: "Invalid GEMINI_MODEL configuration." };

  const { data: challenge, error } = await supabase.from("challenges")
    .select("id, workspace_id, name, category, description, source_notes, commands, flag, version")
    .eq("id", challengeId).maybeSingle();
  if (error || !challenge) return { ok: false, message: "Challenge not found or access denied." };
  if (challenge.version !== version) return { ok: false, message: "The challenge changed. Reload before generating a draft." };
  if (challenge.source_notes.trim().length < 20) return { ok: false, message: "Add a useful account of how you solved the challenge first." };
  if (challenge.source_notes.length > 50000 || challenge.commands.length > 20000) {
    return { ok: false, message: "The solve notes or commands are too long for one draft. Shorten them and try again." };
  }

  const { data: evidence, error: evidenceError } = await supabase.from("evidence").select("caption").eq("challenge_id", challengeId).order("position");
  if (evidenceError) return { ok: false, message: "Could not load screenshot captions. Try again." };
  const { data: admitted, error: limitError } = await supabase.rpc("consume_ai_request", { p_workspace_id: challenge.workspace_id });
  if (limitError) return { ok: false, message: "Draft generation is temporarily unavailable. Ask your administrator to check the database migrations." };
  if (admitted !== true) return { ok: false, message: "Your team has requested five drafts in a minute. Wait a minute before trying again." };
  const fields = {
    name: challenge.name, category: challenge.category,
    challengePrompt: challenge.description, solveNotes: challenge.source_notes,
    commandsAndOutput: challenge.commands, recordedFlag: challenge.flag,
    screenshotCaptions: (evidence ?? []).map(item => item.caption).filter(Boolean),
  };
  const result = await requestGeminiDraft({ key, model, fields });
  if (!result.ok) return result;
  const parsed = generatedSchema.safeParse(result.draft);
  if (!parsed.success) return { ok: false, message: "Gemini returned an invalid draft. Try again." };
  const sections = sectionIds.map(id => ({ id, markdown: parsed.data[id], evidenceIds: [] }));
  if (!readyForReview(sections)) return { ok: false, message: "Gemini left a required section empty. Try again or complete it manually." };
  return { ok: true, sections };
}
