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
        ? await import("@/components/report/pdf-export").then(module => module.generateReportPdf(content, imageData))
        : await import("@/components/report/docx-export").then(module => module.generateReportDocx(content, imageData));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `${safeFilename(content.title)}-report.${format}`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (caught) { setError(caught instanceof Error ? caught.message : `Could not generate the ${format.toUpperCase()}. Try again.`); }
    finally { setBusy(null); }
  }
  return <div><section className="page-hero mt-6 flex flex-wrap items-end justify-between gap-6 p-8 sm:p-10"><div><p className="hero-label">Saved report · {new Date(createdAt).toLocaleString()}</p><h1 className="hero-title mt-5">{content.title}</h1><p className="hero-subtitle mt-3">{content.challenges.length} reviewed {content.challenges.length === 1 ? "challenge" : "challenges"} in this snapshot.</p></div><div className="flex flex-wrap gap-3"><Button onClick={() => void download("pdf")} disabled={busy !== null}>{busy === "pdf" ? "Preparing PDF…" : "Download PDF"}</Button><Button variant="outline" onClick={() => void download("docx")} disabled={busy !== null}>{busy === "docx" ? "Preparing DOCX…" : "Download DOCX"}</Button></div></section>
    {error && <p role="alert" className="mt-5 rounded-lg border border-rose-500/40 p-4 text-rose-300">{error}</p>}
    <section className="panel mt-10 p-8"><p className="eyebrow">Report preview</p>{content.description && <p className="mt-4 whitespace-pre-wrap text-slate-300">{content.description}</p>}<h2 className="mt-8 text-xl font-semibold">Contents</h2><ol className="mt-4 list-inside list-decimal space-y-2 text-slate-300">{content.challenges.map(challenge => <li key={challenge.id}><a className="hover:text-emerald-300" href={`#challenge-${challenge.id}`}>{challenge.name}</a></li>)}</ol></section>
    {content.challenges.map((challenge, index) => <article id={`challenge-${challenge.id}`} className="panel mt-6 p-8" key={challenge.id}><p className="eyebrow">Challenge {index + 1} · {challenge.category || "General"}</p><h2 className="mt-3 text-2xl font-bold">{challenge.name}</h2><p className="mt-2 text-sm text-slate-400">{[challenge.points != null ? `${challenge.points} points` : "", challenge.author ? `Solved by ${challenge.author}` : ""].filter(Boolean).join(" · ")}</p>
      {challenge.sections.filter(section => section.markdown.trim() || section.evidenceIds.length).map(section => <section key={section.id} className="mt-8"><h3 className="text-xl font-semibold">{sectionTitles[section.id]}</h3><div className="prose-report mt-3"><Markdown remarkPlugins={[remarkGfm]} components={{ img: () => null }}>{section.markdown}</Markdown></div>{section.evidenceIds.map(id => { const image = challenge.evidence.find(item => item.id === id); return image ? <figure key={id} className="mt-5">{urls[id] && <Image src={urls[id]} alt={image.caption || "Challenge screenshot"} width={1000} height={600} unoptimized className="h-auto max-h-[540px] w-auto max-w-full rounded-lg object-contain" />}<figcaption className="mt-2 text-sm text-slate-400">{image.caption || "Screenshot"}</figcaption></figure> : null; })}</section>)}</article>)}
    <p className="mt-6 text-xs text-slate-500">Report ID: {reportId}</p>
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
