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
  return <section className="panel p-6"><h2 className="panel-heading">Choose challenges</h2><p className="mt-1 t-small t-muted">Only reviewed write-ups can be included.</p>
    {reviewed.length ? <div className="mt-5 space-y-2">{reviewed.map(item => <label key={item.id} className="subpanel flex cursor-pointer items-center gap-3 p-3"><input type="checkbox" checked={selected.includes(item.id)} onChange={event => setSelected(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} /><span className="flex-1">{item.name}{item.category && <span className="ml-2 t-xs t-faint">{item.category}</span>}</span></label>)}</div> : <p className="subpanel-dashed mt-5 p-5 t-small">Approve at least one write-up to build a report.</p>}
    {selected.length > 0 && <div className="mt-7"><h3 className="panel-heading">Report order</h3><div className="mt-3 space-y-2">{selected.map((id, index) => { const item = challenges.find(challenge => challenge.id === id)!; return <div key={id} className="subpanel-tint flex items-center gap-2 p-3 t-small"><span className="w-6 t-faint tabular-nums">{index + 1}</span><span className="flex-1">{item.name}</span><button type="button" className="small-action" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${item.name} up`}>↑</button><button type="button" className="small-action" disabled={index === selected.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${item.name} down`}>↓</button></div>; })}</div></div>}
    {unavailable.length > 0 && <div className="mt-7"><h3 className="panel-heading">Needs review</h3><p className="mt-1 t-xs t-muted">These challenges are left out until their write-up is approved.</p><div className="mt-3 space-y-2">{unavailable.map(item => <div key={item.id} className="flex items-center justify-between gap-2 t-small t-muted"><span>{item.name}</span><Link className="link" href={`/dashboard/competitions/${competitionId}/challenges/${item.id}/writeup`}>Open write-up</Link></div>)}</div></div>}
    {error && <p role="alert" className="alert alert-danger mt-5">{error}</p>}<Button className="mt-6" disabled={pending || selected.length === 0} onClick={() => void create()}>{pending ? "Creating report…" : "Save report snapshot"}</Button>
  </section>;
}
