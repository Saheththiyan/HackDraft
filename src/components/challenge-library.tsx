"use client";

import Link from "next/link";
import { useState } from "react";

type Challenge = { id: string; name: string; category: string | null; author_label: string | null; points: number | null; version: number; reviewed_version: number | null; latest_revision_id: string | null };
type Filter = "all" | "captured" | "review" | "reviewed";
const labels: Record<Filter, string> = { all: "All solves", captured: "Captured", review: "Needs review", reviewed: "Reviewed" };
function status(item: Challenge): Filter {
  return item.latest_revision_id && item.reviewed_version === item.version ? "reviewed" : item.latest_revision_id ? "review" : "captured";
}

export function ChallengeLibrary({ competitionId, challenges }: { competitionId: string; challenges: Challenge[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const visible = challenges.filter(item => (filter === "all" || status(item) === filter) && [item.name, item.category, item.author_label].some(value => value?.toLowerCase().includes(query.trim().toLowerCase())));
  return <section className="challenge-library">
    <div className="flex items-end justify-between gap-3"><div><p className="section-kicker">THE FIELD NOTES</p><h2 className="section-heading mt-2">Challenges <span className="library-count">{challenges.length}</span></h2></div></div>
    <div className="library-tools"><label className="library-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input aria-label="Search challenges" placeholder="Find a challenge, category, or author…" value={query} onChange={event => setQuery(event.target.value)} /></label><div className="library-filters" aria-label="Filter challenges by status">{(Object.keys(labels) as Filter[]).map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{labels[value]}<span>{value === "all" ? challenges.length : challenges.filter(item => status(item) === value).length}</span></button>)}</div></div>
    <p className="sr-only" role="status">{visible.length} matching challenges</p>
    <div className="space-y-3">{visible.map(item => <Link key={item.id} href={`/dashboard/competitions/${competitionId}/challenges/${item.id}`} className="item-card challenge-card"><span className="challenge-glyph" aria-hidden="true">{item.category?.slice(0, 2).toUpperCase() || "</>"}</span><span className="min-w-0 flex-1"><span className="block truncate font-bold">{item.name}</span><span className="mt-1 block text-sm text-slate-400">{[item.category, item.author_label].filter(Boolean).join(" · ") || "Add category and author"}</span><span className="status-pill mt-3" data-status={status(item)}>{labels[status(item)]}</span></span><span className="challenge-points">{item.points != null ? <><strong>{item.points}</strong><span>POINTS</span></> : <span aria-hidden="true">↗</span>}</span></Link>)}</div>
    {!visible.length && <div className="library-empty"><span aria-hidden="true">{challenges.length ? "⌕" : "+"}</span><h3>{challenges.length ? "No matching solves" : "Your first solve starts here"}</h3><p>{challenges.length ? "Try another search or select a different status." : "Add a challenge, then capture the clues, commands, and screenshots while they’re fresh."}</p>{challenges.length > 0 && <button className="small-action mt-4" type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button>}</div>}
  </section>;
}
