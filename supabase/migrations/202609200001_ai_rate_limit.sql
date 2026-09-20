-- Shared across server instances; callers cannot reset their own counters.
create table public.ai_request_limits (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  window_start timestamptz not null,
  requests integer not null check (requests between 1 and 5)
);
alter table public.ai_request_limits enable row level security;
revoke all on public.ai_request_limits from public, anon, authenticated;
grant all on public.ai_request_limits to service_role;

create function public.consume_ai_request(p_workspace_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  admitted uuid;
begin
  if not exists (select 1 from public.workspaces where id = p_workspace_id and owner_id = auth.uid()) then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  insert into public.ai_request_limits as limits (workspace_id, window_start, requests)
  values (p_workspace_id, clock_timestamp(), 1)
  on conflict (workspace_id) do update
    set window_start = case when limits.window_start <= clock_timestamp() - interval '1 minute' then clock_timestamp() else limits.window_start end,
        requests = case when limits.window_start <= clock_timestamp() - interval '1 minute' then 1 else limits.requests + 1 end
    where limits.window_start <= clock_timestamp() - interval '1 minute' or limits.requests < 5
  returning workspace_id into admitted;
  return admitted is not null;
end;
$$;
revoke all on function public.consume_ai_request(uuid) from public, anon;
grant execute on function public.consume_ai_request(uuid) to authenticated;
