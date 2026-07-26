<!-- 다음 작업자가 코드 변경 전에 가장 먼저 읽는 러닝봄 작업 안내입니다. -->
# 러닝봄 업데이트 시작 안내

## 1. 먼저 확인할 파일

1. `git status --short`, `git log --oneline -10`, `git fetch origin && git log origin/main -1`로 현재 기준선을 확인합니다.
2. `README.md`와 `apps/mobile/README_FIRST.md`를 읽습니다.
3. 이 폴더에서 `VNEXT2_HANDOFF.md`(최신 인계) → `PREVIEW_APK.md`(설치본 배포) → `SHOE_DATA_REFRESH.md`(러닝화 갱신) 순으로 읽습니다.
4. 과거 이력이 필요하면 `BASELINE.md`, `CODEX_KNOWN_GAPS.md`, `HANDOFF_CODEX_TO_CLAUDE.md`, `FINAL_TRACEABILITY_MATRIX.md`를 참고합니다.
5. 대회 회귀는 `RACE_REGRESSION_MATRIX.md`의 R-01~R-26을 기준으로 확인합니다.

## 2. 코드 위치

| 영역 | 시작 위치 | 책임 |
| --- | --- | --- |
| 실제 모바일 앱 | `apps/mobile/` | Expo/Android 앱과 실제 기능 |
| 화면 이동·드로어 | `apps/mobile/app/navigation/` | 좌상단 메뉴, 라우트, 공통 헤더 |
| 대회 도메인 | `apps/mobile/domains/races/` | 대회 그룹 집계, 필터, 상세, 알림, 목표 대회 |
| 코칭 도메인 | `apps/mobile/domains/coaching/` | 러닝 유형, 연속 큐 생성, 멘트 풀, 음성 선택 |
| 러닝화 도메인 | `apps/mobile/domains/shoes/` | 카탈로그·분류·필터·추천 마법사·비교 |
| 배지·목표 | `apps/mobile/domains/badges/` | 배지 규칙, 주간 목표 추천 |
| 활동·캘린더 | `apps/mobile/domains/activities/` | 활동 기록, 일정, 월간 집계 |
| 업데이트 안내 | `apps/mobile/services/updates/` | Preview 새 APK 확인 배너 |
| 공개 웹 | `outputs/pushrun-site/` | GitHub Pages 운영 사이트 |
| 웹 미리보기 | `outputs/pushrun-site/preview/` | 설치 전 화면 검토용. 운영 앱과 별개 |

## 3. 2026-07-26 vNext 2차 반영 상태

- **메뉴**: 하단 탭을 없애고 좌상단 햄버거 드로어로 전환했습니다. 새 네이티브 의존성 없이 RN 내장 `Modal`/`Animated`/`PanResponder`로 구현했습니다.
- **코칭**: 평시 큐 간격이 간단 26초 / 보통 15초 / 자세히 9초입니다. 멘트 풀은 공용 318 + 구간 스크립트 234 + 유형 전용 191로 총 743문장이며, 풀별 쿨다운으로 반복을 막습니다.
- **러닝 유형**: 15종에 강도(RPE)·목적·추천 대상·피해야 할 때·구성을 정의했습니다. 구 세션 이름은 `legacyKindMap`으로 하위호환됩니다.
- **음성**: 기기에 설치된 한국어 TTS를 열거해 남성/여성 중 하나만 고르면 그 안에서 품질 높은 음성을 자동 선택합니다. 유료·클라우드 음성은 쓰지 않습니다.
- **러닝화**: 123종(브랜드 10곳, 3대 카테고리 9세부). 수치 스펙(무게·드롭·스택)과 원화 가격은 필드 자체가 없고 `priceBand`만 씁니다. 국내 공식 링크는 확인된 브랜드만 노출하고 나머지는 네이버·쿠팡 검색만 제공합니다.
- **대회**: `raceGroupKey`(정규화 대회명 | 대회일 | 지역)로 묶어 같은 대회의 5K·10K를 1건으로 셉니다. 목록·달력 모두 동일 기준입니다.
- **커뮤니티**: 서버 쓰기가 막힌 상태라 앱 내장 Q&A 지식 카드 40개를 제공합니다. 통증 관련 카드는 전문가 상담 안내 문구가 필수이며 테스트로 강제합니다.
- **외부 건강 데이터**: Samsung Health·Garmin·Nike는 승인·자격증명이 없어 "준비 중"으로만 표시합니다. 연동 완료로 위장하지 않습니다.

## 4. 다음 작업 우선순위

1. 실기기에서 장시간(20·40·60분) 코칭 세션과 화면 잠금·절전·이어폰 해제 동작을 확인합니다.
2. `data/shoe-verification-queue.json`의 우선순위 상위 항목부터 국내 공식 페이지를 확인해 `verification`을 `official-checked`로 올립니다.
3. Health Connect는 Android 권한·개인정보처리방침·수동 기록 중복 규칙을 확정한 뒤 연결합니다.
4. 소셜 로그인은 운영 OAuth 자격증명이 연결되고 검증된 뒤에만 `EXPO_PUBLIC_AUTH_*_ENABLED`를 켭니다.
5. 커뮤니티 서버 쓰기가 열리면 로컬 임시 보관함(`runningbom:vnext:community-drafts:v1`)의 업로드 경로를 붙입니다.

## 5. 변경 원칙

- 기존 Play 비공개 테스트 트랙, 테스터 목록, 업로드된 AAB, 정식 패키지 `kr.robom.runningbom`의 versionCode·서명은 별도 명시 승인 없이 변경하지 않습니다.
- Preview(`kr.robom.runningbom.preview`)와 정식 앱은 별개이며, Preview 배포는 `.github/workflows/preview-apk.yml`만 사용합니다.
- 검증되지 않은 대회·러닝화·가격·출시일은 추가하지 않습니다. 모르면 필드를 비우거나 상태를 정직하게 표기합니다.
- 건강·의료 효과, 부상 방지, 자세 진단을 단정하지 않습니다.
- 변경 후 `cd apps/mobile && npm run check`(테스트+타입+설정 검증)가 통과해야 합니다.
