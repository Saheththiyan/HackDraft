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
// Same tokens as globals.css: paper/ink with one cobalt accent.
const ink = "131A2B";
const muted = "5B6273";
const faint = "8B91A1";
const accent = "2447C4";
const line = "E4E4DD";
const pale = "F4F4F0";
const sans = "IBM Plex Sans";
const serif = "Newsreader";
const mono = "IBM Plex Mono";

// Word embeds fonts as raw TrueType data; the docx package accepts Buffer-shaped
// byte arrays, which a fetched Uint8Array satisfies at runtime in the browser.
//
// docx's font table gives every embedded file its own "regular" slot under its
// name — it has no way to register separate bold/italic/weight variants of the
// same family (registering four IBM Plex Sans weights this way produced four
// colliding "IBM Plex Sans" entries that only confused Word). So each family
// gets exactly one embedded weight here; Word synthesizes bold and italic from
// it the same way it does for any other document, which is standard practice
// for embedded-font Word files. Newsreader embeds its medium weight directly
// (rather than regular) so serif text matches the page-title's weight on the web.
async function loadFont(path: string): Promise<Uint8Array> {
  const response = await fetch(path);
  return new Uint8Array(await response.arrayBuffer());
}
async function embeddedFonts() {
  const [sansRegular, serifMedium, monoRegular] = await Promise.all([
    loadFont("/fonts/IBMPlexSans-Regular.ttf"),
    loadFont("/fonts/Newsreader24pt-Medium.ttf"),
    loadFont("/fonts/IBMPlexMono-Regular.ttf"),
  ]);
  const asBuffer = (data: Uint8Array) => data as unknown as Buffer;
  return [
    { name: sans, data: asBuffer(sansRegular) },
    { name: serif, data: asBuffer(serifMedium) },
    { name: mono, data: asBuffer(monoRegular) },
  ];
}

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
      return [new ExternalHyperlink({ link: node.url, children: [new TextRun({ text: plain(node), color: accent, underline: {}, ...style })] })];
    }
    if (node.type === "inlineCode") return [new TextRun({ text: node.value ?? "", font: mono, shading: { fill: pale }, ...style })];
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
    if (node.type === "code") return [new Paragraph({ children: (node.value ?? "").split("\n").map((codeLine, index) => new TextRun({ text: codeLine || " ", break: index ? 1 : undefined, font: mono, size: 18 })), shading: { fill: pale }, border: { left: { style: BorderStyle.SINGLE, color: accent, size: 12, space: 8 } }, indent: { left: 200 }, spacing: { before: 100, after: 160 } })];
    if (node.type === "list") return (node.children ?? []).map((item, index) => new Paragraph({ children: [new TextRun({ text: node.ordered ? `${index + 1}. ` : "– ", color: faint }), ...runs(item.children?.[0]?.children ?? item.children ?? [])], indent: { left: 420, hanging: 260 }, spacing: { after: 90 } }));
    if (node.type === "blockquote") return [new Paragraph({ children: [new TextRun({ text: plain(node), color: muted, italics: true })], border: { left: { style: BorderStyle.SINGLE, color: line, size: 12, space: 8 } }, indent: { left: 220 }, spacing: { before: 100, after: 150 } })];
    if (node.type === "thematicBreak") return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, color: line, size: 6 } }, spacing: { after: 160 } })];
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
    new Paragraph({ children: [new ImageRun({ type, data, transformation: { width, height }, altText: { name: caption, description: caption } })], border: { top: { style: BorderStyle.SINGLE, color: line, size: 4 }, bottom: { style: BorderStyle.SINGLE, color: line, size: 4 }, left: { style: BorderStyle.SINGLE, color: line, size: 4 }, right: { style: BorderStyle.SINGLE, color: line, size: 4 } }, spacing: { before: 160, after: 60 } }),
    new Paragraph({ children: [new TextRun({ text: caption, italics: true, color: muted, size: 18 })], spacing: { after: 180 } }),
  ];
}

