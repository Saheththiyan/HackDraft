-- Immutable manual write-up revisions and explicit review state.
create table public.writeup_revisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  challenge_id uuid not null,
  sections jsonb not null check (jsonb_typeof(sections) = 'array' and pg_column_size(sections) <= 120000),
  created_at timestamptz not null default now(),
  unique (id, challenge_id),
  foreign key (challenge_id, workspace_id) references public.challenges(id, workspace_id) on delete cascade
);
create index writeup_revisions_challenge_idx on public.writeup_revisions(challenge_id, created_at desc);
alter table public.challenges
  add column latest_revision_id uuid,
  add column approved_revision_id uuid,
  add column reviewed_version integer,
  add constraint challenge_latest_revision_fk foreign key (latest_revision_id, id) references public.writeup_revisions(id, challenge_id) deferrable initially immediate,
  add constraint challenge_approved_revision_fk foreign key (approved_revision_id, id) references public.writeup_revisions(id, challenge_id) deferrable initially immediate;

create table public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  competition_id uuid not null,
  title text not null,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (competition_id, workspace_id) references public.competitions(id, workspace_id) on delete cascade,
  unique (id, workspace_id)
);
create index report_snapshots_competition_idx on public.report_snapshots(competition_id, created_at desc);
create table public.snapshot_assets (
  report_id uuid not null,
  workspace_id uuid not null,
  storage_path text not null,
  primary key (report_id, storage_path),
  foreign key (report_id, workspace_id) references public.report_snapshots(id, workspace_id) on delete cascade,
  check (split_part(storage_path, '/', 1) = workspace_id::text)
);
create index snapshot_assets_path_idx on public.snapshot_assets(storage_path);

alter table public.writeup_revisions enable row level security;
alter table public.report_snapshots enable row level security;
alter table public.snapshot_assets enable row level security;
revoke all on public.writeup_revisions, public.report_snapshots, public.snapshot_assets from anon, authenticated;
grant select on public.writeup_revisions, public.report_snapshots, public.snapshot_assets to authenticated;
create policy own_revisions on public.writeup_revisions for select to authenticated
using (workspace_id in (select id from public.workspaces));
create policy own_reports on public.report_snapshots for select to authenticated
using (workspace_id in (select id from public.workspaces));
create policy own_snapshot_assets on public.snapshot_assets for select to authenticated
using (workspace_id in (select id from public.workspaces));

-- SECURITY DEFINER is used only to create immutable records. Every entry point
-- checks auth.uid() against the workspace owner and locks challenge versions.
create function public.save_writeup(p_challenge_id uuid, p_version integer, p_sections jsonb)
returns table(next_version integer, revision_id uuid)
language plpgsql security definer set search_path = '' as $$
declare workspace uuid;
begin
  if jsonb_typeof(p_sections) <> 'array' or jsonb_array_length(p_sections) <> 5 or
     pg_column_size(p_sections) > 120000 or
     (select count(distinct s->>'id') from jsonb_array_elements(p_sections) s) <> 5 or
     exists (select 1 from jsonb_array_elements(p_sections) s where s->>'id' not in ('overview','observations','solution','result','tools') or jsonb_typeof(s->'markdown') <> 'string' or jsonb_typeof(s->'evidenceIds') <> 'array') then
    raise exception 'invalid_writeup' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_sections) s,
    lateral jsonb_array_elements_text(s->'evidenceIds') evidence_id
    where not exists (select 1 from public.evidence e where e.id::text = evidence_id and e.challenge_id = p_challenge_id)
  ) then
    raise exception 'invalid_evidence_reference' using errcode = '22023';
  end if;
  update public.challenges c set version = c.version + 1, updated_at = now()
  from public.workspaces w
  where c.id = p_challenge_id and c.version = p_version and c.workspace_id = w.id and w.owner_id = (select auth.uid())
  returning c.version, c.workspace_id into next_version, workspace;
  if next_version is null then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;
  insert into public.writeup_revisions (workspace_id, challenge_id, sections)
  values (workspace, p_challenge_id, p_sections) returning id into revision_id;
  update public.challenges set latest_revision_id = revision_id,
    approved_revision_id = null, reviewed_version = null
  where id = p_challenge_id;
  return next;
end $$;

