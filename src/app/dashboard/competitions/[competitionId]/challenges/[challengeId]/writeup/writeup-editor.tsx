"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import Image from "next/image";
import remarkGfm from "remark-gfm";
import { generateWriteupDraft } from "@/app/dashboard/ai-actions";
import { approveWriteup, saveWriteup } from "@/app/dashboard/report-actions";
import { Button } from "@/components/button";
import { readyForReview, sectionIds, sectionTitles, type WriteupSection } from "@/lib/writeup";

type State = "saved" | "unsaved" | "saving" | "reviewed" | "error" | "conflict";
export function WriteupEditor({ challenge, initialSections, images }: {
  challenge: { id: string; name: string; version: number; latestRevisionId: string | null; reviewed: boolean };
  initialSections: WriteupSection[]; images: { id: string; caption: string; url: string }[];
}) {
  const [sections, setSections] = useState(initialSections);
  const [state, setState] = useState<State>(challenge.reviewed ? "reviewed" : challenge.latestRevisionId ? "saved" : "unsaved");
  const [message, setMessage] = useState("");
  const [generated, setGenerated] = useState<WriteupSection[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [active, setActive] = useState<(typeof sectionIds)[number]>("overview");
  const current = useRef(initialSections);
  const saved = useRef(challenge.latestRevisionId ? JSON.stringify(initialSections) : "");
  const version = useRef(challenge.version);
  const pending = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocked = useRef(false);
  const reviewed = useRef(challenge.reviewed);
  const exists = useRef(Boolean(challenge.latestRevisionId));
  useEffect(() => {
    const warning = (event: BeforeUnloadEvent) => { if (saved.current !== JSON.stringify(current.current) || pending.current) event.preventDefault(); };
    window.addEventListener("beforeunload", warning);
    return () => window.removeEventListener("beforeunload", warning);
  }, []);
  const persist = useCallback(async (): Promise<boolean> => {
    if (blocked.current) return false;
    if (pending.current) return pending.current;
    const snapshot = current.current.map(section => ({ ...section, evidenceIds: [...section.evidenceIds] }));
    const serialized = JSON.stringify(snapshot);
    if (saved.current === serialized) return true;
    setState("saving");
    const work = (async () => {
      try {
        const result = await saveWriteup(challenge.id, version.current, snapshot);
        if (!result.ok) {
          setState(result.reason === "conflict" ? "conflict" : "error");
          setMessage(result.message);
          if (result.reason === "conflict") blocked.current = true;
          return false;
        }
        saved.current = serialized;
        version.current = result.version;
        exists.current = true;
        reviewed.current = false;
        setState(JSON.stringify(current.current) === serialized ? "saved" : "unsaved");
        setMessage("");
        return true;
      } catch {
        setState("error");
        setMessage("Could not reach the server. Your write-up remains on this page.");
        return false;
      }
    })();
    pending.current = work;
    let succeeded = false;
    try { succeeded = await work; return succeeded; } finally {
      pending.current = null;
      if (succeeded && !blocked.current && saved.current !== JSON.stringify(current.current)) timer.current = setTimeout(() => { void persist(); }, 1000);
    }
  }, [challenge.id]);
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    if (pending.current) await pending.current;
    return persist();
  }, [persist]);
  useEffect(() => {
    if (state !== "unsaved" || blocked.current) return;
    timer.current = setTimeout(() => { void persist(); }, 1000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [sections, state, persist]);
  function set(next: WriteupSection[]) {
    current.current = next;
    setSections(next);
    if (!blocked.current) setState(saved.current === JSON.stringify(next) ? reviewed.current ? "reviewed" : "saved" : "unsaved");
  }
  function update(id: WriteupSection["id"], changes: Partial<WriteupSection>) {
    set(current.current.map(section => section.id === id ? { ...section, ...changes } : section));
  }
  async function approve() {
    if (!(await flush())) return;
    if (!exists.current || !readyForReview(current.current)) {
      setMessage("Complete the overview, solution steps, and result before approving.");
      return;
    }
    setState("saving");
    try {
      const result = await approveWriteup(challenge.id, version.current);
      if (!result.ok) {
        setState(result.reason === "conflict" ? "conflict" : "error");
        setMessage(result.message);
        if (result.reason === "conflict") blocked.current = true;
        return;
      }
      version.current = result.version;
      reviewed.current = true;
      setState("reviewed");
      setMessage("");
    } catch { setState("error"); setMessage("Could not approve the write-up. Try again."); }
  }
  async function generate() {
    setGenerating(true);
    setMessage("");
    setGenerated(null);
    try {
      const result = await generateWriteupDraft(challenge.id, version.current);
      if (result.ok) setGenerated(result.sections);
      else setMessage(result.message);
    } catch { setMessage("Could not generate a draft. Try again."); }
    finally { setGenerating(false); }
  }
  function useGenerated() {
    if (!generated) return;
    if (sections.some(section => section.markdown.trim()) && !window.confirm("Replace the current write-up text with this AI draft? Your existing screenshot selections will stay attached.")) return;
    set(generated.map(section => ({ ...section, evidenceIds: current.current.find(item => item.id === section.id)?.evidenceIds ?? [] })));
    setGenerated(null);
    setMessage("");
  }
  const section = sections.find(item => item.id === active)!;
  return <div><section className="page-hero mt-6 flex flex-wrap items-end justify-between gap-5 p-8 sm:p-10"><div><p className="hero-label">Write-up studio</p><h1 className="hero-title mt-5">{challenge.name}</h1><p className="hero-subtitle mt-3">Generate a first draft from your saved solve notes, then edit and approve it.</p></div><div className="flex flex-wrap items-center gap-3"><span role="status" className={`text-sm ${state === "reviewed" || state === "saved" ? "text-emerald-300" : state === "conflict" || state === "error" ? "text-rose-300" : "text-amber-300"}`}>{({ saved: "Draft saved", unsaved: "Unsaved draft", saving: "Saving…", reviewed: "Reviewed", error: "Save failed", conflict: "Edit conflict" } as const)[state]}</span><Button variant="outline" disabled={state === "saving" || state === "conflict"} onClick={() => void flush()}>Save draft</Button><Button disabled={state === "saving" || state === "conflict" || !readyForReview(sections)} onClick={() => void approve()}>{state === "reviewed" ? "Reviewed ✓" : "Approve write-up"}</Button></div></section>
    {message && <p role="alert" className="mt-6 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">{message} {state === "conflict" && <button type="button" onClick={() => window.location.reload()} className="underline">Reload latest</button>}</p>}
    <section className="panel mt-6 p-6"><h2 className="text-lg font-semibold">Draft from solve notes</h2><p className="mt-2 text-sm text-slate-400">Gemini uses the saved challenge prompt, “How we solved it” notes, commands, flag, and screenshot captions to propose the five sections. Check every technical detail and attach screenshots before approval.</p><Button className="mt-4" variant="outline" disabled={generating || state === "conflict"} onClick={() => void generate()}>{generating ? "Generating…" : "Generate from solve notes"}</Button>{generated && <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-5"><p className="text-sm font-semibold text-emerald-300">Generated draft ready to review</p><p className="mt-1 text-sm text-slate-400">Applying it replaces the current section text. Screenshot selections stay attached.</p><div className="mt-4 space-y-3">{generated.map(section => <details key={section.id} className="rounded-lg border border-slate-700 p-3"><summary className="cursor-pointer text-sm font-medium">{sectionTitles[section.id]}</summary><div className="prose-report mt-3"><Markdown remarkPlugins={[remarkGfm]} components={{ img: () => null }}>{section.markdown || "*Empty section*"}</Markdown></div></details>)}</div><div className="mt-5 flex gap-3"><Button onClick={useGenerated}>Use this draft</Button><Button variant="outline" onClick={() => setGenerated(null)}>Discard</Button></div></div>}</section>
    <div className="mt-8 grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]"><nav aria-label="Write-up sections" className="panel h-fit space-y-1 p-3">{sectionIds.map(id => <button type="button" key={id} onClick={() => setActive(id)} className={`w-full rounded-lg px-3 py-3 text-left text-sm ${id === active ? "bg-emerald-400/15 text-emerald-300" : "text-slate-300 hover:bg-slate-800"}`}>{sectionTitles[id]}{sections.find(item => item.id === id)?.markdown.trim() ? " ✓" : ""}</button>)}</nav>
      <div className="space-y-6"><section className="panel p-6"><h2 className="text-xl font-semibold">{sectionTitles[active]}</h2><p className="mt-2 text-sm text-slate-400">Markdown supports headings, lists, links, and fenced code blocks. Raw HTML is not rendered.</p><label htmlFor="section-content" className="sr-only">{sectionTitles[active]} content</label><textarea id="section-content" className="input mt-5 min-h-72 font-mono text-sm" value={section.markdown} onChange={event => update(active, { markdown: event.target.value })} placeholder={active === "solution" ? "Describe each step and show the commands that mattered…" : "Write this section…"} />
        {images.length > 0 && <div className="mt-6"><h3 className="text-sm font-semibold">Screenshots in this section</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{images.map(image => <label key={image.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700 p-3 text-sm"><input type="checkbox" checked={section.evidenceIds.includes(image.id)} onChange={event => update(active, { evidenceIds: event.target.checked ? [...section.evidenceIds, image.id] : section.evidenceIds.filter(id => id !== image.id) })} /><span className="truncate">{image.caption || "Screenshot"}</span></label>)}</div></div>}</section>
        <section className="panel p-6"><h2 className="text-lg font-semibold">Preview</h2><div className="prose-report mt-4"><Markdown remarkPlugins={[remarkGfm]}>{section.markdown || "*This section is empty.*"}</Markdown></div>{section.evidenceIds.map(id => { const image = images.find(item => item.id === id); return image ? <figure key={id} className="mt-5">{image.url && <Image src={image.url} alt={image.caption || "Challenge screenshot"} width={900} height={500} unoptimized className="h-auto max-h-80 w-auto max-w-full rounded-lg object-contain" />}<figcaption className="mt-2 text-sm text-slate-400">{image.caption || "Screenshot"}</figcaption></figure> : null; })}</section></div></div>
  </div>;
}
