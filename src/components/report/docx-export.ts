"use client";

import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, HeadingLevel,
  ImageRun, Packer, PageNumber, Paragraph, Table, TableCell, TableRow, TextRun,
  WidthType,
} from "docx";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { sectionTitles, type ReportSnapshot } from "@/lib/writeup";

type MdNode = { type: string; value?: string; url?: string; depth?: number; ordered?: boolean; children?: MdNode[] };
type Block = Paragraph | Table;
const ink = "172234";
const muted = "526174";
const green = "047857";
const pale = "F4F8F7";

function plain(node: MdNode): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(plain).join(node.type === "paragraph" ? "" : " ");
}
function runs(nodes: MdNode[], style: { bold?: boolean; italics?: boolean } = {}): (TextRun | ExternalHyperlink)[] {
  return nodes.flatMap(node => {
    if (node.type === "image" || node.type === "html") return [];
    if (node.type === "strong") return runs(node.children ?? [], { ...style, bold: true });
    if (node.type === "emphasis") return runs(node.children ?? [], { ...style, italics: true });
    if (node.type === "link" && node.url && /^https?:\/\//i.test(node.url)) {
      return [new ExternalHyperlink({ link: node.url, children: [new TextRun({ text: plain(node), color: green, underline: {}, ...style })] })];
    }
    if (node.type === "inlineCode") return [new TextRun({ text: node.value ?? "", font: "Consolas", color: green, ...style })];
    if (node.type === "break") return [new TextRun({ text: "", break: 1 })];
    if (node.children) return runs(node.children, style);
    return [new TextRun({ text: node.value ?? "", ...style })];
  });
}
function markdownBlocks(markdown: string): Block[] {
  const root = unified().use(remarkParse).use(remarkGfm).parse(markdown) as unknown as MdNode;
  return (root.children ?? []).flatMap(node => {
    if (node.type === "paragraph") return [new Paragraph({ children: runs(node.children ?? []), spacing: { after: 150 } })];
    if (node.type === "heading") return [new Paragraph({ heading: node.depth === 1 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, children: runs(node.children ?? []), spacing: { before: 220, after: 120 } })];
    if (node.type === "code") return [new Paragraph({ children: (node.value ?? "").split("\n").map((line, index) => new TextRun({ text: line || " ", break: index ? 1 : undefined, font: "Consolas", size: 18 })), shading: { fill: pale }, border: { left: { style: BorderStyle.SINGLE, color: green, size: 12, space: 8 } }, indent: { left: 200 }, spacing: { before: 100, after: 160 } })];
    if (node.type === "list") return (node.children ?? []).map((item, index) => new Paragraph({ children: [new TextRun({ text: node.ordered ? `${index + 1}. ` : "• ", color: green, bold: true }), ...runs(item.children?.[0]?.children ?? item.children ?? [])], indent: { left: 420, hanging: 260 }, spacing: { after: 90 } }));
    if (node.type === "blockquote") return [new Paragraph({ children: [new TextRun({ text: plain(node), color: muted, italics: true })], border: { left: { style: BorderStyle.SINGLE, color: green, size: 12, space: 8 } }, indent: { left: 220 }, spacing: { before: 100, after: 150 } })];
    if (node.type === "thematicBreak") return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, color: "D9E2E8", size: 6 } }, spacing: { after: 160 } })];
    if (node.type === "table") return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: (node.children ?? []).map((row, rowIndex) => new TableRow({ children: (row.children ?? []).map(cell => new TableCell({ shading: rowIndex === 0 ? { fill: pale } : undefined, children: [new Paragraph({ children: runs(cell.children ?? [], { bold: rowIndex === 0 }) })] })) })) })];
    return [];
  });
}

async function screenshot(dataUrl: string, caption: string): Promise<Block[]> {
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(500 / bitmap.width, 360 / bitmap.height, 1);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  bitmap.close();
  const data = new Uint8Array(await blob.arrayBuffer());
  const type = blob.type === "image/jpeg" ? "jpg" : "png";
  return [
    new Paragraph({ children: [new ImageRun({ type, data, transformation: { width, height }, altText: { name: caption, description: caption } })], spacing: { before: 160, after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: caption, italics: true, color: muted, size: 18 })], spacing: { after: 180 } }),
  ];
}

export async function generateReportDocx(content: ReportSnapshot, imageData: Record<string, string>): Promise<Blob> {
  const body: Block[] = [
    new Paragraph({ children: [new TextRun({ text: "HACKDRAFT / CTF REPORT", bold: true, color: green, size: 22 })], spacing: { before: 1000, after: 700 } }),
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: content.title, bold: true, color: ink, size: 56 })], spacing: { after: 280 } }),
    new Paragraph({ children: [new TextRun({ text: "Challenge write-ups", color: muted, size: 30 })], spacing: { after: 700 } }),
    new Paragraph({ children: [new TextRun({ text: [content.eventDate ? `Event date: ${content.eventDate}` : "", `${content.challenges.length} reviewed ${content.challenges.length === 1 ? "challenge" : "challenges"}`].filter(Boolean).join("\n"), color: muted })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, text: "Contents" }),
  ];
  if (content.description) body.push(new Paragraph({ text: content.description, spacing: { after: 250 } }));
  for (const [index, challenge] of content.challenges.entries()) {
    body.push(new Paragraph({ children: [new TextRun({ text: `${String(index + 1).padStart(2, "0")}  `, bold: true, color: green }), new TextRun(challenge.name)], spacing: { after: 130 } }));
  }
  body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Challenge summary", spacing: { before: 350, after: 150 } }));
  body.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
    new TableRow({ children: ["Challenge", "Category", "Points"].map(text => new TableCell({ shading: { fill: pale }, children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] })) }),
    ...content.challenges.map(challenge => new TableRow({ children: [challenge.name, challenge.category || "General", challenge.points == null ? "—" : String(challenge.points)].map(text => new TableCell({ children: [new Paragraph({ text })] })) })),
  ] }));
  for (const [index, challenge] of content.challenges.entries()) {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, text: challenge.name }));
    body.push(new Paragraph({ children: [new TextRun({ text: [`Challenge ${index + 1}`, challenge.category || "General", challenge.points != null ? `${challenge.points} points` : "", challenge.author ? `Solved by ${challenge.author}` : ""].filter(Boolean).join(" · "), color: muted })], spacing: { after: 300 } }));
    for (const section of challenge.sections) {
      if (!section.markdown.trim() && !section.evidenceIds.length) continue;
      body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: sectionTitles[section.id], spacing: { before: 280, after: 140 } }));
      body.push(...markdownBlocks(section.markdown));
      for (const id of section.evidenceIds) {
        const image = challenge.evidence.find(item => item.id === id);
        if (image && imageData[id]) body.push(...await screenshot(imageData[id], image.caption || "Screenshot"));
      }
    }
  }
  const document = new Document({
    creator: "HackDraft", title: `${content.title} — CTF report`, subject: "CTF challenge write-ups",
    styles: { default: { document: { run: { font: "Aptos", size: 21, color: ink }, paragraph: { spacing: { after: 120, line: 320 } } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${content.title}  ·  `, color: muted, size: 16 }), new TextRun({ children: [PageNumber.CURRENT], color: muted, size: 16 })] })] }) }, children: body }],
  });
  return Packer.toBlob(document);
}
