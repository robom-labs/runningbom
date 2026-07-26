// Supabase 연결 전에도 RLS, 권한, 좌표 비수집과 SECURITY DEFINER 계약을 정적으로 검증합니다.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const migrationUrl = new URL(
  '../supabase/migrations/20260726071733_vnext_social_foundation.sql',
  import.meta.url,
);
const migration = await readFile(migrationUrl, 'utf8');
const mobileFiles = await Promise.all(
  [
    '../apps/mobile/services/supabase/client.ts',
    '../apps/mobile/services/supabase/community.ts',
    '../apps/mobile/domains/identity/auth.ts',
  ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')),
);
const deletionWorker = await readFile(
  new URL('../supabase/functions/process-deletion-jobs/index.ts', import.meta.url),
  'utf8',
);

const userTables = [
  'profiles',
  'profile_private',
  'user_settings',
  'user_consents',
  'activities',
  'daily_activities',
  'posts',
  'comments',
  'reactions',
  'blocks',
  'reports',
  'moderation_actions',
  'appeals',
  'crews',
  'crew_members',
  'crew_events',
  'crew_event_attendance',
  'badge_definitions',
  'user_badges',
  'weekly_scores',
  'leagues',
  'leaderboard_snapshots',
  'neighborhood_status',
  'feature_flags',
  'release_manifests',
  'deletion_jobs',
  'audit_logs',
];

test('모든 사용자 데이터 테이블은 RLS를 켠다', () => {
  for (const table of userTables) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security;`),
      `${table} RLS가 없습니다.`,
    );
  }
});

test('SECURITY DEFINER 함수는 빈 search_path와 public revoke를 갖는다', () => {
  const functions = [
    'can_view_user',
    'is_active_crew_member',
    'has_crew_role',
    'can_view_post',
    'can_interact_with_post',
    'can_attend_crew_event',
    'account_can_write',
    'record_user_consent',
    'set_featured_badge',
    'submit_report',
    'request_account_deletion',
    'create_crew',
    'manage_crew_membership',
    'update_crew_event',
    'transfer_crew_ownership',
  ];
  const normalized = migration.replace(/\s+/g, ' ');
  for (const name of functions) {
    assert.match(
      normalized,
      new RegExp(
        `create or replace function public\\.${name}\\([^)]*\\).*?security definer.*?set search_path = ''`,
      ),
      `${name}의 search_path 고정이 없습니다.`,
    );
    assert.match(
      normalized,
      new RegExp(`revoke all on function public\\.${name}\\(`),
      `${name}의 public revoke가 없습니다.`,
    );
  }
});

test('클라이언트가 공개 배지·점수·감사 로그를 직접 쓰지 못한다', () => {
  assert.doesNotMatch(migration, /grant\s+(?:insert|update|delete)[^;]*public\.user_badges/i);
  assert.doesNotMatch(migration, /grant\s+(?:insert|update|delete)[^;]*public\.weekly_scores/i);
  assert.doesNotMatch(migration, /grant\s+(?:insert|update|delete)[^;]*public\.audit_logs/i);
  assert.doesNotMatch(migration, /create policy .* on public\.audit_logs/i);
});

test('신뢰 활동·대표 배지·동의·이의신청은 직접 위조할 수 없다', () => {
  assert.match(migration, /create table public\.activities \([\s\S]*?id uuid primary key/);
  assert.match(migration, /local_uuid는 기기 식별자이며 활동별 멱등 키는 id입니다/);
  assert.match(
    migration,
    /create policy activities_self_logged_insert[\s\S]*source = 'SELF_LOGGED'/,
  );
  assert.doesNotMatch(migration, /create policy activities_own_all/);
  assert.match(migration, /create or replace function public\.set_featured_badge/);
  assert.match(migration, /badge is not owned/);
  assert.match(migration, /create policy user_consents_own_read/);
  assert.doesNotMatch(migration, /create policy user_consents_own_all/);
  assert.match(migration, /create policy appeals_own_insert/);
  assert.match(migration, /create policy appeals_own_read/);
  assert.doesNotMatch(migration, /create policy appeals_own_all/);
});

test('크루 소유권과 역할 승격은 직접 insert/update가 아니라 RPC로 제한한다', () => {
  assert.doesNotMatch(migration, /create policy crews_own_insert/);
  assert.doesNotMatch(migration, /create policy crew_members_.*update/);
  assert.match(migration, /create or replace function public\.create_crew/);
  assert.match(migration, /create or replace function public\.manage_crew_membership/);
  assert.match(migration, /create or replace function public\.transfer_crew_ownership/);
  assert.match(migration, /crew_members_one_owner_per_crew/);
  assert.match(migration, /for update;/i);
  assert.match(migration, /role not in \('OWNER', 'BANNED'\)/);
  assert.match(migration, /role in \('OWNER', 'ADMIN', 'MODERATOR', 'MEMBER'\)/);
});

test('게시물·댓글·신고는 참조 무결성과 서버 검증을 강제한다', () => {
  assert.match(
    migration,
    /\(visibility = 'CREW' and crew_id is not null\)[\s\S]*\(visibility <> 'CREW' and crew_id is null\)/,
  );
  assert.match(migration, /create trigger comments_post_immutable/);
  assert.match(migration, /create or replace function public\.submit_report/);
  assert.doesNotMatch(migration, /create policy reports_own_insert/);
  assert.match(migration, /report rate limit exceeded/);
});

test('계정 삭제는 RPC와 전용 worker로 처리하고 대기 계정의 쓰기를 막는다', () => {
  assert.match(migration, /create or replace function public\.request_account_deletion/);
  assert.match(migration, /create or replace function public\.account_can_write/);
  assert.doesNotMatch(migration, /create policy deletion_jobs_own_insert/);
  assert.match(deletionWorker, /admin\.auth\.admin\.deleteUser/);
  assert.match(deletionWorker, /DELETION_WORKER_SECRET/);
  assert.doesNotMatch(deletionWorker, /console\.log/);
});

test('동네 상태는 원시 좌표를 저장하지 않고 USER_SELECTED만 클라이언트가 쓴다', () => {
  const neighborhood = migration.match(
    /create table public\.neighborhood_status \(([\s\S]*?)\n\);/,
  )?.[1];
  assert.ok(neighborhood);
  assert.doesNotMatch(neighborhood, /\b(?:latitude|longitude|lat|lng|coordinate|point)\b/i);
  assert.match(
    migration,
    /create policy neighborhood_own_all[\s\S]*status = 'USER_SELECTED'/,
  );
});

test('모바일 번들에는 service role 키가 없다', () => {
  const source = mobileFiles.join('\n');
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/i);
  assert.doesNotMatch(source, /['"]service_role['"]/i);
});

test('로그인 수단 해제 직전에 서버의 실제 identity 목록을 다시 읽는다', () => {
  const source = mobileFiles.join('\n');
  assert.match(source, /supabase\.auth\.getUser\(\)/);
  assert.match(source, /currentIdentities\.length <= 1/);
});
