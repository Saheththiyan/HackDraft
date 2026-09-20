# Production release

HackDraft is a private workspace for one shared team account. Deploy to Vercel with hosted Supabase. The app uses the publishable key plus the user's session; no service-role key belongs in the deployment.

## 1. Release checks

Use Node 22 (`nvm use`) and `npm ci`. With local Docker/Supabase available:

```sh
npm run db:start
npx supabase migration up --local --yes
npm run lint
npm run typecheck
npm run test:ai
npm run test:config
npm run db:test
npm run test:production
npm audit --omit=dev --audit-level=high
```

`test:production` builds and starts Next in production mode against temporary accounts in LOCAL Supabase. It covers authentication, isolation, autosave/retry, stale edits, uploads, themes, and PDF/DOCX output. It uses `.next-e2e`, leaving the normal development build alone. Install Chromium with `npx playwright install chromium`; report assertions also require `pdftotext`, `pdfimages` (Poppler), and `unzip`. The GitHub release workflow installs these and runs the checks without hosted credentials.

The live Gemini check is opt-in: `npm run test:ai:live` makes one real request using synthetic notes and requires your server API key. Default release tests never spend Gemini quota.

## 2. Hosted Supabase

Apply **all** `supabase/migrations/*.sql` in filename order. For a linked CLI project, review `npx supabase db push --dry-run` before `npx supabase db push`; alternatively use the SQL editor. This release adds `202609200001_ai_rate_limit.sql`. Apply it before deploying the code. Never run `db:reset` against valuable data.

Disable public signup in Authentication settings, retain email/password login, and create/confirm the team user administratively. Insert its workspace using the SQL in README. Set the Auth Site URL to your final HTTPS deployment URL. Verify the account recovery email. Use a separate Supabase project for previews or protect preview access; do not point public previews at the production team's data.

Confirm the `evidence` bucket is private, accepts PNG/JPEG/WebP up to 5 MiB, and has the workspace policies from the migrations. Confirm RLS on all app tables. The new AI counter table is inaccessible to browser clients; its function checks workspace ownership and atomically allows five requests per minute per workspace. Failed provider requests consume a slot. This is a burst limit, not a spending cap: set provider quotas/budget alerts separately.

## 3. Vercel configuration

Import with the Next.js preset. Select Node 22, installation `npm ci`, build `npm run build:production`, and the default output directory. This build command fails early on unsafe or missing production configuration. Set these in the **Production** environment:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Hosted project HTTPS URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key or legacy `anon` key |
| `GEMINI_API_KEY` | Server-only Gemini key |
| `GEMINI_MODEL` | Model ID verified with your key; app default is `gemini-3.6-flash` |

Do not set `HACKDRAFT_E2E` in a deployment. Run `npm run check:production` with your intended production variables in the environment (it also reads `.env.local` without overriding existing variables). It validates configuration without displaying secrets or contacting services. It does **not** prove the credentials, migrations, or model are live; complete the smoke test below. Rebuild when changing either `NEXT_PUBLIC_` value since these values are bundled into the browser. Manual writing/export works without Gemini, but preflight requires its key for the intended full feature set.

The write-up page declares a 60-second function budget so the 45-second Gemini timeout can return a usable error. Confirm hosting supports this duration. Serve over HTTPS. Response headers prevent framing and MIME sniffing and suppress referrer sharing. The CSP restricts framing, base URLs, and objects; it is not a full script-source policy.

## 4. Hosted smoke test

Use a temporary competition in your team workspace:

1. Open a private URL while signed out; confirm redirect to login. Try invalid credentials, then sign in.
2. Capture notes, commands, flag, and screenshots. Reload to verify saves. Temporarily disconnect: failed saves must preserve visible edits and Retry must save them after reconnection.
3. Generate a Gemini draft, review its sections, apply and approve. Existing text must stay intact until Apply.
4. Save a report snapshot and open PDF and DOCX. Check the cover, long/code-heavy content, team-used Unicode, captions, and pagination in a real PDF reader and Word/LibreOffice.
5. Edit the original challenge; it should need review again while the saved report stays unchanged. Check both themes and mobile.
6. Sign out and confirm private pages are inaccessible. Keep automated fixture suites local; never run them against production.

## 5. Operations and recovery

- Monitor Vercel errors/timeouts, Supabase database/storage usage and Auth logs, and Gemini quota. Do not log flags, notes, cookies, API keys, or signed screenshot URLs.
- Configure database backups appropriate to your Supabase plan **and a separate backup of private evidence files**. Database backups do not restore actual Storage objects. Keep encrypted file backups at their original paths and rehearse restoring database plus files into a separate project. Verify old snapshots and both exports after restoration.
- Download final reports after each competition: they are generated in the browser, not stored as files on the server. Large screenshot-heavy reports use substantial browser memory; split very large competitions into smaller snapshots if necessary.
- Screenshot preview URLs expire after an hour; reload to renew them. Exports fetch private files with the current session. After session expiry, sign in again. Copy unsaved text before refreshing or leaving: offline edits are only in the current page, not a durable local draft.
- Interrupted uploads may leave unreferenced files. Administrative cleanup must check both `evidence.storage_path` and `snapshot_assets.storage_path` before deletion. Never delete a file merely because its challenge no longer uses it.
- Roll back code by redeploying the previous known-good commit. The additive rate-limit migration may remain. Do not drop snapshot tables or edit applied migrations; use a reviewed forward migration or restore into a separate project.

References: [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod), [Supabase backup restoration](https://supabase.com/docs/guides/platform/clone-project), [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration).
