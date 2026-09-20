"use client";
import { Button } from "@/components/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-xl px-6 py-20"><h1 className="page-title">We couldn’t load your workspace.</h1><p className="page-lede">Try again. If this continues, ask the administrator to check the Supabase connection and migrations.</p><Button className="mt-6" onClick={reset}>Try again</Button></main>;
}
