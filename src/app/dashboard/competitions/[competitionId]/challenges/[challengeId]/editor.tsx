"use client";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent, type ClipboardEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { attachEvidence, removeEvidence, saveChallenge, saveEvidenceOrder } from "@/app/dashboard/actions";
import { Button } from "@/components/button";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { ChallengeInput, ChallengeRecord, Evidence } from "@/lib/capture";

const acceptedTypes: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const solveHistoryPrompt = "Using our conversation about this CTF challenge, write a factual, chronological account of how we solved it. Include the initial clues, each important step, the exact commands or code that mattered, what their output showed, how we recovered the flag, and any uncertainty. Separate attempts that failed from the final working method. Do not invent missing steps or claim you ran tools you did not run. Return plain text I can paste into HackDraft's ‘How we solved it’ field.";
type Status = "saved" | "unsaved" | "saving" | "conflict" | "error";
function draftOf(challenge: ChallengeRecord): ChallengeInput {
  const { name, category, points, author_label, description, source_notes, commands, flag } = challenge;
  return { name, category, points, author_label, description, source_notes, commands, flag };
}
export function ChallengeEditor({ challenge }: { challenge: ChallengeRecord }) {
  const router = useRouter();
  const [draft, setDraft] = useState<ChallengeInput>(() => draftOf(challenge));
  const [evidence, setEvidence] = useState<Evidence[]>(challenge.evidence);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("saved");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [openingWriteup, setOpeningWriteup] = useState(false);
  const latest = useRef(draftOf(challenge));
  const saved = useRef(JSON.stringify(draftOf(challenge)));
  const savedEvidence = useRef(JSON.stringify(challenge.evidence.map(({ id, caption }) => ({ id, caption }))));
  const version = useRef(challenge.version);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePromise = useRef<Promise<boolean> | null>(null);
  const blocked = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [supabase] = useState(createBrowserSupabase);

  useEffect(() => {
    let active = true;
    Promise.all(challenge.evidence.map(async item => {
      const { data } = await supabase.storage.from("evidence").createSignedUrl(item.storage_path, 3600);
      return [item.id, data?.signedUrl ?? ""] as const;
    })).then(entries => { if (active) setUrls(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [challenge.evidence, supabase]);
  useEffect(() => {
    const warning = (event: BeforeUnloadEvent) => {
      if (saved.current !== JSON.stringify(latest.current) || savedEvidence.current !== JSON.stringify(evidence.map(({ id, caption }) => ({ id, caption }))) || savePromise.current || busy) event.preventDefault();
    };
    window.addEventListener("beforeunload", warning);
    return () => window.removeEventListener("beforeunload", warning);
  }, [busy, evidence]);

  const persist = useCallback(async (): Promise<boolean> => {
    if (blocked.current) return false;
    if (savePromise.current) return savePromise.current;
    const snapshot = { ...latest.current };
    const serialized = JSON.stringify(snapshot);
    if (saved.current === serialized) return true;
    setStatus("saving");
    const work = (async () => {
      try {
        const result = await saveChallenge(challenge.id, version.current, snapshot);
        if (!result.ok) {
          setStatus(result.reason === "conflict" ? "conflict" : "error");
          setMessage(result.message);
          if (result.reason === "conflict") blocked.current = true;
          return false;
        }
        version.current = result.version;
        saved.current = serialized;
        const stillDirty = JSON.stringify(latest.current) !== serialized;
        setStatus(stillDirty ? "unsaved" : "saved");
        setMessage("");
        return true;
      } catch {
        setStatus("error");
        setMessage("Could not reach the server. Your changes remain on this page; use Retry save.");
        return false;
      }
    })();
    savePromise.current = work;
    let succeeded = false;
    try { succeeded = await work; return succeeded; } finally {
      savePromise.current = null;
      if (succeeded && !blocked.current && saved.current !== JSON.stringify(latest.current)) {
        timer.current = setTimeout(() => { void persist(); }, 850);
      }
    }
  }, [challenge.id]);
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    if (savePromise.current) await savePromise.current;
    return persist();
  }, [persist]);
  useEffect(() => {
    if (status !== "unsaved" || blocked.current) return;
    timer.current = setTimeout(() => { void persist(); }, 850);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [draft, status, persist]);
  function change<K extends keyof ChallengeInput>(field: K, value: ChallengeInput[K]) {
    const next = { ...latest.current, [field]: value };
    latest.current = next;
    setDraft(next);
    if (!blocked.current) setStatus(saved.current === JSON.stringify(next) ? "saved" : "unsaved");
  }
  async function upload(file: File) {
    if (!acceptedTypes[file.type] || file.size > 5 * 1024 * 1024) {
      setMessage("Use a PNG, JPEG, or WebP image no larger than 5 MB.");
      return;
    }
    if (evidence.length >= 100) { setMessage("This challenge already has 100 screenshots."); return; }
    if (!(await flush())) return;
    setBusy(true);
    setMessage("");
    const path = `${challenge.workspace_id}/${challenge.id}/${crypto.randomUUID()}.${acceptedTypes[file.type]}`;
    try {
      const { error: uploadError } = await supabase.storage.from("evidence").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const result = await attachEvidence(challenge.id, version.current, path, "");
      if (!result.ok) {
        await supabase.storage.from("evidence").remove([path]);
        setStatus(result.reason === "conflict" ? "conflict" : "error");
        setMessage(result.message);
        if (result.reason === "conflict") blocked.current = true;
        return;
      }
      version.current = result.version;
      const { data } = await supabase.from("evidence").select("id, storage_path, caption, position").eq("challenge_id", challenge.id).eq("storage_path", path).single();
      if (!data) throw new Error("Image attached, but could not load its details. Reload the page.");
      const { data: signed } = await supabase.storage.from("evidence").createSignedUrl(path, 3600);
      setEvidence(current => { const next = [...current, data]; savedEvidence.current = JSON.stringify(next.map(({ id, caption }) => ({ id, caption }))); return next; });
      if (signed?.signedUrl) setUrls(current => ({ ...current, [data.id]: signed.signedUrl }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image upload failed. Try again.");
    } finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  }
  async function uploadFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) await upload(file);
  }
  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void uploadFiles(event.dataTransfer.files);
  }
  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    const files = Array.from(event.clipboardData.files).filter(file => file.type.startsWith("image/"));
    if (files.length) { event.preventDefault(); void uploadFiles(files); }
  }
  async function updateImages(next: Evidence[]) {
    if (!(await flush())) return;
    setBusy(true);
    try {
      const result = await saveEvidenceOrder(challenge.id, version.current, next.map(({ id, caption }) => ({ id, caption })));
      if (!result.ok) {
        setStatus(result.reason === "conflict" ? "conflict" : "error");
        setMessage(result.message);
        if (result.reason === "conflict") blocked.current = true;
        return;
      }
      version.current = result.version;
      savedEvidence.current = JSON.stringify(next.map(({ id, caption }) => ({ id, caption })));
      setEvidence(next.map((item, position) => ({ ...item, position })));
      setStatus(saved.current === JSON.stringify(latest.current) ? "saved" : "unsaved");
      setMessage("");
    } catch { setStatus("error"); setMessage("Could not save screenshot changes. Try again."); }
    finally { setBusy(false); }
  }
  async function deleteImage(item: Evidence) {
    if (!(await flush())) return;
    if (!window.confirm("Remove this screenshot from the challenge?")) return;
    setBusy(true);
    try {
      const result = await removeEvidence(challenge.id, version.current, item.id);
      if (!result.ok) {
        setStatus(result.reason === "conflict" ? "conflict" : "error");
        setMessage(result.message);
        if (result.reason === "conflict") blocked.current = true;
        return;
      }
      version.current = result.version;
      setEvidence(current => { const next = current.filter(image => image.id !== item.id); savedEvidence.current = JSON.stringify(next.map(({ id, caption }) => ({ id, caption }))); return next; });
      setStatus(saved.current === JSON.stringify(latest.current) ? "saved" : "unsaved");
      setMessage("");
    } catch { setStatus("error"); setMessage("Could not remove screenshot. Try again."); }
    finally { setBusy(false); }
  }
  const statusText = { saved: "Saved", unsaved: "Unsaved changes", saving: "Saving…", conflict: "Edit conflict", error: "Save failed" }[status];
  async function copySolvePrompt() {
    try { await navigator.clipboard.writeText(solveHistoryPrompt); setPromptCopied(true); }
    catch { setMessage("Could not copy the prompt. Select and copy it below instead."); }
  }
  async function openWriteup() {
    setOpeningWriteup(true);
    try { if (await flush()) router.push(`/dashboard/competitions/${challenge.competition_id}/challenges/${challenge.id}/writeup`); }
    finally { setOpeningWriteup(false); }
  }
  return <div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><h1 className="text-4xl font-bold">{draft.name || "Untitled challenge"}</h1><div className="flex items-center gap-3"><span role="status" className={`text-sm ${status === "saved" ? "text-emerald-300" : status === "unsaved" || status === "saving" ? "text-amber-300" : "text-rose-300"}`}>{statusText}</span><Button variant="outline" onClick={() => void flush()} disabled={busy || status === "saving" || status === "saved" || status === "conflict"}>Save now</Button><Button onClick={() => void openWriteup()} disabled={busy || openingWriteup || status === "conflict"}>{openingWriteup ? "Opening…" : "Generate / review write-up →"}</Button></div></div>
    <p className="mt-3 text-slate-400">Capture the solve once here, then generate and review the report write-up.</p>
    {message && <div role="alert" className="mt-6 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">{message}{status === "error" && <button type="button" onClick={() => { if (savedEvidence.current !== JSON.stringify(evidence.map(({ id, caption }) => ({ id, caption })))) void updateImages(evidence); else if (saved.current !== JSON.stringify(latest.current)) void flush(); else window.location.reload(); }} className="ml-2 underline">Retry or reload</button>}{status === "conflict" && <button type="button" onClick={() => window.location.reload()} className="ml-2 underline">Reload latest</button>}</div>}
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]"><section className="panel space-y-6 p-6"><h2 className="text-xl font-semibold">Challenge details</h2>
      <Field label="Challenge name" id="challenge-name"><input id="challenge-name" className="input" value={draft.name} onChange={event => change("name", event.target.value)} maxLength={200} /></Field>
      <div className="grid gap-5 sm:grid-cols-2"><Field label="Category" id="category"><input id="category" className="input" value={draft.category} onChange={event => change("category", event.target.value)} maxLength={100} placeholder="Forensics, Web, Crypto…" /></Field><Field label="Points" id="points"><input id="points" type="number" min={0} max={1000000} className="input" value={draft.points ?? ""} onChange={event => change("points", event.target.value === "" ? null : Number(event.target.value))} /></Field></div>
      <Field label="Author name" id="author"><input id="author" className="input" value={draft.author_label} onChange={event => change("author_label", event.target.value)} maxLength={100} placeholder="Who solved it?" /></Field>
      <Field label="Challenge prompt or description" id="challenge-description"><textarea id="challenge-description" className="input min-h-28" value={draft.description} onChange={event => change("description", event.target.value)} maxLength={10000} placeholder="Paste the original challenge prompt…" /></Field>
      <div><Field label="How we solved it" id="source-notes"><textarea id="source-notes" className="input min-h-64 font-mono text-sm" value={draft.source_notes} onChange={event => change("source_notes", event.target.value)} maxLength={100000} placeholder="Write or paste the full solve: clues, steps, commands, outputs, and how you found the flag…" /></Field><p className="mt-2 text-sm text-slate-400">One detailed account is enough. Gemini will organize these notes into the report sections.</p><details className="mt-3 rounded-lg border border-slate-700 p-3 text-sm"><summary className="cursor-pointer font-medium text-emerald-300">Used an LLM to solve it? Get the procedure from that chat</summary><p className="mt-3 text-slate-400">Paste this prompt into the same chat, then paste its answer above. Review the answer against what you actually did.</p><p className="mt-3 select-text rounded-lg bg-slate-950 p-3 text-slate-300">{solveHistoryPrompt}</p><Button className="mt-3" variant="outline" onClick={() => void copySolvePrompt()}>{promptCopied ? "Prompt copied" : "Copy prompt"}</Button></details></div>
      <Field label="Commands, code, and output" id="commands"><textarea id="commands" className="input min-h-44 font-mono text-sm" value={draft.commands} onChange={event => change("commands", event.target.value)} maxLength={50000} placeholder="Keep exact commands and output here…" /></Field>
      <Field label="Flag (optional)" id="flag"><input id="flag" className="input font-mono" value={draft.flag} onChange={event => change("flag", event.target.value)} maxLength={2000} autoComplete="off" placeholder="CTF{...}" /></Field>
    </section><aside className="panel h-fit p-6" onDrop={onDrop} onDragOver={event => event.preventDefault()} onPaste={onPaste}><h2 className="text-xl font-semibold">Screenshots <span className="text-slate-500">{evidence.length}</span></h2><p className="mt-2 text-sm text-slate-400">Paste, drop, or select images. PNG, JPEG, and WebP up to 5 MB each.</p><input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" aria-label="Choose screenshots" onChange={(event: ChangeEvent<HTMLInputElement>) => { if (event.target.files) void uploadFiles(event.target.files); }} /><Button className="mt-4 w-full" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy || status === "conflict"}>{busy ? "Working…" : "Add screenshots"}</Button><div className="mt-6 space-y-5">{evidence.map((item, index) => <div key={item.id} className="rounded-xl border border-slate-700 p-3">{urls[item.id] ? <Image src={urls[item.id]} alt={item.caption || `Screenshot ${index + 1}`} width={640} height={360} unoptimized className="max-h-52 w-full rounded-lg object-contain" /> : <div className="rounded-lg bg-slate-800 p-8 text-center text-sm text-slate-400">Loading image…</div>}<label className="mt-3 block text-xs text-slate-400" htmlFor={`caption-${item.id}`}>Caption</label><input id={`caption-${item.id}`} className="input mt-1 text-sm" value={item.caption} onChange={event => { setEvidence(current => current.map(image => image.id === item.id ? { ...image, caption: event.target.value } : image)); setStatus("unsaved"); }} disabled={busy || status === "conflict"} onBlur={() => { if (savedEvidence.current !== JSON.stringify(evidence.map(({ id, caption }) => ({ id, caption })))) void updateImages(evidence); }} maxLength={500} placeholder="What does this show?" /><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="small-action" disabled={busy || index === 0 || status === "conflict"} onClick={() => { const next = [...evidence]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; void updateImages(next); }}>↑ Up</button><button type="button" className="small-action" disabled={busy || index === evidence.length - 1 || status === "conflict"} onClick={() => { const next = [...evidence]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; void updateImages(next); }}>↓ Down</button><button type="button" className="small-action text-rose-300" disabled={busy || status === "conflict"} onClick={() => void deleteImage(item)}>Remove</button></div></div>)}{!evidence.length && <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">Drop images here as you solve the challenge.</div>}</div></aside></div>
  </div>;
}
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div><label htmlFor={id} className="mb-2 block text-sm font-medium">{label}</label>{children}</div>; }
