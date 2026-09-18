"use client";
import { Button } from "@/components/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-xl px-6 py-20"><h1 className="text-3xl font-bold">We couldn’t load your workspace.</h1><p className="my-5 text-slate-400">Please try again. If this continues, ask the administrator to check the Supabase connection and migrations.</p><Button onClick={reset}>Try again</Button></main>;
}
