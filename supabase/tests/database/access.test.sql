begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
-- Storage API sets this internally; only enable it in this rolled-back policy test.
set local storage.allow_delete_query = 'true';
select plan(36);
insert into auth.users (id, email) values
 ('11111111-1111-4111-8111-111111111111', 'team@example.test'),
 ('22222222-2222-4222-8222-222222222222', 'other@example.test');
insert into public.workspaces (id, owner_id, name) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Team'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'Other');
insert into public.competitions (id, workspace_id, name) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'CTF'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Other CTF');
insert into public.challenges (id, competition_id, workspace_id, name) values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Solve');
insert into public.evidence (challenge_id, workspace_id, storage_path) values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/proof.png');
insert into storage.objects (bucket_id, name) values ('evidence', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/proof.png');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is((select count(*) from workspaces), 1::bigint, 'owner sees only own workspace');
select is((select count(*) from competitions), 1::bigint, 'owner sees only own competition');
select lives_ok($$insert into competitions (workspace_id, name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'New')$$, 'owner can insert competition');
select lives_ok($$update competitions set name = 'Updated' where name = 'New'$$, 'owner can update competition');
select lives_ok($$delete from competitions where name = 'Updated'$$, 'owner can delete competition');
select is((select count(*) from challenges), 1::bigint, 'owner reads challenge');
select lives_ok($$insert into challenges (competition_id, workspace_id, name) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'New')$$, 'owner inserts challenge');
select lives_ok($$update challenges set name = 'Updated' where name = 'New'$$, 'owner updates challenge');
select lives_ok($$delete from challenges where name = 'Updated'$$, 'owner deletes challenge');
select is((select count(*) from evidence), 1::bigint, 'owner reads evidence');
select lives_ok($$insert into evidence (challenge_id, workspace_id, storage_path) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/new.png')$$, 'owner inserts evidence');
select lives_ok($$update evidence set caption = 'Updated' where storage_path like '%new.png'$$, 'owner updates evidence');
select lives_ok($$delete from evidence where caption = 'Updated'$$, 'owner deletes evidence');
select is((select count(*) from storage.objects where bucket_id = 'evidence'), 1::bigint, 'owner reads storage');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('evidence', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/new.png')$$, 'owner uploads storage object');
select lives_ok($$update storage.objects set name = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/renamed.png' where name like '%new.png'$$, 'owner updates storage object');
select lives_ok($$delete from storage.objects where name like '%renamed.png'$$, 'owner deletes storage object');
select throws_ok($$insert into competitions (workspace_id, name) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Intrusion')$$, '42501', null, 'owner cannot write another workspace');
select throws_ok($$insert into challenges (competition_id, workspace_id, name) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Invalid')$$, '23503', null, 'parent workspace mismatch rejected');
select throws_ok($$insert into workspaces (owner_id, name) values ('11111111-1111-4111-8111-111111111111', 'Self provision')$$, '42501', null, 'clients cannot provision workspaces');

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is((select count(*) from challenges), 0::bigint, 'unrelated account cannot read challenges');
select is((select count(*) from evidence), 0::bigint, 'unrelated account cannot read evidence');
select is((select count(*) from storage.objects where bucket_id = 'evidence'), 0::bigint, 'unrelated account cannot read storage');
select throws_ok($$insert into challenges (competition_id, workspace_id, name) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Intrusion')$$, '42501', null, 'unrelated challenge insert denied');
select throws_ok($$insert into evidence (challenge_id, workspace_id, storage_path) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/attack.png')$$, '42501', null, 'unrelated evidence insert denied');
with rows as (update challenges set name = 'Intrusion' returning id) select is(count(*), 0::bigint, 'unrelated update affects no rows') from rows;
with rows as (delete from evidence returning id) select is(count(*), 0::bigint, 'unrelated delete affects no rows') from rows;
select throws_ok($$insert into storage.objects (bucket_id, name) values ('evidence', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/attack.png')$$, '42501', null, 'unrelated storage upload denied');
with rows as (update storage.objects set name = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/changed.png' where bucket_id = 'evidence' returning id) select is(count(*), 0::bigint, 'unrelated storage update affects no rows') from rows;
with rows as (delete from storage.objects where bucket_id = 'evidence' returning id) select is(count(*), 0::bigint, 'unrelated storage delete affects no rows') from rows;
reset role;
select ok(not (select public from storage.buckets where id = 'evidence'), 'evidence bucket is private');
select ok(not has_table_privilege('anon', 'public.workspaces', 'SELECT,INSERT,UPDATE,DELETE'), 'anonymous has no workspace privileges');
select ok(not has_table_privilege('anon', 'public.competitions', 'SELECT,INSERT,UPDATE,DELETE'), 'anonymous has no competition privileges');
select ok(not has_table_privilege('anon', 'public.challenges', 'SELECT,INSERT,UPDATE,DELETE'), 'anonymous has no challenge privileges');
select ok(not has_table_privilege('anon', 'public.evidence', 'SELECT,INSERT,UPDATE,DELETE'), 'anonymous has no evidence privileges');
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is((select count(*) from storage.objects where bucket_id = 'evidence'), 0::bigint, 'anonymous cannot read stored evidence');
reset role;
select * from finish();
rollback;
