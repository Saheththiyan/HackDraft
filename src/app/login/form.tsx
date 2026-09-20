"use client";
import { useActionState, useState } from "react";
import { signIn } from "./actions";
import { Button } from "@/components/button";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, action, pending] = useActionState(signIn, { error: null });
  return <form action={action} className="space-y-5">
    <div><label htmlFor="email" className="field-label">Team email</label><input id="email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required className="input" /></div>
    <div><label htmlFor="password" className="field-label">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} className="input" /></div>
    {state.error && <p role="alert" className="alert alert-danger">{state.error}</p>}
    <Button type="submit" disabled={pending} className="w-full">{pending ? "Signing in…" : "Open team workspace"}</Button>
  </form>;
}
