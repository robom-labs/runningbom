# RUNNINGBOM vNext Prompt Read Receipt

> 이 문서는 CODEX FIRST PASS v11 전체를 읽은 뒤 제품 코드 변경 전에 작성한 실행 영수증이다.

## Receipt

- Prompt version: `CODEX FIRST PASS v11 — SINGLE PASTE EDITION`
- Read started at: `2026-07-26T15:30:00+09:00` (session estimate)
- Read completed at: `2026-07-26T15:35:42+09:00`
- Total numbered sections: `33` (`0` through `32`)
- Prompt read: `COMPLETE`
- Release stage: `CODE_ONLY`
- New paid services planned: `0`

## Section receipt

| Section | Topic | Status |
| --- | --- | --- |
| 0 | 절대 선행 규칙 | `read_complete` |
| 1 | 이번 요청의 기본 의미 | `read_complete` |
| 2 | 최종 제품 목표 | `read_complete` |
| 3 | 정본 우선순위 | `read_complete` |
| 4 | 저장소·Git 절대 보호규칙 | `read_complete` |
| 5 | 첫 출시 범위 | `read_complete` |
| 6 | 최종 UX·비주얼 | `read_complete` |
| 7 | 기존 대회 회귀계약 R-01~R-26 | `read_complete` |
| 8 | 아키텍처 | `read_complete` |
| 9 | 무료 한국어 음성 코치 | `read_complete` |
| 10 | 로컬 저장·오프라인 | `read_complete` |
| 11 | 스트릭·배지·티어 | `read_complete` |
| 12 | 꾸준함 리그 | `read_complete` |
| 13 | 러닝화 | `read_complete` |
| 14 | 정적 데이터·자동 성장 | `read_complete` |
| 15 | 로그인 4종 | `read_complete` |
| 16 | 프로필·아바타 | `read_complete` |
| 17 | 커뮤니티 | `read_complete` |
| 18 | 크루 | `read_complete` |
| 19 | 동네 확인 | `read_complete` |
| 20 | Supabase·DB·RLS | `read_complete` |
| 21 | 개인정보·정책 | `read_complete` |
| 22 | 자동 보안·운영 | `read_complete` |
| 23 | Preview APK | `read_complete` |
| 24 | production-candidate AAB | `read_complete` |
| 25 | 6단계 안전 배포 상태머신 | `read_complete` |
| 26 | Release Guard 구현 | `read_complete` |
| 27 | 전체 실행 단계 | `read_complete` |
| 28 | 테스트 체크리스트 | `read_complete` |
| 29 | 필수 산출물 | `read_complete` |
| 30 | 사용자 확인 방법 | `read_complete` |
| 31 | 최종 상태와 보고 형식 | `read_complete` |
| 32 | 작업 종료 전 최종 자기검증 | `read_complete` |

## Starting repository state

- Repository: `robom-labs/runningbom`
- Worktree: `/Users/runner706/Documents/Codex/2026-07-11/01-2/work/vnext-runningbom`
- Branch: `r01/runningbom-vnext-first-pass`
- Base: `origin/main`
- Starting SHA: `aa8fee4bac96cda5377c761b7e96446eb7922257`
- Starting app version: `0.18.3`
- Starting Android versionCode: `6`
- Starting iOS buildNumber: `5`
- Dirty worktree before receipt: `NO`
- Open pull requests: `0`
- Existing closed-test release: read-only revalidation pending
- Existing Play tracks must remain unchanged: `YES`

## Conflicts and decisions

1. 코드의 직접 `main` 반영 정책과 Play 변경 금지는 충돌하지 않는다. 코드·웹은 전체 gate 후 저장소 정책에 따라 반영할 수 있지만 Play 트랙은 읽기 전용으로 유지한다.
2. `production-candidate AAB` 생성 요구와 Play 업로드 금지는 충돌하지 않는다. 후보 artifact는 로컬 또는 EAS build까지만 만들고 Submit은 실행하지 않는다.
3. 로그인 4종·Supabase·동네 확인은 외부 계정·법률·provider 설정 없이 실제 운영 활성화할 수 없다. 코드는 feature flag와 adapter, 로컬 검증까지만 만들고 비활성 상태를 정확히 표시한다.
4. 삼성·Pixel·전화·Bluetooth·절전모드 실기기 검증은 실기기와 사람이 필요하다. 실행 증거가 없으면 `BLOCKED_EXTERNAL` 또는 `NOT_RUN`으로 남긴다.
5. 현재 저장소는 모바일 코드가 소수 파일에 집중된 작은 Expo 앱이다. 기존 대회 회귀를 먼저 고정한 뒤 기능별 domain으로 분리한다.
6. 현재 비공개 테스터는 기존 `0.18.3`을 계속 사용해야 한다. 이번 작업에서 Play internal, closed, production은 변경하지 않는다.

## Runtime revalidation required

- Play Console의 실제 최고 사용 versionCode와 각 track 상태
- EAS 로그인·프로젝트·업로드 인증서 상태
- Play App Signing SHA-256
- Supabase 프로젝트 연결 여부
- Google, Kakao, Naver, Apple provider 자격과 redirect URI
- 삼성·Pixel 실기기 availability
- 최신 공식 Supabase Free plan 한도와 동네 경계 데이터 라이선스
- 현재 GitHub Pages 배포 SHA와 운영 smoke

## External user or account-owner actions

- Supabase 프로젝트 생성·실제 연결
- OAuth 앱 등록과 client ID·secret 입력
- Play Console 정책 양식, 전경 서비스 선언, Data Safety, Health Apps, UGC 제출
- Play 테스트 트랙 변경·게시
- 법률 검토
- 실사용자 이메일 입력
- 실기기에서 장시간·통화·이어폰·절전모드 검증

## Codex-executable scope

- 기존 대회 기능 회귀 테스트와 domain 분리
- 5탭 shell, Today Run, 탐색, 시작, 커뮤니티, 마이 UX
- 로컬 코칭·기록·스트릭·배지·티어·러닝화 기능과 fallback
- 소셜·크루·리그·동네·인증 adapter와 feature flag 기반 foundation
- 로컬 Supabase migration·RLS·negative test
- 개인정보·운영·보안·Release Guard 문서와 자동 검사
- Preview APK·candidate AAB 생성 시도와 정적 검증
- Git·CI·웹 smoke와 Claude Code 인계 자료

