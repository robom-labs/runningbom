-- New Supabase projects may explicitly grant ALL to API roles by default.
-- RLS does not constrain TRUNCATE, so first remove inherited table privileges.
revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- App RPCs opt in below. Extension-owned functions are left alone.
do $$declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
 loop execute format('revoke all on function %s from public, anon, authenticated',f.signature);end loop;
end$$;

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.posts, public.comments, public.reactions,
 public.member_handles, public.badge_definitions, public.feature_flags, public.release_manifests,
 public.public_profiles, public.public_posts, public.ad_campaigns to anon, authenticated;
grant insert(user_id,nickname,bio,avatar_path,neighborhood_visibility,profile_visibility) on public.profiles to authenticated;
grant update(nickname,bio,avatar_path,neighborhood_visibility,profile_visibility,updated_at) on public.profiles to authenticated;
grant select(user_id,legal_consent_at,created_at,updated_at) on public.profile_private to authenticated;
grant select on public.user_consents, public.reports, public.deletion_jobs, public.appeals,
 public.daily_activities, public.user_badges, public.weekly_scores to authenticated;
grant select,insert,update,delete on public.user_settings, public.activities, public.reactions, public.blocks to authenticated;
grant insert(author_id,kind,body,visibility,crew_id) on public.posts to authenticated;
grant update(body,edited_at,status) on public.posts to authenticated;
grant insert(post_id,author_id,body) on public.comments to authenticated;
grant update(body,edited_at,status) on public.comments to authenticated;
grant insert(user_id,moderation_action_id,body) on public.appeals to authenticated;
grant insert(user_id,handle) on public.member_handles to authenticated;
grant select on public.chat_rooms,public.chat_messages,public.chat_reports to authenticated;
grant insert(room_id,sender_id,body) on public.chat_messages to authenticated;
grant insert(reporter_id,message_id,reason) on public.chat_reports to authenticated;
grant select,insert,delete on public.saved_items to authenticated;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

grant execute on function public.can_view_user(uuid),public.can_view_post(uuid),public.is_active_crew_member(uuid) to anon,authenticated;
grant execute on function public.account_can_write(),public.can_interact_with_post(uuid),
 public.claim_member_profile(text,text),public.record_user_consent(text,text,text),
 public.request_account_deletion(),public.submit_report(text,uuid,text,text),public.set_featured_badge(text) to authenticated;

-- Crew and leaderboard APIs stay inaccessible in this release.
alter view public.public_leaderboard set (security_invoker=true);

create function runningbom_private.guard_content_update() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('anon','authenticated') and (
  old.status<>'ACTIVE' or new.status not in ('ACTIVE','AUTHOR_DELETED')
 ) then raise exception '운영 처리된 글의 상태는 직접 바꿀 수 없어요.';end if;
 return new;
end;$$;
revoke all on function runningbom_private.guard_content_update() from public,anon,authenticated;
create trigger post_status_guard before update on public.posts for each row execute function runningbom_private.guard_content_update();
create trigger comment_status_guard before update on public.comments for each row execute function runningbom_private.guard_content_update();

-- Account creation alone is insufficient for posting: rules are acknowledged
-- explicitly by the user when claiming their handle, then recorded atomically.
create or replace function public.claim_member_profile(next_handle text,next_nickname text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not runningbom_private.member_can_write() then raise exception '이메일 확인 후 다시 로그인해 주세요.';end if;
 if char_length(trim(next_nickname)) not between 2 and 16 or next_nickname ~* '^(관리자|운영자|러닝봄|runningbom|robom)$' then raise exception '다른 닉네임을 골라 주세요.';end if;
 insert into public.member_handles(user_id,handle) values(auth.uid(),lower(trim(next_handle))) on conflict(user_id) do nothing;
 insert into public.profiles(user_id,nickname) values(auth.uid(),trim(next_nickname))
 on conflict(user_id) do update set nickname=excluded.nickname,updated_at=now();
 perform public.record_user_consent('COMMUNITY_RULES','2026-10-18','ACCEPTED');
end;$$;
revoke all on function public.claim_member_profile(text,text) from public,anon;
grant execute on function public.claim_member_profile(text,text) to authenticated;

create function runningbom_private.require_community_rules() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.user_consents c where c.user_id=auth.uid()
  and c.consent_type='COMMUNITY_RULES' and c.consent_version='2026-10-18' and c.action='ACCEPTED'
  and not exists(select 1 from public.user_consents r where r.user_id=c.user_id and r.consent_type=c.consent_type
   and r.consent_version=c.consent_version and r.action='REVOKED' and r.occurred_at>=c.occurred_at))
 then raise exception '소통 이용 규칙에 동의한 후 이용해 주세요.';end if;
 return new;
end;$$;
revoke all on function runningbom_private.require_community_rules() from public,anon,authenticated;
create trigger post_rules_guard before insert on public.posts for each row execute function runningbom_private.require_community_rules();
create trigger comment_rules_guard before insert on public.comments for each row execute function runningbom_private.require_community_rules();
create trigger chat_rules_guard before insert on public.chat_messages for each row execute function runningbom_private.require_community_rules();

create or replace function runningbom_private.quarantine_reported_message() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.message_id::text,3));
 if (select count(distinct reporter_id) from public.chat_reports where message_id=new.message_id)>=3 then
  update public.chat_messages set status='QUARANTINED' where id=new.message_id;
  insert into runningbom_private.review_queue(target_type,target_id,reason) values('CHAT',new.message_id,'서로 다른 확인된 회원 3명의 신고') on conflict do nothing;
 end if;
 return new;
end;$$;
revoke all on function runningbom_private.quarantine_reported_message() from public,anon,authenticated;
