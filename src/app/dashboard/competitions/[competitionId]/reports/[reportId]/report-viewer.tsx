"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/button";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { sectionTitles, type ReportSnapshot } from "@/lib/writeup";

export function ReportViewer({ reportId, createdAt, content }: { reportId: string; createdAt: string; content: ReportSnapshot }) {
  const [supabase] = useState(createBrowserSupabase);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"pdf" | "docx" | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const evidence = content.challenges.flatMap(challenge => challenge.evidence);
    Promise.all(evidence.map(async item => {
      const { data } = await supabase.storage.from("evidence").createSignedUrl(item.storagePath, 3600);
      return [item.id, data?.signedUrl ?? ""] as const;
    })).then(entries => { if (active) setUrls(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [content, supabase]);
  async function download(format: "pdf" | "docx") {
    setBusy(format); setError("");
    try {
      const evidence = content.challenges.flatMap(challenge => challenge.evidence);
      const imageData: Record<string, string> = {};
      for (const item of evidence) {
        const { data, error: downloadError } = await supabase.storage.from("evidence").download(item.storagePath);
        if (downloadError || !data) throw new Error(`Could not load screenshot: ${item.caption || item.storagePath.split("/").at(-1)}`);
        const blob = data.type === "image/webp" ? await convertWebp(data) : data;
        imageData[item.id] = await asDataUrl(blob);
      }
      const blob = format === "pdf"
        ? await import("@/components/report/pdf-export").then(module => module.generateReportPdf(content, imageData, createdAt))
        : await import("@/components/report/docx-export").then(module => module.generateReportDocx(content, imageData, createdAt));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `${safeFilename(content.title)}-report.${format}`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (caught) { setError(caught instanceof Error ? caught.message : `Could not generate the ${format.toUpperCase()}. Try again.`); }
    finally { setBusy(null); }
  }
  return <div><section className="page-head"><div className="page-head-copy"><p className="page-context">Saved report, {new Date(createdAt).toLocaleString()}</p><h1 className="page-title">{content.title}</h1><p className="page-lede">{content.challenges.length} reviewed {content.challenges.length === 1 ? "challenge" : "challenges"}. The write-ups and screenshots below are fixed as they were when this report was saved.</p></div><div className="page-head-actions"><Button onClick={() => void download("pdf")} disabled={busy !== null}>{busy === "pdf" ? "Preparing PDF…" : "Download PDF"}</Button><Button variant="outline" onClick={() => void download("docx")} disabled={busy !== null}>{busy === "docx" ? "Preparing DOCX…" : "Download DOCX"}</Button></div></section>
    {error && <p role="alert" className="alert alert-danger mt-5">{error}</p>}
    <section className="sheet mt-8 p-8 sm:p-10"><p className="sheet-section-label">Contents</p>{content.description && <p className="mt-3 whitespace-pre-wrap t-muted">{content.description}</p>}<ol className="sheet-toc">{content.challenges.map(challenge => <li key={challenge.id}><a href={`#challenge-${challenge.id}`}>{challenge.name}</a></li>)}</ol></section>
    {content.challenges.map((challenge, index) => <article id={`challenge-${challenge.id}`} className="sheet mt-6 p-8 sm:p-10" key={challenge.id}><p className="sheet-section-label">Challenge {index + 1}{challenge.category ? `, ${challenge.category}` : ""}</p><h2 className="sheet-title">{challenge.name}</h2><p className="mt-2 t-small t-muted">{[challenge.points != null ? `${challenge.points} points` : "", challenge.author ? `Solved by ${challenge.author}` : ""].filter(Boolean).join(" · ")}</p>
      {challenge.sections.filter(section => section.markdown.trim() || section.evidenceIds.length).map(section => <section key={section.id}><h3 className="sheet-h3">{sectionTitles[section.id]}</h3><div className="prose-report mt-2"><Markdown remarkPlugins={[remarkGfm]} components={{ img: () => null }}>{section.markdown}</Markdown></div>{section.evidenceIds.map(id => { const image = challenge.evidence.find(item => item.id === id); return image ? <figure key={id} className="mt-5">{urls[id] && <Image src={urls[id]} alt={image.caption || "Challenge screenshot"} width={1000} height={600} unoptimized className="h-auto max-h-[540px] w-auto max-w-full rounded-md border border-[var(--line)] object-contain" />}<figcaption className="mt-2 t-small t-muted">{image.caption || "Screenshot"}</figcaption></figure> : null; })}</section>)}</article>)}
    <p className="mt-6 t-xs t-faint mono">Report ID {reportId}</p>
  </div>;
}
function safeFilename(input: string) { return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "ctf"; }
function asDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Could not read screenshot.")); reader.readAsDataURL(blob); });
}
async function convertWebp(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
  const context = canvas.getContext("2d"); if (!context) throw new Error("Could not prepare WebP screenshot.");
  context.drawImage(bitmap, 0, 0); bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not convert WebP screenshot.")), "image/png"));
}
