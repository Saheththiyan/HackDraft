# HackDraft

Private CTF documentation workspace. Steps 1–3 implement the private team workspace, competition dashboard, challenge capture with autosave and screenshot evidence, manual write-ups with review, and saved PDF reports. AI drafting and additional export formats are later steps.

## Requirements

Node.js 20.19+ and npm. Local Supabase also requires Docker. The Supabase CLI is installed as a dev dependency.

## Local setup

1. Run `npm ci`.
2. Run `npm run db:start`, then `npx supabase migration up --local --yes` to apply pending migrations. For a fresh disposable local database, `npm run db:reset` also works, but **it deletes local database contents**.
3. Copy `.env.example` to `.env.local`. Set the URL and publishable key (or local anon key) shown by `npx supabase status`. No service-role key is needed by the app.
4. Open Supabase Studio at http://127.0.0.1:54323. Under Authentication → Users, create the shared email/password user and confirm its email. Public signup is disabled in `supabase/config.toml`.
5. In the SQL editor, provision its workspace using the actual user UUID:

   ```sql
   insert into public.workspaces (owner_id, name)
   values ('REPLACE_WITH_AUTH_USER_UUID', 'Your CTF team');
   ```

6. Run `npm run dev`, open http://localhost:3000, and sign in. The root routes to the private dashboard; without valid environment settings it shows setup instructions.

Everyone shares these credentials. Author labels and individual permissions are not implemented. Keep the account recovery email under team control.

## Hosted setup

1. Create a Supabase project and apply the files in `supabase/migrations/` in filename order through its SQL editor, or link the CLI and run `npx supabase db push`.
2. In Auth settings, **disable Allow new users to sign up** and leave email/password login enabled. Local config does not automatically configure a hosted project's Auth settings.
3. Create and confirm the team user administratively, then insert the workspace as above.
4. Deploy this repository to Vercel. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Use a publishable or legacy anon key, never a secret/service-role key.
5. Set the Supabase Auth Site URL to the deployment URL. Redeploy after changing environment variables.

The app does not expose signup, auto-create workspaces, or use service-role access. Only administrators can provision workspaces. An accidentally created unrelated account still cannot read the team's data.

## Write-ups and reports

1. Open a challenge and select **Write write-up**. Fill in the overview, solution steps, and result; context and lessons are optional. Markdown and fenced code blocks are supported. Attach any uploaded screenshots to the relevant section.
2. The write-up saves automatically after edits. Select **Approve write-up** when it is ready. Changing the challenge or its screenshots later clears the reviewed status until you approve it again.
3. Open **Reports** from the competition page. Select reviewed challenges, arrange their order, and save a report snapshot. The snapshot keeps the write-up text and referenced screenshots as they were at creation, even if the live challenge is edited or its screenshot is removed later.
4. Open a saved snapshot to preview it and select **Download PDF**. The browser downloads the private screenshots and builds an A4 report with a cover, contents, challenge summary, and write-up sections. The PDF is generated locally in the signed-in browser; no report file is stored in Supabase.

For a fresh local setup, follow **Local setup** first. For an existing local database, start Supabase and apply the new migration with `npx supabase migration up --local --yes` before using write-ups. PDF export works best in a current Chromium, Firefox, or Safari browser. DOCX export and Gemini-assisted drafting are planned for later steps.

## Checks

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run db:test` (requires the running local Supabase stack)
- `npx playwright install chromium`, then `npm run test:e2e` (requires local Supabase; creates and cleans up temporary test accounts)

The 66-case transactional pgTAP suite covers owner access, unrelated-account isolation, private storage, administrative provisioning, parent/workspace consistency, revision approval, and immutable report snapshots. Browser tests cover login, invalid credentials, sign out, unauthenticated dashboard redirects, account isolation, challenge capture, screenshots, stale-tab conflicts, and the full write-up-to-PDF workflow.

## Data and storage contract

Every competition belongs to a workspace; every challenge and evidence record carries the same workspace ID as its parent, enforced by composite foreign keys. All four tables use RLS. Authenticated accounts can read only their own workspace, and CRUD only its child records. Anonymous accounts have no table privileges.

Screenshots belong in the private `evidence` bucket under `<workspace-uuid>/<unique-filename>`. Policies allow operations only within the account's workspace prefix. The bucket accepts PNG/JPEG/WebP up to 5 MiB. Evidence metadata references a storage path. The challenge editor removes the stored object when you delete a screenshot unless a saved report references it; in that case the object remains available to the report. Administrators who delete challenges or competitions directly through SQL must clean up their storage objects separately. Do not make this bucket public or create broad storage policies.

Schema changes live in versioned migrations. Capture and report mutations use authenticated Server Actions and transactional database functions. Each challenge save, screenshot attach, order/caption change, and removal increments a version; stale browsers receive a conflict without overwriting newer work. Write-up revisions and report snapshots are append-only. AI generation will be added in a later step.

The challenge editor accepts PNG/JPEG/WebP screenshots up to 5 MiB, by file selection, drag-and-drop, or paste. Captions save when you leave the field; a warning appears if you navigate away with unsaved edits. Screenshots are private and viewed through time-limited signed URLs.

`GEMINI_API_KEY` and `GEMINI_MODEL` are reserved for step 4 and currently unused. Never expose AI credentials in `NEXT_PUBLIC_*` variables. `.env.local` is ignored by Git.
