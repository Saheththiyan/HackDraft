begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(10);
insert into auth.users (id, email) values
 ('11111111-1111-4111-8111-111111111111', 'limits-owner@example.test'),
 ('22222222-2222-4222-8222-222222222222', 'limits-other@example.test');
insert into public.workspaces (id, owner_id, name) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Limits');
select ok(not has_table_privilege('authenticated', 'public.ai_request_limits', 'SELECT,INSERT,UPDATE,DELETE'), 'clients cannot reset or read counters');
select ok(not has_function_privilege('anon', 'public.consume_ai_request(uuid)', 'EXECUTE'), 'anonymous cannot consume quota');
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select throws_ok($$select public.consume_ai_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$, '42501', 'access_denied', 'unrelated account cannot consume another team quota');
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select ok(public.consume_ai_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'first draft allowed');
select ok(public.consume_ai_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'second draft allowed');
select ok(public.consume_ai_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'third draft allowed');
select ok(public.consume_ai_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'fourth draft allowed');
select ok(public.consume_ai_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'fifth draft allowed');
select ok(not public.consume_ai_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'sixth draft denied');
reset role;
update public.ai_request_limits set window_start = now() - interval '2 minutes';
set local role authenticated;
select ok(public.consume_ai_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'quota recovers after the window');
reset role;
select * from finish();
rollback;
