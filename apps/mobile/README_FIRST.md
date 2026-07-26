# 러닝봄 모바일 작업 시작점

다음 작업자는 이 파일과 `apps/mobile/README.md`를 먼저 읽은 뒤 필요한 도메인만 열어 봅니다.

## 기능 위치

- 대회 목록·필터·알림은 `domains/races/`와 `app/state/RaceStateProvider.tsx`에 있습니다.
- 코치 세션·멘트 규칙은 `domains/coaching/model.ts`에 있습니다.
- Android 화면 잠금 코치는 `modules/runningbom-coach/android/`에 있고, 화면 fallback은 `services/audio/coachService.ts`에 있습니다.
- 활동 저장·스트릭·캘린더는 `domains/activities/`, `domains/badges/`, `services/storage/`에 있습니다.
- 러닝화 사실 데이터는 `domains/shoes/catalog.ts`, 국내 구매 링크는 `domains/shoes/purchaseLinks.ts`, 화면은 `domains/shoes/ShoeScreen.tsx`에 있습니다.
- 화면 조합은 `app/screens/`, 5탭 구조는 `app/navigation/AppNavigator.tsx`에 있습니다.

## 이번 변경의 기준

- 대회는 하나의 대회 ID를 한 건으로 세고, 기존의 거리 2줄·상태 1줄·카드 상세보기 UI를 유지합니다.
- 해외 공식 상품 페이지는 앱에서 직접 구매 경로로 쓰지 않습니다. 국내 공식 페이지가 확인된 경우에만 보여 주고, 그렇지 않으면 네이버·쿠팡 국내 검색을 제공합니다.
- 코치는 기기 한국어 TTS를 사용합니다. 자연스러운 음성 품질은 설치된 기기 음성에 따르며, 유료·클라우드 음성은 사용하지 않습니다.
- Samsung Health·Garmin·Nike Run Club은 외부 인증과 권한이 필요한 연동입니다. 자격 증명이 없는 상태에서 연동 완료로 표시하지 않습니다.

## 검증 순서

```bash
cd apps/mobile
npm run check
npm test
npm run export:native
```

네이티브 Kotlin 변경은 Android development build와 실기기에서 별도 확인해야 합니다.
