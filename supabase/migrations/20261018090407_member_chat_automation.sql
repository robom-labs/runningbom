-- Extends the existing social schema; no existing user IDs or tables are replaced.
create schema if not exists runningbom_private;
revoke all on schema runningbom_private from public;
grant usage on schema runningbom_private to authenticated;

create function runningbom_private.member_can_write() returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and public.account_can_write()
 and exists(select 1 from auth.users u where u.id=auth.uid() and u.deleted_at is null
   and (u.banned_until is null or u.banned_until < now())
   and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null));
$$;
revoke all on function runningbom_private.member_can_write() from public;
grant execute on function runningbom_private.member_can_write() to authenticated;

create table public.member_handles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 handle text not null unique check(handle ~ '^[a-z][a-z0-9_]{2,19}$' and handle not in ('admin','runningbom','robom','operator','support')),
 created_at timestamptz not null default now()
);
alter table public.member_handles enable row level security;
create policy member_handles_read on public.member_handles for select to anon,authenticated using(true);
create policy member_handles_self_insert on public.member_handles for insert to authenticated
 with check(user_id=(select auth.uid()) and runningbom_private.member_can_write());
grant select on public.member_handles to anon,authenticated;
grant insert(user_id,handle) on public.member_handles to authenticated;

create function public.claim_member_profile(next_handle text,next_nickname text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
 if not runningbom_private.member_can_write() then raise exception '이메일 확인 후 다시 로그인해 주세요.';end if;
 if char_length(trim(next_nickname)) not between 2 and 16 or next_nickname ~* '^(관리자|운영자|러닝봄|runningbom|robom)$' then raise exception '다른 닉네임을 골라 주세요.';end if;
 insert into public.member_handles(user_id,handle) values(auth.uid(),lower(trim(next_handle))) on conflict(user_id) do nothing;
 insert into public.profiles(user_id,nickname) values(auth.uid(),trim(next_nickname))
 on conflict(user_id) do update set nickname=excluded.nickname,updated_at=now();
end;$$;
revoke all on function public.claim_member_profile(text,text) from public;
grant execute on function public.claim_member_profile(text,text) to authenticated;

create table public.chat_rooms (
 id text primary key check(id ~ '^[a-z-]{2,30}$'),title text not null
);
insert into public.chat_rooms values('daily','오늘의 러닝'),('races','대회·접수 이야기'),('shoes','러닝화 이야기');
alter table public.chat_rooms enable row level security;
create policy chat_rooms_member_read on public.chat_rooms for select to authenticated using(true);
grant select on public.chat_rooms to authenticated;

create table public.chat_messages (
 id uuid primary key default gen_random_uuid(),room_id text not null references public.chat_rooms(id),
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(trim(body)) between 1 and 500),
 status text not null default 'ACTIVE' check(status in ('ACTIVE','QUARANTINED','REMOVED')),
 created_at timestamptz not null default now()
);
create index chat_messages_room_time on public.chat_messages(room_id,created_at desc) where status='ACTIVE';
create index chat_messages_sender_time on public.chat_messages(sender_id,created_at desc);
alter table public.chat_messages enable row level security;
create policy chat_messages_visible on public.chat_messages for select to authenticated
 using(status='ACTIVE' and public.can_view_user(sender_id));
create policy chat_messages_self_insert on public.chat_messages for insert to authenticated
 with check(sender_id=(select auth.uid()) and status='ACTIVE' and runningbom_private.member_can_write()
   and exists(select 1 from public.profiles where user_id=(select auth.uid())));
grant select on public.chat_messages to authenticated;
grant insert(room_id,sender_id,body) on public.chat_messages to authenticated;

create table public.chat_reports (
 id uuid primary key default gen_random_uuid(),reporter_id uuid not null references auth.users(id) on delete cascade,
 message_id uuid not null references public.chat_messages(id) on delete cascade,
 reason text not null check(char_length(reason) between 2 and 100),created_at timestamptz not null default now(),
 unique(reporter_id,message_id)
);
alter table public.chat_reports enable row level security;
create policy chat_reports_self_read on public.chat_reports for select to authenticated using(reporter_id=(select auth.uid()));
create policy chat_reports_self_insert on public.chat_reports for insert to authenticated
 with check(reporter_id=(select auth.uid()) and runningbom_private.member_can_write()
  and exists(select 1 from public.chat_messages m where m.id=message_id and m.sender_id<>(select auth.uid())));
grant select on public.chat_reports to authenticated;
grant insert(reporter_id,message_id,reason) on public.chat_reports to authenticated;

create table runningbom_private.review_queue (
 target_type text not null,target_id uuid not null,reason text not null,created_at timestamptz not null default now(),
 primary key(target_type,target_id)
);
alter table runningbom_private.review_queue enable row level security;

