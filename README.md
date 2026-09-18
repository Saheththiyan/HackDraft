# HackDraft

Private CTF documentation workspace. Step 1 implements the Next.js foundation, shared-account login, protected dashboard, and Supabase database/storage policies. Challenge capture and report generation are later steps.

## Requirements

Node.js 20.19+ and npm. Local Supabase also requires Docker. The Supabase CLI is installed as a dev dependency.

## Local setup

1. Run `npm ci`.
2. Run `npm run db:start`, then `npm run db:reset` to apply migrations. **Reset deletes local database contents; use only for a disposable development database.**
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

1. Create a Supabase project and apply `supabase/migrations/202609180001_foundation.sql` through its SQL editor, or link the CLI and run `npx supabase db push`.
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

The 36-case transactional pgTAP suite covers owner access, unrelated-account isolation, private storage, administrative provisioning, and parent/workspace consistency. Also manually check login, invalid credentials, sign out, unauthenticated dashboard redirects, and a signed-in account without a workspace.

## Data and storage contract

Every competition belongs to a workspace; every challenge and evidence record carries the same workspace ID as its parent, enforced by composite foreign keys. All four tables use RLS. Authenticated accounts can read only their own workspace, and CRUD only its child records. Anonymous accounts have no table privileges.

Screenshots belong in the private `evidence` bucket under `<workspace-uuid>/<unique-filename>`. Policies allow operations only within the account's workspace prefix. The bucket accepts PNG/JPEG/WebP up to 5 MiB. Evidence metadata references a storage path; database deletes do not delete storage objects, so step 2 must coordinate cleanup. Do not make this bucket public or create broad storage policies.

Schema changes live in versioned migrations. Content revisions, generation runs, report snapshots, and capture endpoints will be introduced with their corresponding features rather than exposing unfinished APIs now.

`GEMINI_API_KEY` and `GEMINI_MODEL` are reserved for step 4 and currently unused. Never expose AI credentials in `NEXT_PUBLIC_*` variables. `.env.local` is ignored by Git.
