import { z } from "zod";

export const sectionIds = ["overview", "observations", "solution", "result", "tools"] as const;
export const sectionTitles: Record<(typeof sectionIds)[number], string> = {
  overview: "Challenge overview",
  observations: "Initial observations",
  solution: "Solution steps",
  result: "Flag recovery and result",
  tools: "Tools and references",
};
export const sectionSchema = z.object({
  id: z.enum(sectionIds),
  markdown: z.string().max(30000),
  evidenceIds: z.array(z.uuid()).max(100),
});
export const sectionsSchema = z.array(sectionSchema).length(5).refine(
  sections => sectionIds.every(id => sections.some(section => section.id === id)) && new Set(sections.map(section => section.id)).size === 5,
  "All five write-up sections are required.",
);
export type WriteupSection = z.infer<typeof sectionSchema>;
export function emptySections(): WriteupSection[] {
  return sectionIds.map(id => ({ id, markdown: "", evidenceIds: [] }));
}
export function readyForReview(sections: WriteupSection[]) {
  return (["overview", "solution", "result"] as const).every(id => sections.find(section => section.id === id)?.markdown.trim());
}
export const snapshotSchema = z.object({
  title: z.string(), description: z.string(), eventDate: z.string().nullable(),
  challenges: z.array(z.object({
    id: z.uuid(), name: z.string(), category: z.string().nullable(),
    points: z.number().nullable(), author: z.string(), sections: sectionsSchema,
    evidence: z.array(z.object({ id: z.uuid(), storagePath: z.string(), caption: z.string(), position: z.number() })),
  })),
});
export type ReportSnapshot = z.infer<typeof snapshotSchema>;
