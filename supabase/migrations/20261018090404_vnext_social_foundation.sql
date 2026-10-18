-- 러닝봄 vNext 소셜 기능의 최소 스키마와 기본 거부 RLS를 정의합니다.
create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 16),
  bio text not null default '' check (char_length(bio) <= 160),
  avatar_path text,
  featured_badge_id text,
  neighborhood_visibility text not null default 'SIGUNGU'
    check (neighborhood_visibility in ('DONG', 'SIGUNGU', 'MARK_ONLY', 'PRIVATE')),
  profile_visibility text not null default 'PUBLIC'
    check (profile_visibility in ('PUBLIC', 'CREW', 'PRIVATE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_nickname_normalized_unique
  on public.profiles (lower(regexp_replace(trim(nickname), '\s+', ' ', 'g')));

create table public.profile_private (
  user_id uuid primary key references auth.users(id) on delete cascade,
  legal_consent_at timestamptz,
  moderation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null,
  consent_version text not null,
  action text not null check (action in ('ACCEPTED', 'REVOKED')),
  occurred_at timestamptz not null default now(),
  unique (user_id, consent_type, consent_version, action)
);

create table public.activities (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  local_uuid uuid not null,
  kind text not null check (kind in ('run', 'walk', 'recovery')),
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  distance_km numeric(7, 3) check (distance_km is null or distance_km between 0 and 500),
  source text not null check (source in ('COACH_COMPLETED', 'HEALTH_LINKED', 'SELF_LOGGED', 'CREW_ATTENDANCE')),
  completed_at timestamptz not null,
  timezone_id text not null default 'Asia/Seoul',
  client_created_at timestamptz not null,
  created_at timestamptz not null default now()
);
-- local_uuid는 기기 식별자이며 활동별 멱등 키는 id입니다.
create index activities_user_completed_idx on public.activities(user_id, completed_at desc);

create table public.daily_activities (
  user_id uuid not null references auth.users(id) on delete cascade,
  day_key date not null,
  movement_completed boolean not null default false,
  competitive_run_completed boolean not null default false,
  algorithm_version text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, day_key)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  crew_id uuid,
  kind text not null check (kind in ('GENERAL', 'COACH_COMPLETED', 'BADGE_UNLOCKED', 'RACE_GOAL', 'CREW_NOTICE', 'CREW_EVENT')),
  body text not null check (char_length(body) between 1 and 2000),
  visibility text not null default 'PUBLIC' check (visibility in ('PUBLIC', 'CREW', 'NEIGHBORHOOD')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'AUTHOR_DELETED', 'QUARANTINED', 'REMOVED')),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  check (
    (visibility = 'CREW' and crew_id is not null)
    or (visibility <> 'CREW' and crew_id is null)
  )
);
create index posts_public_created_idx on public.posts(visibility, created_at desc) where status = 'ACTIVE';

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'AUTHOR_DELETED', 'QUARANTINED', 'REMOVED')),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index comments_post_created_idx on public.comments(post_id, created_at);

create table public.reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('CHEER', 'COOL', 'TOGETHER', 'CONSISTENT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('POST', 'COMMENT', 'PROFILE', 'CREW')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 2 and 100),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'OPEN' check (status in ('OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED')),
  created_at timestamptz not null default now()
);
create index reports_open_idx on public.reports(status, created_at) where status in ('OPEN', 'REVIEWING');

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  target_type text not null,
  target_id uuid not null,
  action text not null,
  reason text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  moderation_action_id uuid not null references public.moderation_actions(id) on delete cascade,
  body text not null check (char_length(body) between 10 and 2000),
  status text not null default 'OPEN' check (status in ('OPEN', 'REVIEWING', 'ACCEPTED', 'REJECTED')),
  created_at timestamptz not null default now(),
  unique (user_id, moderation_action_id)
);

