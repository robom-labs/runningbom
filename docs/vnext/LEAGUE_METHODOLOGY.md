# 러닝봄 꾸준함 리그 방법론

## 현재 구현 범위

현재 코드는 주간 점수를 계산하는 순수 함수와 리그 관련 DB 테이블·RLS 기초를 제공한다. cohort 편성, 주간 정산, 승급·강등, 크루 정규화, 동네 집계 작업자는 구현되지 않았다.

## 로컬 점수 함수

`weeklyLeagueScore(competitiveDays, thirtyMinuteRuns)`는 다음 규칙을 적용한다.

- 경쟁 활동 일수는 0일부터 5일까지로 제한한다.
- 30분 이상 러닝 보너스는 0회부터 3회까지로 제한한다.
- 점수는 제한된 활동 일수와 보너스 횟수의 합이다.
- 반환값의 `optedIn` 기본값은 `false`다.

자동 테스트에서 `9일, 7회` 입력이 `5일, 3회, 8점`으로 제한되는 것을 확인했다.

## 경쟁 활동 출처

현재 `activityCountsAsCompetitiveRun`은 다음 조건을 모두 만족해야 한다.

- 활동 종류가 `run`
- 10분 이상
- 출처가 `COACH_COMPLETED`

직접 입력 `SELF_LOGGED`는 개인 스트릭에는 들어갈 수 있지만 경쟁 점수에는 들어가지 않는다.

## opt-in

리그 참여 설정은 기본 `false`이며 AsyncStorage 설정에 보존한다. 앱 화면의 opt-in이 실제 서버 cohort 가입이나 정산을 수행하는 연결은 아직 없다.

## DB 기반

Supabase migration에는 다음이 존재한다.

- `weekly_scores`
- `leagues`
- `leaderboard_snapshots`
- 사용자 본인의 주간 점수 읽기 정책
- `SETTLED` 리그와 게시된 leaderboard 읽기 정책

client가 점수나 공개 순위를 직접 생성하는 insert 정책은 없다.

## 미구현 항목

| 항목 | 상태 |
|---|---|
| 30명 단위 주간 cohort | NOT_IMPLEMENTED |
| 서버 권위 점수 재계산 | NOT_IMPLEMENTED |
| 주간 idempotent settlement | NOT_IMPLEMENTED |
| 승급·강등 규칙 | NOT_IMPLEMENTED |
| 크루 상위 10명 평균과 최소 3명 | NOT_IMPLEMENTED |
| 동네 중앙값 또는 정규화 점수 | NOT_IMPLEMENTED |
| 이의제기 UI와 처리 흐름 | NOT_IMPLEMENTED |
| 실제 Supabase RLS 공격 테스트 | BLOCKED_EXTERNAL |

## 현재 사용자 표현

코드의 방향은 꾸준함 중심이며 직접 입력을 경쟁 점수에서 제외한다. 전체 세계 1등, 꼴찌 압박, 강등 독촉 알림은 구현돼 있지 않다.
