"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createReportSnapshot } from "@/app/dashboard/report-actions";
import { Button } from "@/components/button";

export function ReportBuilder({ competitionId, challenges }: { competitionId: string; challenges: { id: string; name: string; category: string | null; reviewed: boolean }[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(challenges.filter(item => item.reviewed).map(item => item.id));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const reviewed = challenges.filter(item => item.reviewed);
  const unavailable = challenges.filter(item => !item.reviewed);
  function move(index: number, shift: number) {
    const next = [...selected];
    [next[index], next[index + shift]] = [next[index + shift], next[index]];
    setSelected(next);
  }
  async function create() {
    setPending(true); setError("");
    try {
      const result = await createReportSnapshot(competitionId, selected);
      if (!result.ok) { setError(result.message); return; }
      router.push(`/dashboard/competitions/${competitionId}/reports/${result.id}`);
    } catch { setError("Could not create the report. Please try again."); }
    finally { setPending(false); }
  }
  return <section className="panel p-6"><h2 className="text-xl font-semibold">Choose challenges</h2><p className="mt-2 text-sm text-slate-400">Only reviewed write-ups can enter the final report.</p>
    {reviewed.length ? <div className="mt-5 space-y-2">{reviewed.map(item => <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700 p-3"><input type="checkbox" checked={selected.includes(item.id)} onChange={event => setSelected(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} /><span className="flex-1">{item.name}<span className="ml-2 text-xs text-slate-500">{item.category}</span></span></label>)}</div> : <p className="mt-5 rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-400">Approve at least one challenge write-up to build a report.</p>}
    {selected.length > 0 && <div className="mt-7"><h3 className="font-semibold">Report order</h3><div className="mt-3 space-y-2">{selected.map((id, index) => { const item = challenges.find(challenge => challenge.id === id)!; return <div key={id} className="flex items-center gap-2 rounded-lg bg-slate-800/70 p-3 text-sm"><span className="w-6 text-slate-500">{index + 1}.</span><span className="flex-1">{item.name}</span><button type="button" className="small-action" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${item.name} up`}>↑</button><button type="button" className="small-action" disabled={index === selected.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${item.name} down`}>↓</button></div>; })}</div></div>}
    {unavailable.length > 0 && <div className="mt-7"><h3 className="font-semibold">Needs review</h3><p className="mt-1 text-xs text-slate-400">These challenges will be excluded.</p><div className="mt-3 space-y-2">{unavailable.map(item => <div key={item.id} className="flex items-center justify-between gap-2 text-sm text-slate-400"><span>{item.name}</span><Link className="text-emerald-300 hover:underline" href={`/dashboard/competitions/${competitionId}/challenges/${item.id}/writeup`}>Open write-up</Link></div>)}</div></div>}
    {error && <p role="alert" className="mt-5 text-sm text-rose-300">{error}</p>}<Button className="mt-6" disabled={pending || selected.length === 0} onClick={() => void create()}>{pending ? "Creating report…" : "Save report snapshot"}</Button>
  </section>;
}
