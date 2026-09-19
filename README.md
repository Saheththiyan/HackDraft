# HackDraft

Private CTF documentation workspace. Steps 1 and 2 implement the private team workspace, competition dashboard, challenge capture with autosave, and screenshot evidence. Manual write-up editing, AI drafting, and report exports are later steps.

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

1. Create a Supabase project and apply both files in `supabase/migrations/` in filename order through its SQL editor, or link the CLI and run `npx supabase db push`.
2. In Auth settings, **disable Allow new users to sign up** and leave email/password login enabled. Local config does not automatically configure a hosted project's Auth settings.
3. Create and confirm the team user administratively, then insert the workspace as above.
4. Deploy this repository to Vercel. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Use a publishable or legacy anon key, never a secret/service-role key.
5. Set the Supabase Auth Site URL to the deployment URL. Redeploy after changing environment variables.

The app does not expose signup, auto-create workspaces, or use service-role access. Only administrators can provision workspaces. An accidentally created unrelated account still cannot read the team's data.

## Checks

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run db:test` (requires the running local Supabase stack)
- `npx playwright install chromium`, then `npm run test:e2e` (requires local Supabase; creates and cleans up temporary test accounts)

The 48-case transactional pgTAP suite covers owner access, unrelated-account isolation, private storage, administrative provisioning, and parent/workspace consistency. Browser tests cover login, invalid credentials, sign out, unauthenticated dashboard redirects, account isolation, competition/challenge capture, screenshot operations, and stale-tab conflicts.

## Data and storage contract

Every competition belongs to a workspace; every challenge and evidence record carries the same workspace ID as its parent, enforced by composite foreign keys. All four tables use RLS. Authenticated accounts can read only their own workspace, and CRUD only its child records. Anonymous accounts have no table privileges.

Screenshots belong in the private `evidence` bucket under `<workspace-uuid>/<unique-filename>`. Policies allow operations only within the account's workspace prefix. The bucket accepts PNG/JPEG/WebP up to 5 MiB. Evidence metadata references a storage path; the challenge editor removes both evidence metadata and its stored object when you delete a screenshot. Administrators who delete challenges or competitions directly through SQL must clean up their storage objects separately. Do not make this bucket public or create broad storage policies.

Schema changes live in versioned migrations. Capture mutations use authenticated Server Actions and transactional database functions. Each challenge save, screenshot attach, order/caption change, and removal increments a version; stale browsers receive a conflict without overwriting newer work. AI generations, write-up revisions, and report snapshots will be added in later steps.

The challenge editor accepts PNG/JPEG/WebP screenshots up to 5 MiB, by file selection, drag-and-drop, or paste. Captions save when you leave the field; a warning appears if you navigate away with unsaved edits. Screenshots are private and viewed through time-limited signed URLs.

`GEMINI_API_KEY` and `GEMINI_MODEL` are reserved for step 4 and currently unused. Never expose AI credentials in `NEXT_PUBLIC_*` variables. `.env.local` is ignored by Git.
