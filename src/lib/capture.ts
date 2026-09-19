import { z } from "zod";

export const competitionInput = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(10000).default(""),
  event_date: z.iso.date().or(z.literal("")).default(""),
});
export const challengeInput = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().max(100).default(""),
  points: z.number().int().min(0).max(1000000).nullable(),
  author_label: z.string().max(100).default(""),
  description: z.string().max(10000).default(""),
  source_notes: z.string().max(100000).default(""),
  commands: z.string().max(50000).default(""),
  flag: z.string().max(2000).default(""),
});
export type ChallengeInput = z.infer<typeof challengeInput>;
export type Evidence = { id: string; storage_path: string; caption: string; position: number };
export type ChallengeRecord = ChallengeInput & { id: string; competition_id: string; workspace_id: string; version: number; evidence: Evidence[] };
