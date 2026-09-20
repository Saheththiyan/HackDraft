"use client";
export default function GlobalError({ reset }: { reset: () => void }) {
  return <html lang="en"><body style={{ fontFamily: "sans-serif", padding: "3rem", maxWidth: "42rem", margin: "auto" }}><h1>HackDraft couldn’t load.</h1><p>Try again. If this continues, contact your workspace administrator.</p><button onClick={reset} style={{ padding: ".75rem 1rem" }}>Try again</button></body></html>;
}
