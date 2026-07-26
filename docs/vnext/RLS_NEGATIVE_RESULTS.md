# 러닝봄 RLS 부정 테스트 결과

## 결론

RLS 정책과 SECURITY DEFINER 방어 코드는 정적으로 확인했다. 실제 Supabase 인스턴스와 서로 다른 사용자 JWT로 공격 테스트를 실행하지 않았으므로 모든 런타임 부정 테스트는 `BLOCKED_EXTERNAL`이다.

## 정적으로 확인한 방어

| 영역 | 코드에 있는 방어 | 상태 |
|---|---|---|
| 사용자 private 정보 | 본인 기준 정책 | PASS_CODE |
| 활동 | 본인 기준 정책 | PASS_CODE |
| 게시물 | 공개범위와 block 관계를 보는 정책 | PASS_CODE |
| 댓글·반응 | 보이는 게시물과 본인 쓰기 조건 | PASS_CODE |
| 차단 | blocker 본인 기준 정책 | PASS_CODE |
| 신고 | reporter 본인 insert·read | PASS_CODE |
| 크루 | 역할과 활성 멤버 조건 | PASS_CODE |
| 배지·점수 | client insert 정책 없음 | PASS_CODE |
| 리그 | 정산 완료 상태만 공개 읽기 | PASS_CODE |
| 삭제 요청 | 본인 insert·read | PASS_CODE |
| SECURITY DEFINER | fixed empty search path와 제한 grant | PASS_CODE |

`PASS_CODE`는 SQL에 규칙이 있다는 뜻이며 실제 DB에서 우회가 불가능하다는 증명이 아니다.

## 필요한 부정 테스트

| 테스트 | 기대 결과 | 현재 상태 |
|---|---|---|
| 사용자 A가 사용자 B의 `profile_private` 읽기 | 거부 | BLOCKED_EXTERNAL |
| 사용자 A가 사용자 B의 activity 읽기·수정 | 거부 | BLOCKED_EXTERNAL |
| 차단 관계에서 양방향 게시물 읽기 | 거부 | BLOCKED_EXTERNAL |
| client가 `user_badges` insert | 거부 | BLOCKED_EXTERNAL |
| client가 `weekly_scores` insert | 거부 | BLOCKED_EXTERNAL |
| 일반 멤버가 ADMIN으로 승격 | 거부 | BLOCKED_EXTERNAL |
| ADMIN이 OWNER를 탈취 | 거부 | BLOCKED_EXTERNAL |
| 마지막 OWNER 탈퇴 | 거부 | BLOCKED_EXTERNAL |
| 비멤버가 private crew event 위치 읽기 | 거부 | BLOCKED_EXTERNAL |
| reporter가 다른 reporter 정보 읽기 | 거부 | BLOCKED_EXTERNAL |
| 다른 user UUID를 RPC 인자로 전달 | 거부 | BLOCKED_EXTERNAL |
| 함수 search path 오염 | 거부 | BLOCKED_EXTERNAL |
| anon이 moderation·audit 읽기 | 거부 | BLOCKED_EXTERNAL |

## 실행 전 준비

1. 임시 Supabase 프로젝트 또는 로컬 Supabase를 준비한다.
2. migration을 깨끗한 DB에 적용한다.
3. anon, 사용자 A, 사용자 B, crew owner, crew member JWT를 만든다.
4. 각 요청의 HTTP 상태와 Postgres 오류 코드를 기록한다.
5. 허용 테스트와 거부 테스트를 함께 실행한다.
6. 테스트 후 임시 사용자와 데이터를 삭제한다.

실행 로그가 생기기 전에는 RLS를 출시 검증 완료로 표시하면 안 된다.
