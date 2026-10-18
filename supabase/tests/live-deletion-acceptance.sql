begin;
insert into auth.users(id,email,aud,role,email_confirmed_at,created_at,updated_at)
values('55555555-5555-4555-8555-555555555555','runningbom-qa-delete@example.invalid','authenticated','authenticated',now(),now(),now());
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
set local role authenticated;
select public.claim_member_profile('runningbom_qa_delete','검수용삭제회원');
insert into public.chat_messages(room_id,sender_id,body) values('daily',auth.uid(),'[삭제 검수·롤백] 삭제될 메시지');
select public.request_account_deletion();
do $$begin
 if runningbom_private.member_can_write() then raise exception 'deletion did not stop writes';end if;
 begin perform runningbom_private.process_account_deletions();raise exception 'member invoked private worker';exception when insufficient_privilege then null;end;
end$$;
reset role;
do $$declare outcome jsonb;begin
 outcome:=runningbom_private.process_account_deletions();
 if outcome->>'completed'<>'1' or outcome->>'failed'<>'0' then raise exception 'account deletion did not finish';end if;
 if exists(select 1 from auth.users where id='55555555-5555-4555-8555-555555555555') then raise exception 'user remains';end if;
 if exists(select 1 from public.chat_messages where sender_id='55555555-5555-4555-8555-555555555555') then raise exception 'message did not cascade';end if;
end$$;
set local role authenticated;
do $$begin
 if runningbom_private.member_can_write() then raise exception 'old token can still write';end if;
end$$;
reset role;
rollback;
select jsonb_build_object('ok',true,'test_data_persisted',false,'checks',array['self-request only','immediate write block','private worker inaccessible','account deletion','content cascade','expired-account JWT write rejection']) as acceptance;