create table public.crews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 30),
  description text not null default '' check (char_length(description) <= 1000),
  visibility text not null check (visibility in ('PUBLIC', 'APPROVAL', 'PRIVATE')),
  capacity integer not null default 50 check (capacity between 3 and 500),
  neighborhood_code text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'ARCHIVED', 'DELETING')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.posts
  add constraint posts_crew_id_fkey foreign key (crew_id) references public.crews(id) on delete cascade;

create table public.crew_members (
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER', 'PENDING', 'BANNED')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create unique index crew_members_one_owner_per_crew
  on public.crew_members(crew_id)
  where role = 'OWNER';

create table public.crew_events (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 2 and 80),
  starts_at timestamptz not null,
  capacity integer check (capacity is null or capacity between 1 and 500),
  place_public text,
  place_members text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'CANCELLED', 'COMPLETED')),
  created_at timestamptz not null default now()
);

create table public.crew_event_attendance (
  event_id uuid not null references public.crew_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('ATTENDING', 'MAYBE', 'DECLINED', 'WAITLIST')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table public.badge_definitions (
  id text primary key,
  title text not null,
  description text not null,
  rule_version text not null,
  rule_json jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id text not null references public.badge_definitions(id) on delete restrict,
  rule_version text not null,
  source_event_id uuid not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoke_reason text,
  primary key (user_id, badge_id, source_event_id)
);

create table public.weekly_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_key date not null,
  competitive_days integer not null check (competitive_days between 0 and 5),
  bonus_runs integer not null check (bonus_runs between 0 and 3),
  score integer not null check (score between 0 and 8),
  algorithm_version text not null,
  settled_at timestamptz not null,
  primary key (user_id, week_key)
);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  week_key date not null,
  league_type text not null check (league_type in ('PERSONAL_COHORT', 'CREW', 'NEIGHBORHOOD')),
  cohort_key text not null,
  methodology_version text not null,
  status text not null default 'SETTLED' check (status in ('OPEN', 'SETTLING', 'SETTLED', 'REVOKED')),
  created_at timestamptz not null default now()
);

create table public.leaderboard_snapshots (
  league_id uuid not null references public.leagues(id) on delete cascade,
  subject_id text not null,
  normalized_score numeric(8, 4) not null,
  rank integer,
  snapshot_at timestamptz not null,
  primary key (league_id, subject_id)
);

create table public.neighborhood_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check (status in ('DEVICE_LOCATION_CONFIRMED', 'USER_SELECTED', 'EXPIRED', 'RISK_REVIEW')),
  administrative_code text not null,
  accuracy_bucket text,
  boundary_data_version text,
  confirmed_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.release_manifests (
  content_version text primary key,
  schema_version integer not null,
  minimum_app_version text not null,
  generated_at timestamptz not null,
  checksums jsonb not null,
  record_counts jsonb not null,
  published boolean not null default false
);

