begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(12);
insert into auth.users (id, email) values
 ('11111111-1111-4111-8111-111111111111', 'capture@example.test'),
 ('22222222-2222-4222-8222-222222222222', 'other-capture@example.test');
insert into public.workspaces (id, owner_id, name) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Capture'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'Other');
insert into public.competitions (id, workspace_id, name) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'CTF');
insert into public.challenges (id, workspace_id, competition_id, name) values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Initial');
insert into storage.objects (bucket_id, name) values
 ('evidence', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/test.png');
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is(public.save_challenge('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 1, 'Edited', 'Forensics', 100, 'Alex', 'Prompt', 'Notes', 'strings test.png', 'CTF{test}'), 2, 'save increments version');
select is((select source_notes from challenges where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), 'Notes', 'save preserves notes');
select throws_ok($$select public.save_challenge('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 1, 'Stale', '', null, '', '', '', '', '')$$, 'P0001', 'version_conflict', 'stale save blocked');
select is((select name from challenges where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), 'Edited', 'stale save did not overwrite');
select throws_ok($$select public.attach_evidence('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 2, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/test.png', '')$$, '22023', 'invalid_storage_path', 'foreign path rejected');
select is((select version from challenges where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), 2, 'failed attach rolls back version');
select is(public.attach_evidence('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 2, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/test.png', 'Before'), 3, 'owner attaches evidence');
select is(public.update_evidence_order('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 3, (select jsonb_build_array(jsonb_build_object('id', id, 'caption', 'After')) from evidence where challenge_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')), 4, 'caption and order save');
select is((select caption from evidence where challenge_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), 'After', 'caption persisted');
select is((select next_version from public.remove_evidence('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 4, (select id from evidence where challenge_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'))), 5, 'remove evidence increments version');
select is((select count(*) from evidence where challenge_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), 0::bigint, 'evidence metadata removed');
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select throws_ok($$select public.save_challenge('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 5, 'Intrusion', '', null, '', '', '', '', '')$$, 'P0001', 'version_conflict', 'unrelated account cannot edit challenge');
select * from finish();
rollback;
