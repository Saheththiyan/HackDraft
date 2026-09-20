# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

HackDraft is a private, single-team CTF write-up workspace: Next.js 16 (App Router, React 19, Tailwind 4) on top of Supabase (Postgres + RLS + private storage), with optional Gemini drafting. There is no public signup and no service-role key in the app; one shared email/password account owns one `workspaces` row, provisioned by hand (see README "Local setup").

## Commands

```
npm run dev                 # next dev on :3000
npm run build               # next build --webpack
npm run lint                # eslint (flat config, eslint-config-next)
npm run typecheck           # tsc --noEmit
npm run db:start / db:stop  # local Supabase (needs Docker)
npx supabase migration up --local --yes   # apply pending migrations (non-destructive)
npm run db:reset            # DESTROYS local DB, replays migrations
npm run db:test             # pgTAP suite in supabase/tests/database/ (needs db:start)
npm run test:ai             # node --test tests/gemini.test.mjs (mocked fetch, no key)
npm run test:ai:live        # one real Gemini call; needs GEMINI_API_KEY + local Supabase
npm run test:e2e            # playwright test (needs db:start; `npx playwright install chromium` once)
npx playwright test tests/capture.spec.ts            # single e2e file
npx playwright test -g "stale tab"                   # single e2e test by title
npx supabase test db supabase/tests/database/reports.test.sql   # single pgTAP file
```

E2E notes: `playwright.config.ts` shells out to `supabase status` to pull the local URL/keys and *refuses to run against a non-localhost API*. It starts its own `next dev` on `127.0.0.1:3100` with `HACKDRAFT_E2E=1`, which switches `distDir` to `.next-e2e` so it never clobbers a running dev build. Tests create throwaway auth users + workspaces via the admin key and delete them in `afterAll`. Runs are serial (`workers: 1`).

pgTAP files each `begin;` … and roll back; the `plan(N)` count at the top must match the number of assertions or the file fails.

Env: copy `.env.example` → `.env.local`. `src/lib/env.ts` treats a key starting with `replace-` as unconfigured, and the app then routes to `/setup` instead of erroring.

## Architecture

### Request/auth path
- `src/proxy.ts` (Next 16's replacement for middleware) runs on `/`, `/login`, `/dashboard/*`: refreshes the Supabase session cookie and sets `Cache-Control: private, no-store`. It does **not** authorize.
- Every private page/action calls `requireUser()` from `src/lib/auth.ts`, which redirects to `/setup` (no env) or `/login` (no user) and returns `{ supabase, user }`.
- Three Supabase clients: `lib/supabase/server.ts` (cookies-based, server-only), `lib/supabase/browser.ts` (client; used for storage uploads and signed URLs), and the one built inline in `proxy.ts`.

### Write path: Server Actions → Postgres RPCs
All mutations live in three `"use server"` files under `src/app/dashboard/`:
- `actions.ts` — competitions, challenges, evidence (`save_challenge`, `attach_evidence`, `update_evidence_order`, `remove_evidence`)
- `report-actions.ts` — `save_writeup`, `approve_writeup`, `create_report_snapshot`
- `ai-actions.ts` — `generateWriteupDraft` (calls Gemini, returns a draft; never writes to DB)

Pattern: validate with zod (schemas in `src/lib/capture.ts` and `src/lib/writeup.ts`, shared with the client), `requireUser()`, then `supabase.rpc(...)`. The SQL functions in `supabase/migrations/` are the real business logic. Capture functions (`202609190001_capture.sql`) are `security invoker` behind RLS; the write-up/report functions (`202609190002`) are `security definer` because the revision/snapshot tables are select-only for `authenticated`, so each one re-checks `w.owner_id = auth.uid()` itself. Keep that check in any new definer function, and put transactional logic in SQL rather than TS.

### Optimistic concurrency
`challenges.version` is bumped by every RPC. Actions take `expectedVersion`; the SQL raises `version_conflict`, which the actions map to `{ ok: false, reason: "conflict" }`. Client editors (`editor.tsx`, `writeup-editor.tsx`) hold `version` in a ref, update it from each successful result, and stop autosaving on conflict so the user can copy their text. Keep this contract when adding fields or new mutations. Other SQL error tokens the actions string-match: `incomplete_writeup`, `challenge_not_reviewed`.

### Data model invariants (enforced in SQL, tested in pgTAP)
- `workspaces` → `competitions` → `challenges` → `evidence`; every child carries `workspace_id` and composite FKs keep it consistent with its parent. RLS: `owner_id = auth.uid()` on the workspace, joined down from there.
- `writeup_revisions` and `report_snapshots`/`snapshot_assets` are append-only; `challenges.latest_revision_id` / `approved_revision_id` (+ `reviewed_version`) point at them. Any challenge/evidence/write-up change nulls `approved_revision_id`, so the challenge must be re-approved before it can go in a snapshot.
- Storage bucket `evidence` is private; paths are `<workspace-uuid>/<file>` and policies are prefix-scoped. `removeEvidence` only deletes the storage object if no `snapshot_assets` row references the path (snapshots keep their screenshots).
- Write-ups are exactly five sections with fixed ids (`sectionIds` in `lib/writeup.ts`); `readyForReview` requires overview/solution/result to be non-empty.

### Gemini
`src/lib/gemini.mjs` is plain ESM (no TS) so `node --test` can import it directly; it takes an injectable `fetch` for mocking. It POSTs to the REST `generateContent` endpoint with a JSON response schema. Only server code touches `GEMINI_API_KEY`; never move it to `NEXT_PUBLIC_*`. Screenshot files are never sent — only captions.

### Reports
`report-viewer.tsx` downloads screenshots through the browser Supabase client and builds the PDF (`components/report/pdf-export.tsx`, `@react-pdf/renderer`) and DOCX (`components/report/docx-export.ts`, `docx`) entirely client-side. Nothing report-shaped is stored beyond the JSON snapshot in `report_snapshots.content` (validated by `snapshotSchema`).

### UI
Theme is a `data-theme` attribute on `<html>`, set by an inline script in `app/layout.tsx` from `localStorage['hackdraft-theme']` before hydration; styling tokens live in `app/globals.css`. Components are small and hand-rolled (`components/button.tsx` uses cva) — there is no component library.

## Conventions worth knowing
- Migrations are timestamped `YYYYMMDDNNNN_name.sql`; add a new file rather than editing an applied one, and extend the pgTAP suites alongside.
- Next config sets `experimental.useTypeScriptCli: false` and builds with `--webpack`; don't switch to Turbopack without checking the e2e `distDir` trick still works.
- Source files favor dense, single-line JSX and compact functions; match that density rather than reformatting.
