"use client";

import Link from "next/link";
import { useState } from "react";

type Challenge = { id: string; name: string; category: string | null; author_label: string | null; points: number | null; version: number; reviewed_version: number | null; latest_revision_id: string | null };
type Filter = "all" | "captured" | "review" | "reviewed";
const labels: Record<Filter, string> = { all: "All", captured: "Captured", review: "Needs review", reviewed: "Reviewed" };
function status(item: Challenge): Filter {
  return item.latest_revision_id && item.reviewed_version === item.version ? "reviewed" : item.latest_revision_id ? "review" : "captured";
}

export function ChallengeLibrary({ competitionId, challenges }: { competitionId: string; challenges: Challenge[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const visible = challenges.filter(item => (filter === "all" || status(item) === filter) && [item.name, item.category, item.author_label].some(value => value?.toLowerCase().includes(query.trim().toLowerCase())));
  return <section className="challenge-library">
    <div className="section-head"><h2 className="section-heading">Challenges<span className="count">{challenges.length}</span></h2></div>
    <div className="library-tools"><label className="library-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input aria-label="Search challenges" placeholder="Search by name, category, or author" value={query} onChange={event => setQuery(event.target.value)} /></label><div className="library-filters" aria-label="Filter challenges by status">{(Object.keys(labels) as Filter[]).map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{labels[value]}<span>{value === "all" ? challenges.length : challenges.filter(item => status(item) === value).length}</span></button>)}</div></div>
    <p className="sr-only" role="status">{visible.length} matching challenges</p>
    {visible.length > 0 && <div className="challenge-list">{visible.map(item => <Link key={item.id} href={`/dashboard/competitions/${competitionId}/challenges/${item.id}`} className="challenge-card"><span className="challenge-glyph" aria-hidden="true">{item.category?.slice(0, 2).toUpperCase() || "—"}</span><span className="min-w-0 flex-1"><span className="challenge-title">{item.name}</span><span className="challenge-meta">{[item.category, item.author_label].filter(Boolean).join(" · ") || "No category or author yet"}</span><span className="status-pill" data-status={status(item)}>{labels[status(item)]}</span></span>{item.points != null && <span className="challenge-points"><strong>{item.points}</strong><span>points</span></span>}</Link>)}</div>}
    {!visible.length && <div className="empty"><h3>{challenges.length ? "No matching solves" : "No challenges yet"}</h3><p>{challenges.length ? "Try another search or a different status." : "Add a challenge, then capture the clues, commands, and screenshots while they’re fresh."}</p>{challenges.length > 0 && <button className="small-action mt-4" type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button>}</div>}
  </section>;
}