create table public.deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'REQUESTED' check (status in ('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index deletion_jobs_one_active_per_user
  on public.deletion_jobs(user_id)
  where status in ('REQUESTED', 'PROCESSING');

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_consents enable row level security;
alter table public.activities enable row level security;
alter table public.daily_activities enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.appeals enable row level security;
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.crew_events enable row level security;
alter table public.crew_event_attendance enable row level security;
alter table public.badge_definitions enable row level security;
alter table public.user_badges enable row level security;
alter table public.weekly_scores enable row level security;
alter table public.leagues enable row level security;
alter table public.leaderboard_snapshots enable row level security;
alter table public.neighborhood_status enable row level security;
alter table public.feature_flags enable row level security;
alter table public.release_manifests enable row level security;
alter table public.deletion_jobs enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.can_view_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is null
    or auth.uid() = target_user_id
    or (
      not exists (
        select 1
        from public.blocks
        where (blocker_id = auth.uid() and blocked_id = target_user_id)
           or (blocker_id = target_user_id and blocked_id = auth.uid())
      )
    );
$$;

revoke all on function public.can_view_user(uuid) from public;
grant execute on function public.can_view_user(uuid) to anon, authenticated;

create or replace function public.is_active_crew_member(target_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.crew_members
      where crew_id = target_crew_id
        and user_id = auth.uid()
        and role in ('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER')
    );
$$;

revoke all on function public.is_active_crew_member(uuid) from public;
grant execute on function public.is_active_crew_member(uuid) to anon, authenticated;

create or replace function public.has_crew_role(
  target_crew_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.crew_members
      where crew_id = target_crew_id
        and user_id = auth.uid()
        and role = any(allowed_roles)
    );
$$;

revoke all on function public.has_crew_role(uuid, text[]) from public;
grant execute on function public.has_crew_role(uuid, text[]) to authenticated;

create or replace function public.can_view_post(target_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.posts p
    where p.id = target_post_id
      and p.status = 'ACTIVE'
      and public.can_view_user(p.author_id)
      and (
        p.author_id = auth.uid()
        or p.visibility = 'PUBLIC'
        or (p.visibility = 'CREW' and public.is_active_crew_member(p.crew_id))
      )
  );
$$;

revoke all on function public.can_view_post(uuid) from public;
grant execute on function public.can_view_post(uuid) to anon, authenticated;

create or replace function public.can_interact_with_post(target_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and public.can_view_post(target_post_id);
$$;

create or replace function public.can_attend_crew_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.crew_events e
      where e.id = target_event_id
        and e.status = 'ACTIVE'
        and public.is_active_crew_member(e.crew_id)
    );
$$;

revoke all on function public.can_attend_crew_event(uuid) from public;
grant execute on function public.can_attend_crew_event(uuid) to authenticated;

revoke all on function public.can_interact_with_post(uuid) from public;
grant execute on function public.can_interact_with_post(uuid) to authenticated;

create or replace function public.account_can_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and not exists (
      select 1
      from public.deletion_jobs
      where user_id = auth.uid()
        and status in ('REQUESTED', 'PROCESSING')
    );
$$;

revoke all on function public.account_can_write() from public;
grant execute on function public.account_can_write() to authenticated;

create or replace function public.record_user_consent(
  next_consent_type text,
  next_consent_version text,
  next_action text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  consent_id uuid;
begin
  if caller_id is null or not public.account_can_write() then
    raise exception 'account is not writable';
  end if;
  if char_length(trim(next_consent_type)) not between 2 and 80
    or char_length(trim(next_consent_version)) not between 1 and 40
    or next_action not in ('ACCEPTED', 'REVOKED') then
    raise exception 'invalid consent event';
  end if;

  insert into public.user_consents(user_id, consent_type, consent_version, action)
  values (caller_id, trim(next_consent_type), trim(next_consent_version), next_action)
  on conflict (user_id, consent_type, consent_version, action)
  do nothing
  returning id into consent_id;
  if consent_id is null then
    select id into consent_id
    from public.user_consents
    where user_id = caller_id
      and consent_type = trim(next_consent_type)
      and consent_version = trim(next_consent_version)
      and action = next_action;
  end if;
  return consent_id;
end;
$$;

revoke all on function public.record_user_consent(text, text, text) from public;
grant execute on function public.record_user_consent(text, text, text) to authenticated;

create or replace function public.set_featured_badge(next_badge_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null or not public.account_can_write() then
    raise exception 'account is not writable';
  end if;
  if next_badge_id is not null and not exists (
    select 1
    from public.user_badges
    where user_id = caller_id
      and badge_id = next_badge_id
      and revoked_at is null
  ) then
    raise exception 'badge is not owned';
  end if;

  update public.profiles
  set featured_badge_id = next_badge_id,
      updated_at = now()
  where user_id = caller_id;
end;
$$;

revoke all on function public.set_featured_badge(text) from public;
grant execute on function public.set_featured_badge(text) to authenticated;

create or replace function public.submit_report(
  next_target_type text,
  next_target_id uuid,
  next_reason text,
  next_details text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  report_id uuid;
  target_exists boolean := false;
begin
  if caller_id is null or not public.account_can_write() then
    raise exception 'account is not writable';
  end if;
  if next_target_type not in ('POST', 'COMMENT', 'PROFILE', 'CREW')
    or char_length(trim(next_reason)) not between 2 and 100
    or char_length(next_details) > 1000 then
    raise exception 'invalid report';
  end if;
  if (
    select count(*)
    from public.reports
    where reporter_id = caller_id and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'report rate limit exceeded';
  end if;

  case next_target_type
    when 'POST' then
      select exists(select 1 from public.posts where id = next_target_id) into target_exists;
    when 'COMMENT' then
      select exists(select 1 from public.comments where id = next_target_id) into target_exists;
    when 'PROFILE' then
      select exists(select 1 from public.profiles where user_id = next_target_id) into target_exists;
    when 'CREW' then
      select exists(select 1 from public.crews where id = next_target_id) into target_exists;
  end case;
  if not target_exists then
    raise exception 'report target does not exist';
  end if;
  if exists (
    select 1
    from public.reports
    where reporter_id = caller_id
      and target_type = next_target_type
      and target_id = next_target_id
      and status in ('OPEN', 'REVIEWING')
  ) then
    raise exception 'report already open';
  end if;

  insert into public.reports(reporter_id, target_type, target_id, reason, details)
  values (caller_id, next_target_type, next_target_id, trim(next_reason), trim(next_details))
  returning id into report_id;
  return report_id;
end;
$$;

revoke all on function public.submit_report(text, uuid, text, text) from public;
grant execute on function public.submit_report(text, uuid, text, text) to authenticated;

create or replace function public.request_account_deletion()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  job_id uuid;
begin
  if caller_id is null then
    raise exception 'authentication required';
  end if;

  select id into job_id
  from public.deletion_jobs
  where user_id = caller_id and status in ('REQUESTED', 'PROCESSING')
  order by requested_at desc
  limit 1;
  if job_id is not null then
    return job_id;
  end if;

  begin
    insert into public.deletion_jobs(user_id)
    values (caller_id)
    returning id into job_id;
  exception when unique_violation then
    select id into job_id
    from public.deletion_jobs
    where user_id = caller_id and status in ('REQUESTED', 'PROCESSING')
    order by requested_at desc
    limit 1;
  end;
  return job_id;
end;
$$;

revoke all on function public.request_account_deletion() from public;
grant execute on function public.request_account_deletion() to authenticated;

create or replace function public.prevent_comment_post_move()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.post_id <> new.post_id then
    raise exception 'comment post cannot change';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_comment_post_move() from public;
create trigger comments_post_immutable
before update on public.comments
for each row execute function public.prevent_comment_post_move();

create policy profiles_public_read on public.profiles for select
  using (
    user_id = auth.uid()
    or (profile_visibility = 'PUBLIC' and public.can_view_user(user_id))
  );
create policy profiles_own_insert on public.profiles for insert
  with check (
    user_id = auth.uid()
    and featured_badge_id is null
    and public.account_can_write()
  );
create policy profiles_own_update on public.profiles for update
  using (user_id = auth.uid() and public.account_can_write())
  with check (user_id = auth.uid() and public.account_can_write());

create policy profile_private_own_read on public.profile_private for select
  using (user_id = auth.uid());
create policy user_settings_own_all on public.user_settings for all
  using (user_id = auth.uid() and public.account_can_write())
  with check (user_id = auth.uid() and public.account_can_write());
create policy user_consents_own_read on public.user_consents for select
  using (user_id = auth.uid());
create policy activities_own_read on public.activities for select
  using (user_id = auth.uid());
create policy activities_self_logged_insert on public.activities for insert
  with check (
    user_id = auth.uid()
    and source = 'SELF_LOGGED'
    and public.account_can_write()
  );
create policy activities_self_logged_update on public.activities for update
  using (user_id = auth.uid() and source = 'SELF_LOGGED' and public.account_can_write())
  with check (user_id = auth.uid() and source = 'SELF_LOGGED' and public.account_can_write());
create policy activities_self_logged_delete on public.activities for delete
  using (user_id = auth.uid() and source = 'SELF_LOGGED' and public.account_can_write());
create policy daily_activities_own_read on public.daily_activities for select
  using (user_id = auth.uid());

create policy posts_visible_read on public.posts for select
  using (
    status = 'ACTIVE'
    and (
      author_id = auth.uid()
      or (visibility = 'PUBLIC' and public.can_view_user(author_id))
      or (visibility = 'CREW' and public.is_active_crew_member(crew_id))
    )
  );
create policy posts_own_insert on public.posts for insert
  with check (
    author_id = auth.uid()
    and public.account_can_write()
    and (
      (visibility = 'CREW' and crew_id is not null and public.is_active_crew_member(crew_id))
      or (visibility <> 'CREW' and crew_id is null)
    )
  );
create policy posts_own_update on public.posts for update
  using (author_id = auth.uid() and public.account_can_write())
  with check (
    author_id = auth.uid()
    and public.account_can_write()
    and (
      (visibility = 'CREW' and crew_id is not null and public.is_active_crew_member(crew_id))
      or (visibility <> 'CREW' and crew_id is null)
    )
  );

create policy comments_visible_read on public.comments for select
  using (
    status = 'ACTIVE'
    and public.can_view_user(author_id)
    and public.can_view_post(post_id)
  );
create policy comments_own_insert on public.comments for insert
  with check (
    author_id = auth.uid()
    and char_length(body) <= 500
    and public.account_can_write()
    and public.can_interact_with_post(post_id)
  );
create policy comments_own_update on public.comments for update
  using (author_id = auth.uid() and public.account_can_write())
  with check (
    author_id = auth.uid()
    and public.account_can_write()
    and public.can_interact_with_post(post_id)
  );

create policy reactions_visible_read on public.reactions for select
  using (public.can_view_user(user_id) and public.can_view_post(post_id));
create policy reactions_own_insert on public.reactions for insert
  with check (
    user_id = auth.uid()
    and public.account_can_write()
    and public.can_interact_with_post(post_id)
  );
create policy reactions_own_update on public.reactions for update
  using (user_id = auth.uid() and public.account_can_write())
  with check (
    user_id = auth.uid()
    and public.account_can_write()
    and public.can_interact_with_post(post_id)
  );
create policy reactions_own_delete on public.reactions for delete
  using (user_id = auth.uid() and public.account_can_write());

create policy blocks_own_all on public.blocks for all
  using (blocker_id = auth.uid() and public.account_can_write())
  with check (blocker_id = auth.uid() and public.account_can_write());
create policy reports_own_read on public.reports for select
  using (reporter_id = auth.uid());
create policy appeals_own_insert on public.appeals for insert
  with check (
    user_id = auth.uid()
    and status = 'OPEN'
    and public.account_can_write()
  );
create policy appeals_own_read on public.appeals for select
  using (user_id = auth.uid());

create policy crews_visible_read on public.crews for select
  using (
    status = 'ACTIVE'
    and (
      visibility = 'PUBLIC'
      or owner_id = auth.uid()
      or public.is_active_crew_member(id)
    )
  );
create policy crews_owner_update on public.crews for update
  using (owner_id = auth.uid() and public.account_can_write())
  with check (owner_id = auth.uid() and public.account_can_write());

create policy crew_members_visible_read on public.crew_members for select
  using (
    user_id = auth.uid()
    or public.has_crew_role(crew_id, array['OWNER', 'ADMIN', 'MODERATOR'])
    or (
      role in ('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER')
      and (
        public.is_active_crew_member(crew_id)
        or exists (
          select 1 from public.crews c
          where c.id = crew_members.crew_id and c.visibility = 'PUBLIC'
        )
      )
    )
  );
create policy crew_members_self_request on public.crew_members for insert
  with check (
    user_id = auth.uid()
    and role = 'PENDING'
    and public.account_can_write()
    and exists (
      select 1 from public.crews c
      where c.id = crew_members.crew_id
        and c.status = 'ACTIVE'
        and c.visibility in ('PUBLIC', 'APPROVAL')
    )
  );
create policy crew_members_self_leave on public.crew_members for delete
  using (
    user_id = auth.uid()
    and role not in ('OWNER', 'BANNED')
    and public.account_can_write()
  );

create policy crew_events_member_read on public.crew_events for select
  using (public.is_active_crew_member(crew_id));
create policy crew_events_manager_insert on public.crew_events for insert
  with check (
    created_by = auth.uid()
    and public.account_can_write()
    and public.has_crew_role(crew_id, array['OWNER', 'ADMIN', 'MODERATOR'])
  );
create policy crew_event_attendance_own_all on public.crew_event_attendance for all
  using (user_id = auth.uid() and public.account_can_write())
  with check (
    user_id = auth.uid()
    and public.account_can_write()
    and public.can_attend_crew_event(event_id)
  );

create policy badge_definitions_public_read on public.badge_definitions for select
  using (active);
create policy user_badges_visible_read on public.user_badges for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.user_id = user_badges.user_id
        and p.profile_visibility = 'PUBLIC'
        and public.can_view_user(p.user_id)
    )
  );
create policy weekly_scores_own_read on public.weekly_scores for select
  using (user_id = auth.uid());
create policy leagues_public_read on public.leagues for select using (status = 'SETTLED');
create policy leaderboard_public_read on public.leaderboard_snapshots for select
  using (
    exists (
      select 1 from public.leagues l
      where l.id = leaderboard_snapshots.league_id and l.status = 'SETTLED'
    )
  );
create policy neighborhood_own_all on public.neighborhood_status for all
  using (user_id = auth.uid() and public.account_can_write())
  with check (
    user_id = auth.uid()
    and status = 'USER_SELECTED'
    and public.account_can_write()
  );
create policy feature_flags_public_read on public.feature_flags for select using (true);
create policy release_manifests_public_read on public.release_manifests for select using (published);
create policy deletion_jobs_own_read on public.deletion_jobs for select
  using (user_id = auth.uid());

create or replace function public.create_crew(
  crew_name text,
  crew_description text,
  crew_visibility text,
  crew_capacity integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  created_crew_id uuid;
begin
  if caller_id is null or not public.account_can_write() then
    raise exception 'account is not writable';
  end if;
  if char_length(trim(crew_name)) not between 2 and 30 then
    raise exception 'invalid crew name';
  end if;
  if char_length(crew_description) > 1000 then
    raise exception 'invalid crew description';
  end if;
  if crew_visibility not in ('PUBLIC', 'APPROVAL', 'PRIVATE') then
    raise exception 'invalid crew visibility';
  end if;
  if crew_capacity not between 3 and 500 then
    raise exception 'invalid crew capacity';
  end if;

  insert into public.crews(owner_id, name, description, visibility, capacity)
    values (caller_id, trim(crew_name), crew_description, crew_visibility, crew_capacity)
    returning id into created_crew_id;
  insert into public.crew_members(crew_id, user_id, role)
    values (created_crew_id, caller_id, 'OWNER');
  insert into public.audit_logs(actor_id, action, target_type, target_id)
    values (caller_id, 'CREW_CREATED', 'CREW', created_crew_id::text);
  return created_crew_id;
end;
$$;

revoke all on function public.create_crew(text, text, text, integer) from public;
grant execute on function public.create_crew(text, text, text, integer) to authenticated;

create or replace function public.manage_crew_membership(
  target_crew_id uuid,
  target_user_id uuid,
  next_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
  current_target_role text;
  target_crew_capacity integer;
  active_member_count integer;
begin
  if auth.uid() is null or not public.account_can_write() then
    raise exception 'account is not writable';
  end if;
  select capacity into target_crew_capacity
  from public.crews
  where id = target_crew_id and status = 'ACTIVE'
  for update;
  if target_crew_capacity is null then
    raise exception 'active crew not found';
  end if;
  select role into caller_role
  from public.crew_members
  where crew_id = target_crew_id and user_id = auth.uid()
  for update;
  if caller_role not in ('OWNER', 'ADMIN') then
    raise exception 'manager role required';
  end if;
  if next_role not in ('ADMIN', 'MODERATOR', 'MEMBER', 'PENDING', 'BANNED') then
    raise exception 'invalid next role';
  end if;

  select role into current_target_role
  from public.crew_members
  where crew_id = target_crew_id and user_id = target_user_id
  for update;
  if current_target_role is null then
    raise exception 'membership request not found';
  end if;
  if current_target_role = 'OWNER' then
    raise exception 'owner must use ownership transfer';
  end if;
  if caller_role = 'ADMIN' and (
    current_target_role = 'ADMIN'
    or next_role = 'ADMIN'
  ) then
    raise exception 'admin cannot manage another admin';
  end if;
  if current_target_role = 'BANNED' and caller_role <> 'OWNER' then
    raise exception 'only owner can restore a banned member';
  end if;
  if current_target_role = 'PENDING'
    and next_role not in ('MEMBER', 'BANNED', 'PENDING') then
    raise exception 'pending member must be approved or banned first';
  end if;
  if next_role in ('ADMIN', 'MODERATOR', 'MEMBER')
    and current_target_role not in ('ADMIN', 'MODERATOR', 'MEMBER') then
    select count(*) into active_member_count
    from public.crew_members
    where crew_id = target_crew_id
      and role in ('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER');
    if active_member_count >= target_crew_capacity then
      raise exception 'crew capacity reached';
    end if;
  end if;

  update public.crew_members
  set role = next_role, updated_at = now()
  where crew_id = target_crew_id and user_id = target_user_id;
  insert into public.audit_logs(actor_id, action, target_type, target_id, payload)
    values (
      auth.uid(),
      'CREW_MEMBERSHIP_CHANGED',
      'CREW_MEMBER',
      target_user_id::text,
      jsonb_build_object('crew_id', target_crew_id, 'next_role', next_role)
    );
end;
$$;

revoke all on function public.manage_crew_membership(uuid, uuid, text) from public;
grant execute on function public.manage_crew_membership(uuid, uuid, text) to authenticated;

create or replace function public.update_crew_event(
  target_event_id uuid,
  next_title text,
  next_starts_at timestamptz,
  next_capacity integer,
  next_place_public text,
  next_place_members text,
  next_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_crew_id uuid;
begin
  if auth.uid() is null or not public.account_can_write() then
    raise exception 'account is not writable';
  end if;
  select crew_id into target_crew_id
  from public.crew_events
  where id = target_event_id;
  if target_crew_id is null
    or not public.has_crew_role(target_crew_id, array['OWNER', 'ADMIN', 'MODERATOR']) then
    raise exception 'manager role required';
  end if;
  if char_length(trim(next_title)) not between 2 and 80 then
    raise exception 'invalid event title';
  end if;
  if next_capacity is not null and next_capacity not between 1 and 500 then
    raise exception 'invalid event capacity';
  end if;
  if next_status not in ('ACTIVE', 'CANCELLED', 'COMPLETED') then
    raise exception 'invalid event status';
  end if;

  update public.crew_events
  set title = trim(next_title),
      starts_at = next_starts_at,
      capacity = next_capacity,
      place_public = next_place_public,
      place_members = next_place_members,
      status = next_status
  where id = target_event_id;
  insert into public.audit_logs(actor_id, action, target_type, target_id)
    values (auth.uid(), 'CREW_EVENT_UPDATED', 'CREW_EVENT', target_event_id::text);
end;
$$;

revoke all on function public.update_crew_event(
  uuid, text, timestamptz, integer, text, text, text
) from public;
grant execute on function public.update_crew_event(
  uuid, text, timestamptz, integer, text, text, text
) to authenticated;

create or replace function public.transfer_crew_ownership(
  target_crew_id uuid,
  next_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  locked_owner_id uuid;
begin
  if caller_id is null or not public.account_can_write() then
    raise exception 'account is not writable';
  end if;
  select owner_id into locked_owner_id
  from public.crews
  where id = target_crew_id and status = 'ACTIVE'
  for update;
  if locked_owner_id is null or locked_owner_id <> caller_id then
    raise exception 'only current owner can transfer';
  end if;
  if not exists (
    select 1 from public.crew_members
    where crew_id = target_crew_id
      and user_id = next_owner_id
      and role in ('ADMIN', 'MODERATOR', 'MEMBER')
  ) then
    raise exception 'next owner must be an active member';
  end if;

  update public.crews
  set owner_id = next_owner_id, updated_at = now()
  where id = target_crew_id and owner_id = caller_id;
  if not found then
    raise exception 'ownership changed concurrently';
  end if;
  update public.crew_members set role = 'MEMBER', updated_at = now()
    where crew_id = target_crew_id and user_id = caller_id;
  update public.crew_members set role = 'OWNER', updated_at = now()
    where crew_id = target_crew_id and user_id = next_owner_id;
  insert into public.audit_logs(actor_id, action, target_type, target_id, payload)
    values (
      caller_id,
      'CREW_OWNER_TRANSFERRED',
      'CREW',
      target_crew_id::text,
      jsonb_build_object('next_owner_id', next_owner_id)
    );
end;
$$;

revoke all on function public.transfer_crew_ownership(uuid, uuid) from public;
grant execute on function public.transfer_crew_ownership(uuid, uuid) to authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.badge_definitions, public.leagues,
  public.feature_flags, public.release_manifests to anon, authenticated;
grant select on public.profiles, public.posts, public.comments, public.reactions to anon;
grant select, insert on public.profiles to authenticated;
grant update (nickname, bio, avatar_path, neighborhood_visibility, profile_visibility, updated_at)
  on public.profiles to authenticated;
grant select (user_id, legal_consent_at, created_at, updated_at)
  on public.profile_private to authenticated;
grant select on public.user_consents to authenticated;
grant select, insert, update, delete on public.user_settings, public.activities,
  public.comments, public.reactions, public.blocks, public.neighborhood_status to authenticated;
grant select, insert, update on public.posts to authenticated;
grant select, insert on public.appeals to authenticated;
grant select on public.reports, public.deletion_jobs to authenticated;
grant select, update on public.crews to authenticated;
grant select, insert, delete on public.crew_members to authenticated;
grant select, insert on public.crew_events to authenticated;
grant select, insert, update on public.crew_event_attendance to authenticated;
grant delete on public.crew_event_attendance to authenticated;
grant select on public.user_badges, public.weekly_scores to authenticated;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

create view public.public_profiles
with (security_invoker = true)
as
select user_id, nickname, bio, avatar_path, featured_badge_id, neighborhood_visibility, created_at
from public.profiles
where profile_visibility = 'PUBLIC';

create view public.public_posts
with (security_invoker = true)
as
select
  p.id,
  p.author_id,
  pr.nickname as author_nickname,
  p.body,
  p.kind,
  p.visibility,
  p.created_at,
  p.edited_at,
  coalesce(
    (
      select jsonb_object_agg(grouped.kind, grouped.reaction_count)
      from (
        select r.kind, count(*)::integer as reaction_count
        from public.reactions r
        where r.post_id = p.id
        group by r.kind
      ) grouped
    ),
    '{}'::jsonb
  ) as reaction_counts,
  (select count(*)::integer from public.comments c where c.post_id = p.id and c.status = 'ACTIVE') as comment_count
from public.posts p
join public.profiles pr on pr.user_id = p.author_id
where p.status = 'ACTIVE' and p.visibility = 'PUBLIC';

create view public.public_leaderboard
as
select
  s.league_id,
  encode(digest(s.subject_id, 'sha256'), 'hex') as opaque_subject_id,
  s.normalized_score,
  s.rank,
  s.snapshot_at
from public.leaderboard_snapshots s
join public.leagues l on l.id = s.league_id
where l.status = 'SETTLED';

grant select on public.public_profiles, public.public_posts, public.public_leaderboard
  to anon, authenticated;

grant select on public.public_profiles, public.public_posts to anon, authenticated;