create function public.approve_writeup(p_challenge_id uuid, p_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare next_version integer; current_sections jsonb;
begin
  select r.sections into current_sections
  from public.challenges c
  join public.workspaces w on w.id = c.workspace_id and w.owner_id = (select auth.uid())
  join public.writeup_revisions r on r.id = c.latest_revision_id and r.challenge_id = c.id
  where c.id = p_challenge_id and c.version = p_version;
  if current_sections is null then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_array_elements(current_sections) s
    where s->>'id' in ('overview','solution','result') and length(trim(s->>'markdown')) = 0
  ) then
    raise exception 'incomplete_writeup' using errcode = '22023';
  end if;
  update public.challenges c
  set version = c.version + 1,
      approved_revision_id = c.latest_revision_id,
      reviewed_version = c.version + 1,
      updated_at = now()
  from public.workspaces w
  where c.id = p_challenge_id and c.version = p_version and c.workspace_id = w.id and w.owner_id = (select auth.uid())
  returning c.version into next_version;
  if next_version is null then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;
  return next_version;
end $$;

create function public.create_report_snapshot(p_competition_id uuid, p_challenge_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare competition public.competitions%rowtype; challenge public.challenges%rowtype;
  sections jsonb; item_id uuid; items jsonb := '[]'::jsonb; evidence_json jsonb;
  snapshot_id uuid; path text; seen uuid[] := array[]::uuid[];
begin
  if coalesce(array_length(p_challenge_ids, 1), 0) not between 1 and 100 then
    raise exception 'invalid_selection' using errcode = '22023';
  end if;
  select c.* into competition from public.competitions c
  join public.workspaces w on w.id = c.workspace_id and w.owner_id = (select auth.uid())
  where c.id = p_competition_id;
  if not found then raise exception 'competition_not_found' using errcode = 'P0002'; end if;
  foreach item_id in array p_challenge_ids loop
    if item_id = any(seen) then raise exception 'duplicate_challenge' using errcode = '22023'; end if;
    seen := array_append(seen, item_id);
    select c.* into challenge from public.challenges c
    where c.id = item_id and c.competition_id = p_competition_id
      and c.workspace_id = competition.workspace_id and c.reviewed_version = c.version
      and c.approved_revision_id is not null for share;
    if not found then raise exception 'challenge_not_reviewed' using errcode = '22023'; end if;
    select r.sections into sections from public.writeup_revisions r
    where r.id = challenge.approved_revision_id and r.challenge_id = challenge.id;
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'storagePath', e.storage_path, 'caption', e.caption, 'position', e.position
    ) order by e.position, e.id), '[]'::jsonb) into evidence_json
    from public.evidence e where e.challenge_id = challenge.id;
    items := items || jsonb_build_array(jsonb_build_object(
      'id', challenge.id, 'name', challenge.name, 'category', challenge.category,
      'points', challenge.points, 'author', challenge.author_label,
      'sections', sections, 'evidence', evidence_json
    ));
  end loop;
  insert into public.report_snapshots (workspace_id, competition_id, title, content)
  values (competition.workspace_id, p_competition_id, competition.name,
    jsonb_build_object('title', competition.name, 'description', competition.description,
      'eventDate', competition.event_date, 'challenges', items))
  returning id into snapshot_id;
  for path in select distinct e.storage_path from public.evidence e
    where e.challenge_id = any(p_challenge_ids) loop
    insert into public.snapshot_assets (report_id, workspace_id, storage_path)
    values (snapshot_id, competition.workspace_id, path);
  end loop;
  return snapshot_id;
end $$;

revoke all on function public.save_writeup(uuid, integer, jsonb), public.approve_writeup(uuid, integer), public.create_report_snapshot(uuid, uuid[]) from public, anon;
grant execute on function public.save_writeup(uuid, integer, jsonb), public.approve_writeup(uuid, integer), public.create_report_snapshot(uuid, uuid[]) to authenticated;

-- A screenshot may be removed from a live challenge while a saved report still
-- references its underlying file. The storage policy keeps that file readable.
drop policy evidence_object_delete on storage.objects;
create policy evidence_object_delete on storage.objects for delete to authenticated
using (bucket_id = 'evidence'
  and (storage.foldername(name))[1] in (select id::text from public.workspaces)
  and not exists (select 1 from public.snapshot_assets a where a.storage_path = name));