export async function generateReportDocx(content: ReportSnapshot, imageData: Record<string, string>, createdAt?: string): Promise<Blob> {
  const count = `${content.challenges.length} reviewed ${content.challenges.length === 1 ? "challenge" : "challenges"}`;
  const body: Block[] = [
    new Paragraph({ children: [new TextRun({ text: "HackDraft", bold: true, font: sans, color: ink, size: 22 })], spacing: { before: 200, after: 260 } }),
    new Paragraph({ children: [new TextRun({ text: createdAt ? `Saved report, ${new Date(createdAt).toLocaleString()}` : "Saved report", color: muted, size: 18 })], spacing: { after: 80 } }),
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: content.title, font: serif, color: ink, size: 56 })], spacing: { after: 220 } }),
    new Paragraph({ children: [new TextRun({ text: `${count}. The write-ups and screenshots that follow are fixed as they were when this report was saved.`, color: muted, size: 22 })] }),
  ];
  if (content.eventDate) body.push(new Paragraph({ children: [new TextRun({ text: `Event date ${content.eventDate}`, color: muted, size: 20 })], spacing: { before: 200 } }));
  body.push(new Paragraph({ children: [new TextRun({ text: "Contents", font: sans, bold: true, color: muted, size: 18 })], pageBreakBefore: true, spacing: { after: 200 } }));
  if (content.description) body.push(new Paragraph({ children: [new TextRun({ text: content.description, color: muted })], spacing: { after: 250 } }));
  for (const [index, challenge] of content.challenges.entries()) {
    body.push(new Paragraph({ children: [new TextRun({ text: `${index + 1}  `, color: faint }), new TextRun(challenge.name)], border: { top: { style: BorderStyle.SINGLE, color: line, size: 4 } }, spacing: { before: 80, after: 80 } }));
  }
  body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Challenge summary", spacing: { before: 350, after: 150 } }));
  body.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
    new TableRow({ children: ["Challenge", "Category", "Points"].map(text => new TableCell({ shading: { fill: pale }, children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] })) }),
    ...content.challenges.map(challenge => new TableRow({ children: [challenge.name, challenge.category || "General", challenge.points == null ? "—" : String(challenge.points)].map(text => new TableCell({ children: [new Paragraph({ text })] })) })),
  ] }));
  for (const [index, challenge] of content.challenges.entries()) {
    body.push(new Paragraph({ children: [new TextRun({ text: `Challenge ${index + 1}${challenge.category ? `, ${challenge.category}` : ""}`, font: sans, color: muted, size: 18 })], pageBreakBefore: true, spacing: { after: 100 } }));
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: challenge.name, font: serif })], spacing: { after: 80 } }));
    body.push(new Paragraph({ children: [new TextRun({ text: [challenge.points != null ? `${challenge.points} points` : "", challenge.author ? `Solved by ${challenge.author}` : ""].filter(Boolean).join(" · "), color: muted })], spacing: { after: 300 } }));
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
    fonts: await embeddedFonts(),
    styles: {
      default: {
        document: { run: { font: sans, size: 21, color: ink }, paragraph: { spacing: { after: 120, line: 320 } } },
        title: { run: { font: serif, bold: false, size: 56, color: ink } },
        heading1: { run: { font: serif, bold: false, size: 30, color: ink }, paragraph: { spacing: { before: 300, after: 140 } } },
        heading2: { run: { font: sans, bold: true, size: 24, color: ink }, paragraph: { spacing: { before: 260, after: 120 } } },
        heading3: { run: { font: sans, bold: true, size: 21, color: ink }, paragraph: { spacing: { before: 200, after: 100 } } },
      },
    },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${content.title}  ·  `, color: faint, size: 16 }), new TextRun({ children: [PageNumber.CURRENT], color: faint, size: 16 })] })] }) }, children: body }],
  });
  return Packer.toBlob(document);
}
