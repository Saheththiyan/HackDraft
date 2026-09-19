alter table public.competitions
  add column description text not null default '',
  add column event_date date,
  add column updated_at timestamptz not null default now();
alter table public.challenges
  add column description text not null default '',
  add column author_label text not null default '',
  add column points integer check (points is null or points >= 0),
  add column commands text not null default '',
  add column flag text not null default '',
  add column updated_at timestamptz not null default now();
create index challenges_workspace_created_idx on public.challenges(workspace_id, created_at desc);

-- All challenge changes use the same compare-and-swap version. A second browser
-- must reload after someone else saves, uploads, reorders, or removes evidence.
create function public.save_challenge(
  p_id uuid, p_version integer, p_name text, p_category text,
  p_points integer, p_author_label text, p_description text,
  p_source_notes text, p_commands text, p_flag text
) returns integer language plpgsql security invoker set search_path = '' as $$
declare next_version integer;
begin
  if length(trim(p_name)) not between 1 and 200 or
     length(coalesce(p_category, '')) > 100 or
     length(coalesce(p_author_label, '')) > 100 or
     length(coalesce(p_description, '')) > 10000 or
     length(coalesce(p_source_notes, '')) > 100000 or
     length(coalesce(p_commands, '')) > 50000 or
     length(coalesce(p_flag, '')) > 2000 or
     (p_points is not null and p_points < 0) then
    raise exception 'invalid_challenge' using errcode = '22023';
  end if;
  update public.challenges set
    name = trim(p_name), category = nullif(trim(coalesce(p_category, '')), ''),
    points = p_points, author_label = coalesce(p_author_label, ''),
    description = coalesce(p_description, ''), source_notes = coalesce(p_source_notes, ''),
    commands = coalesce(p_commands, ''), flag = coalesce(p_flag, ''),
    version = version + 1, updated_at = now()
  where id = p_id and version = p_version
  returning version into next_version;
  if next_version is null then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;
  return next_version;
end $$;

create function public.attach_evidence(
  p_challenge_id uuid, p_version integer, p_storage_path text, p_caption text
) returns integer language plpgsql security invoker set search_path = '' as $$
declare next_version integer; workspace uuid; next_position integer;
begin
  if length(coalesce(p_caption, '')) > 500 or
     length(coalesce(p_storage_path, '')) > 500 then
    raise exception 'invalid_evidence' using errcode = '22023';
  end if;
  update public.challenges set version = version + 1, updated_at = now()
  where id = p_challenge_id and version = p_version
  returning version, workspace_id into next_version, workspace;
  if next_version is null then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;
  if split_part(p_storage_path, '/', 1) <> workspace::text or
     not exists (select 1 from storage.objects where bucket_id = 'evidence' and name = p_storage_path) then
    raise exception 'invalid_storage_path' using errcode = '22023';
  end if;
  select coalesce(max(position) + 1, 0) into next_position
  from public.evidence where challenge_id = p_challenge_id;
  insert into public.evidence (workspace_id, challenge_id, storage_path, caption, position)
  values (workspace, p_challenge_id, p_storage_path, coalesce(p_caption, ''), next_position);
  return next_version;
end $$;

create function public.update_evidence_order(
  p_challenge_id uuid, p_version integer, p_items jsonb
) returns integer language plpgsql security invoker set search_path = '' as $$
declare next_version integer; workspace uuid; item jsonb; idx integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'invalid_evidence_order' using errcode = '22023';
  end if;
  update public.challenges set version = version + 1, updated_at = now()
  where id = p_challenge_id and version = p_version
  returning version, workspace_id into next_version, workspace;
  if next_version is null then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) <> (select count(*) from public.evidence where challenge_id = p_challenge_id) or
     (select count(distinct x->>'id') from jsonb_array_elements(p_items) as x) <> jsonb_array_length(p_items) then
    raise exception 'invalid_evidence_order' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if length(coalesce(item->>'caption', '')) > 500 then
      raise exception 'invalid_evidence_caption' using errcode = '22023';
    end if;
    update public.evidence set position = idx, caption = coalesce(item->>'caption', '')
    where id = (item->>'id')::uuid and challenge_id = p_challenge_id and workspace_id = workspace;
    if not found then
      raise exception 'invalid_evidence_order' using errcode = '22023';
    end if;
    idx := idx + 1;
  end loop;
  return next_version;
end $$;

create function public.remove_evidence(
  p_challenge_id uuid, p_version integer, p_evidence_id uuid
) returns table(next_version integer, removed_path text)
language plpgsql security invoker set search_path = '' as $$
begin
  update public.challenges set version = version + 1, updated_at = now()
  where id = p_challenge_id and version = p_version
  returning version into next_version;
  if next_version is null then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;
  delete from public.evidence where id = p_evidence_id and challenge_id = p_challenge_id
  returning storage_path into removed_path;
  if removed_path is null then
    raise exception 'invalid_evidence' using errcode = '22023';
  end if;
  return next;
end $$;

revoke all on function public.save_challenge(uuid, integer, text, text, integer, text, text, text, text, text) from public, anon;
revoke all on function public.attach_evidence(uuid, integer, text, text) from public, anon;
revoke all on function public.update_evidence_order(uuid, integer, jsonb) from public, anon;
revoke all on function public.remove_evidence(uuid, integer, uuid) from public, anon;
grant execute on function public.save_challenge(uuid, integer, text, text, integer, text, text, text, text, text) to authenticated;
grant execute on function public.attach_evidence(uuid, integer, text, text) to authenticated;
grant execute on function public.update_evidence_order(uuid, integer, jsonb) to authenticated;
grant execute on function public.remove_evidence(uuid, integer, uuid) to authenticated;
