-- Run against the dedicated runningbom project. All test data is rolled back.
begin;
insert into auth.users(id,email,aud,role,email_confirmed_at,created_at,updated_at)
values
 ('11111111-1111-4111-8111-111111111111','runningbom-qa-1@example.invalid','authenticated','authenticated',now(),now(),now()),
 ('22222222-2222-4222-8222-222222222222','runningbom-qa-2@example.invalid','authenticated','authenticated',now(),now(),now()),
 ('33333333-3333-4333-8333-333333333333','runningbom-qa-3@example.invalid','authenticated','authenticated',now(),now(),now()),
 ('44444444-4444-4444-8444-444444444444','runningbom-qa-4@example.invalid','authenticated','authenticated',now(),now(),now());

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select public.claim_member_profile('runningbom_qa1','검수용러너하나');
insert into public.posts(author_id,kind,visibility,body) values(auth.uid(),'GENERAL','PUBLIC','[자동 검수·롤백] 첫 러닝 이야기');
insert into public.chat_messages(room_id,sender_id,body) values('daily',auth.uid(),'[자동 검수·롤백] 첫 메시지');
insert into public.saved_items(user_id,kind,item_id) values(auth.uid(),'shoe','qa-item');
do $$begin
 if (select count(*) from public.user_consents where consent_type='COMMUNITY_RULES' and action='ACCEPTED')<>1 then raise exception 'consent was not recorded';end if;
 begin
  insert into public.chat_messages(room_id,sender_id,body) values('daily',auth.uid(),'[자동 검수·롤백] 첫 메시지');
  raise exception 'duplicate message was allowed';
 exception when raise_exception then if sqlerrm not like '%같은 내용%' then raise;end if;end;
 begin
  insert into public.chat_messages(room_id,sender_id,body,status) values('daily',auth.uid(),'status forgery','REMOVED');
  raise exception 'status forgery was allowed';
 exception when insufficient_privilege then null;end;
 begin
  truncate public.chat_messages;
  raise exception 'TRUNCATE was allowed';
 exception when insufficient_privilege then null;end;
 begin
  perform moderation_note from public.profile_private;
  raise exception 'private moderation note was readable';
 exception when insufficient_privilege then null;end;
 begin
  update public.posts set status='QUARANTINED' where author_id=auth.uid();
  raise exception 'moderation status was writable';
 exception when raise_exception then if sqlerrm not like '%운영 처리된%' then raise;end if;end;
 begin
  insert into public.ad_campaigns(placement,label,title,body,landing_url,starts_at,ends_at) values('home-pick','광고','qa','qa','https://example.com',now(),now()+interval '1 day');
  raise exception 'ad configuration was writable';
 exception when insufficient_privilege then null;end;
end$$;
reset role;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select public.claim_member_profile('runningbom_qa2','검수용러너둘');
do $$begin
 if (select count(*) from public.saved_items)<>0 then raise exception 'other owner saved list was readable';end if;
 begin
  insert into public.chat_messages(room_id,sender_id,body) values('daily','11111111-1111-4111-8111-111111111111','impersonation');
  raise exception 'impersonation was allowed';
 exception when raise_exception then if sqlerrm not like '%verified sign-in%' then raise;end if;end;
end$$;
insert into public.blocks(blocker_id,blocked_id) values(auth.uid(),'11111111-1111-4111-8111-111111111111');
do $$begin if exists(select 1 from public.chat_messages) or exists(select 1 from public.public_posts) then raise exception 'block did not hide content';end if;end$$;
delete from public.blocks where blocker_id=auth.uid();
select public.submit_report('POST',(select id from public.posts limit 1),'검수 신고','');
insert into public.chat_reports(reporter_id,message_id,reason) select auth.uid(),id,'검수 신고' from public.chat_messages;
reset role;

select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
set local role authenticated;
select public.claim_member_profile('runningbom_qa3','검수용러너셋');
select public.submit_report('POST',(select id from public.posts limit 1),'검수 신고','');
insert into public.chat_reports(reporter_id,message_id,reason) select auth.uid(),id,'검수 신고' from public.chat_messages;
reset role;

select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
set local role authenticated;
select public.claim_member_profile('runningbom_qa4','검수용러너넷');
select public.submit_report('POST',(select id from public.posts limit 1),'검수 신고','');
insert into public.chat_reports(reporter_id,message_id,reason) select auth.uid(),id,'검수 신고' from public.chat_messages;
reset role;
do $$begin
 if (select status from public.posts limit 1)<>'QUARANTINED' then raise exception 'three-report post quarantine failed';end if;
 if (select status from public.chat_messages limit 1)<>'QUARANTINED' then raise exception 'three-report chat quarantine failed';end if;
 if (select count(*) from runningbom_private.review_queue)<>2 then raise exception 'review queue is incomplete';end if;
end$$;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$begin
 if exists(select 1 from public.public_posts) then raise exception 'quarantined post was public';end if;
 begin perform * from public.chat_messages;raise exception 'anonymous chat read was allowed';exception when insufficient_privilege then null;end;
 begin perform public.request_account_deletion();raise exception 'anonymous deletion was callable';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
select jsonb_build_object('ok',true,'test_data_persisted',false,'checks',array['confirmed member + handle','rules consent','duplicate rejection','status column protection','TRUNCATE rejection','private moderation note','ad write rejection','owner-only saved items','impersonation rejection','block visibility','post quarantine','chat quarantine','private review queue','anonymous API protection']) as acceptance;
