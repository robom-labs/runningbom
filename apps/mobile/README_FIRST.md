# 러닝봄 모바일 작업 시작점

다음 작업자는 이 파일과 `apps/mobile/README.md`, 그리고 `docs/vnext/README_FIRST.md`를 먼저 읽은 뒤 필요한 도메인만 열어 봅니다.

## 화면 이동 구조

하단 탭은 없습니다. 모든 화면 위에 공통 헤더(`app/navigation/AppHeader.tsx`)가 있고, **좌상단 햄버거 버튼**이 드로어(`app/navigation/DrawerMenu.tsx`)를 엽니다.

- 라우트 정의와 메뉴 정보구조: `app/navigation/routes.ts`
- 라우트 분기와 화면 조립: `app/navigation/AppNavigator.tsx`
- 메뉴 구성: 프로필(최상단) → 홈 · 러닝 시작 · 캘린더 · 대회 · 러닝화 · 커뮤니티 · 기록·통계 → 설정 · 도움말

## 기능 위치

- 대회 목록·필터·달력·알림·목표 대회는 `domains/races/`와 `app/state/RaceStateProvider.tsx`에 있습니다. 대회 그룹 집계는 `domains/races/aggregate.ts`가 정본입니다.
- 러닝 유형 정의는 `domains/coaching/sessionTypes.ts`, 큐 생성은 `domains/coaching/model.ts`, 멘트 풀은 `domains/coaching/cueLibrary.ts`, 음성 선택은 `domains/coaching/voice.ts`에 있습니다.
- Android 화면 잠금 코치는 `modules/runningbom-coach/android/`에 있고, 화면 fallback은 `services/audio/coachService.ts`에 있습니다.
- 활동 저장·스트릭·주간 목표·배지는 `domains/activities/`, `domains/badges/`, `services/storage/`에 있습니다.
- 러닝화는 `domains/shoes/`에 있습니다. 분류 `taxonomy.ts`, 카탈로그 `catalog.ts`, 필터 `filters.ts`, 추천 마법사 `advisor.ts`, 비교 `compare.ts`, 국내 구매 링크 `purchaseLinks.ts`, 화면 `ShoeScreen.tsx`.
- 커뮤니티 Q&A 지식 카드는 `app/screens/community/`에 있습니다.
- Preview 새 버전 안내는 `services/updates/`에 있습니다.

## 이번 변경의 기준

- 대회는 하나의 대회를 한 건으로 셉니다. 같은 대회의 5K·10K는 카드 하나 안에 종목 칩으로 표시합니다.
- 코치는 옆에서 계속 말하는 밀도를 기본으로 합니다. 보통 안내에서 분당 4마디 수준이며, 같은 문장이 근접 반복되지 않아야 합니다.
- 코치는 기기 한국어 TTS만 사용합니다. 남성·여성 중 하나를 고르면 설치된 음성 중 품질 높은 것을 자동 선택합니다. 유료·클라우드 음성은 도입하지 않습니다.
- 러닝화는 확인되지 않은 무게·드롭·스택·원화 가격을 넣지 않습니다. 국내 공식 페이지가 확인된 브랜드만 공식 버튼을 노출하고, 그 외에는 네이버·쿠팡 검색만 제공합니다. "최저가" 단정 표현은 금지입니다.
- Samsung Health·Garmin·Nike Run Club은 외부 승인과 자격증명이 필요합니다. 자격 증명이 없는 상태에서 연동 완료로 표시하지 않습니다.
- 소셜 로그인은 `eas.json`의 `EXPO_PUBLIC_AUTH_*_ENABLED`가 `false`라 꺼져 있습니다. 사유는 설정 화면에 사용자 언어로 표기되어 있습니다.
- 건강·의료 효과나 부상 방지를 단정하지 않습니다.

## 검증 순서

```bash
cd apps/mobile
npm run check      # npm test + typecheck + verify + config
npm run export:native
```

네이티브 Kotlin 변경은 Android development build와 실기기에서 별도 확인해야 합니다.

## Preview APK

정식 앱(`kr.robom.runningbom`, Play 비공개 테스트)과 별개인 `kr.robom.runningbom.preview`를 GitHub Actions에서 빌드합니다. 방법은 `docs/vnext/PREVIEW_APK.md`를 참고하세요. Play 트랙은 이 경로로 절대 건드리지 않습니다.
