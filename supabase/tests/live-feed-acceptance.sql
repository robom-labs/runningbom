-- Dedicated project only; all members and content below are rolled back.
begin;
insert into auth.users(id,email,aud,role,email_confirmed_at,created_at,updated_at)
values('55555555-5555-4555-8555-555555555555','runningbom-feed-qa@example.invalid','authenticated','authenticated',now(),now(),now());
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
set local role authenticated;
select public.claim_member_profile('runningbom_feed_qa','피드검수용러너');
insert into public.posts(author_id,kind,visibility,body,topic,region)
values(auth.uid(),'GENERAL','PUBLIC','[롤백되는 피드 검수] #러닝화 #서울','러닝화','서울');
do $$declare target uuid;begin
 select id into strict target from public.public_posts where topic='러닝화' and region='서울';
 insert into public.reactions(post_id,user_id,kind) values(target,auth.uid(),'CHEER');
 if (select (reaction_counts->>'CHEER')::integer from public.public_posts where id=target)<>1 then raise exception 'reaction aggregation failed';end if;
 delete from public.reactions where post_id=target and user_id=auth.uid();
 if (select reaction_counts ? 'CHEER' from public.public_posts where id=target) then raise exception 'reaction removal failed';end if;
 begin
  insert into public.posts(author_id,kind,visibility,body,topic) values(auth.uid(),'GENERAL','PUBLIC','invalid topic test','비허용주제');
  raise exception 'invalid topic was accepted';
 exception when check_violation then null;end;
 begin
  insert into public.posts(author_id,kind,visibility,body,region) values(auth.uid(),'GENERAL','PUBLIC','invalid region test','정밀 위치');
  raise exception 'invalid region was accepted';
 exception when check_violation then null;end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$begin
 if (select count(*) from public.public_posts where topic='러닝화' and region='서울')<>1 then raise exception 'anonymous filtered reading failed';end if;
 begin
  insert into public.reactions(post_id,user_id,kind) select id,'55555555-5555-4555-8555-555555555555','CHEER' from public.public_posts;
  raise exception 'anonymous reaction write was allowed';
 exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
select jsonb_build_object('ok',true,'checks',6,'test_data_persisted',false,'posts_remaining',(select count(*) from public.posts),'reactions_remaining',(select count(*) from public.reactions),'indexed_feed_queries',(select count(*) from pg_indexes where schemaname='public' and indexname like 'posts_feed_%')) as feed_acceptance;