-- Database-side checks also protect clients that don't use the supplied UI.
create function runningbom_private.guard_social_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare actor uuid; n integer; content text;
begin
 if tg_table_name='chat_messages' then actor:=new.sender_id;else actor:=new.author_id;end if;
 if actor is distinct from auth.uid() or not runningbom_private.member_can_write() or not exists(select 1 from public.member_handles where user_id=actor) then raise exception 'verified sign-in and member handle required';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,1));
 content:=trim(new.body);
 if tg_table_name='chat_messages' then
  select count(*) into n from public.chat_messages where sender_id=actor and created_at>now()-interval '30 seconds';
  if n>=6 then raise exception '메시지를 잠시 쉬었다 보내 주세요.';end if;
  if exists(select 1 from public.chat_messages where sender_id=actor and body=content and created_at>now()-interval '5 minutes') then raise exception '같은 내용을 반복해서 보낼 수 없어요.';end if;
 elsif tg_table_name='posts' then
  select count(*) into n from public.posts where author_id=actor and created_at>now()-interval '1 minute';
  if n>=3 then raise exception '글을 잠시 쉬었다 올려 주세요.';end if;
  if exists(select 1 from public.posts where author_id=actor and body=content and created_at>now()-interval '1 hour') then raise exception '같은 글이 이미 올라와 있어요.';end if;
 else
  select count(*) into n from public.comments where author_id=actor and created_at>now()-interval '1 minute';
  if n>=10 then raise exception '댓글을 잠시 쉬었다 남겨 주세요.';end if;
 end if;
 new.body:=content;
 return new;
end;$$;
revoke all on function runningbom_private.guard_social_insert() from public;
create trigger chat_message_guard before insert on public.chat_messages for each row execute function runningbom_private.guard_social_insert();
create trigger runningbom_post_guard before insert on public.posts for each row execute function runningbom_private.guard_social_insert();
create trigger runningbom_comment_guard before insert on public.comments for each row execute function runningbom_private.guard_social_insert();

create function runningbom_private.quarantine_reported_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if (select count(distinct reporter_id) from public.chat_reports where message_id=new.message_id)>=3 then
  update public.chat_messages set status='QUARANTINED' where id=new.message_id;
  insert into runningbom_private.review_queue(target_type,target_id,reason) values('CHAT',new.message_id,'서로 다른 확인된 회원 3명의 신고') on conflict do nothing;
 end if;
 return new;
end;$$;
revoke all on function runningbom_private.quarantine_reported_message() from public;
create trigger chat_report_quarantine after insert on public.chat_reports for each row execute function runningbom_private.quarantine_reported_message();

create function runningbom_private.quarantine_reported_content() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if new.reporter_id is distinct from auth.uid() or not runningbom_private.member_can_write() then raise exception 'verified reporter required';end if;
 perform pg_advisory_xact_lock(hashtextextended(new.target_id::text,2));
 if new.target_type in ('POST','COMMENT') and
  (select count(distinct reporter_id) from public.reports where target_id=new.target_id and target_type=new.target_type and status in ('OPEN','REVIEWING'))>=3 then
  if new.target_type='POST' then update public.posts set status='QUARANTINED' where id=new.target_id and status='ACTIVE';
  else update public.comments set status='QUARANTINED' where id=new.target_id and status='ACTIVE';end if;
  insert into runningbom_private.review_queue(target_type,target_id,reason) values(new.target_type,new.target_id,'서로 다른 확인된 회원 3명의 신고') on conflict do nothing;
 end if;
 return new;
end;$$;
revoke all on function runningbom_private.quarantine_reported_content() from public;
create trigger content_report_quarantine after insert on public.reports for each row execute function runningbom_private.quarantine_reported_content();

-- Only public discussion messages use Realtime. No private profile/email table is published.
do $$begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.chat_messages;
 end if;
end$$;

create table public.saved_items (
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('race','shoe')),item_id text not null,
 created_at timestamptz not null default now(),primary key(user_id,kind,item_id)
);
alter table public.saved_items enable row level security;
create policy saved_items_owner on public.saved_items for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and runningbom_private.member_can_write());
grant select,insert,delete on public.saved_items to authenticated;

create table public.ad_campaigns (
 id uuid primary key default gen_random_uuid(),placement text not null check(placement in ('home-pick','gear-after-list')),
 label text not null default '광고',title text not null,body text not null,
 product_id text,landing_url text not null check(landing_url like 'https://%'),
 starts_at timestamptz not null,ends_at timestamptz not null,enabled boolean not null default false,
 check(ends_at>starts_at),check(label in ('광고','제휴 광고'))
);
alter table public.ad_campaigns enable row level security;
create policy ad_campaigns_active_read on public.ad_campaigns for select to anon,authenticated
 using(enabled and starts_at<=now() and ends_at>now());
grant select on public.ad_campaigns to anon,authenticated;
