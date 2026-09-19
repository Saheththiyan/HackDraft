begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(18);
insert into auth.users (id, email) values
 ('11111111-1111-4111-8111-111111111111', 'report@example.test'),
 ('22222222-2222-4222-8222-222222222222', 'other-report@example.test');
insert into public.workspaces (id, owner_id, name) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Report'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'Other');
insert into public.competitions (id, workspace_id, name) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'CTF');
insert into public.challenges (id, workspace_id, competition_id, name) values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Forensics');
insert into storage.objects (bucket_id, name) values ('evidence', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/report.png');
insert into public.evidence (id, workspace_id, challenge_id, storage_path) values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/report.png');

select ok(not has_table_privilege('authenticated', 'public.writeup_revisions', 'INSERT'), 'clients cannot insert revisions directly');
select ok(not has_table_privilege('authenticated', 'public.report_snapshots', 'INSERT'), 'clients cannot insert reports directly');
select ok(not has_table_privilege('anon', 'public.report_snapshots', 'SELECT'), 'anonymous report read denied');
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is((select next_version from public.save_writeup('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 1, '[{"id":"overview","markdown":"Overview","evidenceIds":[]},{"id":"observations","markdown":"","evidenceIds":[]},{"id":"solution","markdown":"Steps","evidenceIds":["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"]},{"id":"result","markdown":"Flag found","evidenceIds":[]},{"id":"tools","markdown":"","evidenceIds":[]}]'::jsonb)), 2, 'saving write-up increments challenge version');
select is((select count(*) from public.writeup_revisions), 1::bigint, 'immutable revision created');
select throws_ok($q$select public.save_writeup('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 1, '[]'::jsonb)$q$, '22023', 'invalid_writeup', 'invalid write-up rejected');
select throws_ok($q$select public.approve_writeup('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 1)$q$, 'P0001', 'version_conflict', 'stale approval rejected');
select is(public.approve_writeup('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 2), 3, 'complete revision approved');
select is((select reviewed_version from public.challenges where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), 3, 'reviewed version recorded');
select ok(public.create_report_snapshot('cccccccc-cccc-4ccc-8ccc-cccccccccccc', array['dddddddd-dddd-4ddd-8ddd-dddddddddddd']::uuid[]) is not null, 'reviewed challenge snapshots');
select is((select content->'challenges'->0->'sections'->2->>'markdown' from public.report_snapshots), 'Steps', 'snapshot stores approved text');
select is((select count(*) from public.snapshot_assets), 1::bigint, 'snapshot retains screenshot path');
select is(public.save_challenge('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 3, 'Edited', '', null, '', '', '', '', ''), 4, 'capture edit increments version');
select throws_ok($q$select public.create_report_snapshot('cccccccc-cccc-4ccc-8ccc-cccccccccccc', array['dddddddd-dddd-4ddd-8ddd-dddddddddddd']::uuid[])$q$, '22023', 'challenge_not_reviewed', 'source edit requires review again');
select is((select content->'challenges'->0->>'name' from public.report_snapshots), 'Forensics', 'old snapshot stays unchanged');
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is((select count(*) from public.report_snapshots), 0::bigint, 'other account cannot read reports');
select throws_ok($q$select public.create_report_snapshot('cccccccc-cccc-4ccc-8ccc-cccccccccccc', array['dddddddd-dddd-4ddd-8ddd-dddddddddddd']::uuid[])$q$, 'P0002', 'competition_not_found', 'other account cannot create report');
select throws_ok($q$select public.save_writeup('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 4, '[{"id":"overview","markdown":"x","evidenceIds":[]},{"id":"observations","markdown":"","evidenceIds":[]},{"id":"solution","markdown":"x","evidenceIds":[]},{"id":"result","markdown":"x","evidenceIds":[]},{"id":"tools","markdown":"","evidenceIds":[]}]'::jsonb)$q$, 'P0001', 'version_conflict', 'other account cannot save revision');
select * from finish();
rollback;
