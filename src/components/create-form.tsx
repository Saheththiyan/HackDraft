"use client";
import { useActionState } from "react";
import { Button } from "@/components/button";

type Action = (data: FormData) => Promise<{ error?: string }>;
export function CreateForm({ action, label, nameLabel, showDetails = false }: { action: Action; label: string; nameLabel: string; showDetails?: boolean }) {
  const [state, submit, pending] = useActionState(async (_state: { error?: string }, data: FormData) => action(data), {});
  return <form action={submit} className="space-y-4">
    <div><label htmlFor={`name-${label}`} className="mb-2 block text-sm font-medium">{nameLabel}</label><input id={`name-${label}`} name="name" className="input" maxLength={200} required placeholder={showDetails ? "e.g. PicoCTF 2026" : "e.g. Hidden in Plain Sight"} /></div>
    {showDetails && <><div><label htmlFor="event_date" className="mb-2 block text-sm font-medium">Event date <span className="text-slate-500">optional</span></label><input id="event_date" name="event_date" type="date" className="input" /></div><div><label htmlFor="description" className="mb-2 block text-sm font-medium">Description <span className="text-slate-500">optional</span></label><textarea id="description" name="description" className="input min-h-24" maxLength={10000} /></div></>}
    {state.error && <p role="alert" className="text-sm text-rose-300">{state.error}</p>}
    <Button disabled={pending}>{pending ? "Creating…" : label}</Button>
  </form>;
}
