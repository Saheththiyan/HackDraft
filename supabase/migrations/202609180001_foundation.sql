-- Provision the shared account and workspace administratively. Clients cannot create workspaces.
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);
create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  competition_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 200),
  category text,
  source_notes text not null default '',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (competition_id, workspace_id) references public.competitions(id, workspace_id) on delete cascade
);
create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  challenge_id uuid not null,
  storage_path text not null unique,
  caption text not null default '',
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  foreign key (challenge_id, workspace_id) references public.challenges(id, workspace_id) on delete cascade,
  check (split_part(storage_path, '/', 1) = workspace_id::text)
);
create index competitions_workspace_idx on public.competitions(workspace_id);
create index challenges_competition_idx on public.challenges(competition_id, workspace_id);
create index evidence_challenge_idx on public.evidence(challenge_id, workspace_id);

alter table public.workspaces enable row level security;
alter table public.competitions enable row level security;
alter table public.challenges enable row level security;
alter table public.evidence enable row level security;
revoke all on public.workspaces, public.competitions, public.challenges, public.evidence from anon, authenticated;
grant select on public.workspaces to authenticated;
grant select, insert, update, delete on public.competitions, public.challenges, public.evidence to authenticated;
grant all on public.workspaces, public.competitions, public.challenges, public.evidence to service_role;
create policy workspace_read on public.workspaces for select to authenticated using (owner_id = (select auth.uid()));

-- Scope every operation through a workspace visible to the current account.
do $$
declare table_name text;
begin
  foreach table_name in array array['competitions', 'challenges', 'evidence'] loop
    execute format('create policy owner_read on public.%I for select to authenticated using (workspace_id in (select id from public.workspaces))', table_name);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check (workspace_id in (select id from public.workspaces))', table_name);
    execute format('create policy owner_update on public.%I for update to authenticated using (workspace_id in (select id from public.workspaces)) with check (workspace_id in (select id from public.workspaces))', table_name);
    execute format('create policy owner_delete on public.%I for delete to authenticated using (workspace_id in (select id from public.workspaces))', table_name);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']);
create policy evidence_object_read on storage.objects for select to authenticated
using (bucket_id = 'evidence' and (storage.foldername(name))[1] in (select id::text from public.workspaces));
create policy evidence_object_insert on storage.objects for insert to authenticated
with check (bucket_id = 'evidence' and (storage.foldername(name))[1] in (select id::text from public.workspaces));
create policy evidence_object_update on storage.objects for update to authenticated
using (bucket_id = 'evidence' and (storage.foldername(name))[1] in (select id::text from public.workspaces))
with check (bucket_id = 'evidence' and (storage.foldername(name))[1] in (select id::text from public.workspaces));
create policy evidence_object_delete on storage.objects for delete to authenticated
using (bucket_id = 'evidence' and (storage.foldername(name))[1] in (select id::text from public.workspaces));
