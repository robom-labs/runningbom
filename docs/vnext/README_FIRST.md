<!-- 다음 작업자가 코드 변경 전에 가장 먼저 읽는 러닝봄 작업 안내입니다. -->
# 러닝봄 업데이트 시작 안내

## 1. 먼저 확인할 파일

1. `git status --short`, `git log --oneline -10`, `git fetch origin && git log origin/main -1`로 현재 기준선을 확인합니다.
2. `README.md`와 `AGENTS.md`가 있으면 먼저 읽습니다.
3. 이 폴더의 `BASELINE.md`, `CODEX_KNOWN_GAPS.md`, `HANDOFF_CODEX_TO_CLAUDE.md`, `FINAL_TRACEABILITY_MATRIX.md`를 순서대로 읽습니다.
4. 기존 대회 회귀는 반드시 `RACE_REGRESSION_MATRIX.md`의 R-01~R-26을 기준으로 확인합니다.

## 2. 코드 위치

| 영역 | 시작 위치 | 책임 |
| --- | --- | --- |
| 실제 모바일 앱 | `apps/mobile/` | Expo/Android 앱과 실제 기능 |
| 대회 도메인 | `apps/mobile/domains/races/` | 대회 필터, 상세, 알림, 원격 데이터 |
| 코칭 도메인 | `apps/mobile/domains/coaching/` | 세션·큐·기기 TTS·백그라운드 동작 |
| 러닝화 도메인 | `apps/mobile/domains/shoes/` | 공식 출처·카탈로그·비교 |
| 공개 웹 | `outputs/pushrun-site/` | GitHub Pages 운영 사이트 |
| 현재 UX 미리보기 | `outputs/pushrun-site/preview/` | 설치 전 화면·흐름 검토용. 운영 앱과 별개 |
| 미리보기 데이터 | `outputs/pushrun-site/preview/data/` | 대회·신발·코칭·기록 예시 데이터 |
| 미리보기 화면 | `outputs/pushrun-site/preview/screens/` | 홈·탐색·시작·커뮤니티·마이 화면 |
| 미리보기 제어 | `outputs/pushrun-site/preview/app.js` | 상태, 클릭, 웹 음성 예시 |

## 3. 2026-07-26 미리보기 업데이트 상태

- 대회는 이전 카드형 구조를 유지하고, 종목이 아닌 실제 대회 수로 셉니다.
- 러닝화는 탐색 안에서만 구분하고, 국내 공식몰·네이버 쇼핑·쿠팡 검색 링크로 연결합니다.
- 시작 화면은 베이스·인터벌·템포·롱런·회복 세션으로 정리했습니다.
- 기록 달력은 `마이 → 기록`에 두었습니다. 외부 건강 데이터 연결은 아직 구현 전이며, Health Connect·Garmin·Nike는 각 공식 승인과 동의가 필요합니다.
- 웹의 음성 버튼은 브라우저가 제공하는 가장 적절한 한국어 시스템 음성을 선택해 예시만 재생합니다. 사람 목소리 파일을 가장하거나, 실제 Android 백그라운드 코칭을 대신하지 않습니다.

## 4. 다음 작업 우선순위

1. 실제 Android 코칭 세션을 현재 Preview 세션 계약과 맞추고, 인터벌 단계 전환·10초 전 알림 테스트를 추가합니다.
2. 러닝화 데이터를 무작정 늘리지 말고 국내 공식 제품 URL, 확인일, 국내 판매 상태를 검증하는 수집/검토 흐름을 먼저 만듭니다.
3. Health Connect는 Android 권한·개인정보처리방침·수동 기록과의 중복 규칙을 확정한 뒤 연결합니다.
4. Garmin·Nike는 공식 파트너/개발자 승인이 확인되기 전까지 버튼을 비활성 설명 상태로 유지합니다.

## 5. 변경 원칙

- 기존 Play 비공개 테스트 트랙, 테스터 목록, 업로드된 AAB는 별도 명시 승인이 없으면 변경하지 않습니다.
- 실제 데이터가 검증되지 않은 정보, 가격, 출시일은 추가하지 않습니다.
- 앱 코드와 미리보기는 각각 테스트하고, 미리보기만 바뀐 것을 네이티브 기능 완료라고 보고하지 않습니다.
