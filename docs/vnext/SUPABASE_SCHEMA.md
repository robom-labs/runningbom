# 러닝봄 Supabase 스키마

## 적용 상태

스키마 정본은 `supabase/migrations/20260726071733_vnext_social_foundation.sql`이다. 이 migration을 로컬 또는 원격 Supabase에 실제 적용하지 않았으므로 배포 상태는 `BLOCKED_EXTERNAL`이다.

## 테이블

### 신원과 사용자 설정

- `profiles`
- `profile_private`
- `user_settings`
- `user_consents`

### 활동과 배지

- `activities`
- `daily_activities`
- `badge_definitions`
- `user_badges`

### 커뮤니티와 운영

- `posts`
- `comments`
- `reactions`
- `blocks`
- `reports`
- `moderation_actions`
- `appeals`

### 크루

- `crews`
- `crew_members`
- `crew_events`
- `crew_event_attendance`

### 리그와 동네

- `weekly_scores`
- `leagues`
- `leaderboard_snapshots`
- `neighborhood_status`

### 운영

- `feature_flags`
- `release_manifests`
- `deletion_jobs`
- `audit_logs`

모든 테이블에 RLS를 활성화하는 SQL이 있다.

## 공개 projection

- `public_profiles`
- `public_posts`

공개 앱 읽기는 private 필드를 직접 선택하는 대신 projection을 사용하도록 설계돼 있다.

## 보안 함수

- `can_view_user`
- `is_active_crew_member`
- `has_crew_role`
- `can_view_post`
- `can_interact_with_post`
- `can_attend_crew_event`
- `create_crew`
- `manage_crew_membership`
- `update_crew_event`
- `transfer_crew_ownership`

함수는 `search_path = ''`를 사용하고, public 실행 권한을 회수한 뒤 필요한 role에만 grant하는 SQL을 포함한다.

## 앱의 보호 모드

| 모드 | 의미 |
|---|---|
| `NORMAL` | 서버 읽기와 쓰기 허용 |
| `LIMITED_WRITE` | 일부 쓰기 제한을 위한 상태 |
| `READ_ONLY_COMMUNITY` | 공개 읽기만 허용 |
| `CORE_ONLY` | Supabase 없이 로컬 코어만 사용 |

Supabase가 없으면 `CORE_ONLY`다. Supabase가 있지만 모드가 지정되지 않으면 `READ_ONLY_COMMUNITY`다.

## 아직 없는 운영 구성

- 실제 Supabase 프로젝트 연결
- migration 적용 증거
- provider 설정
- 권위 배지·점수 계산 작업자
- deletion job 처리 worker
- 운영자 moderation UI
- 백업 저장소와 복구 훈련
- 실제 사용자 JWT 기반 RLS 공격 테스트
