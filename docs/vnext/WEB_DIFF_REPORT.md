# 웹·PWA 변경 영향 보고

## 기준

- 기준 main SHA는 `aa8fee4bac96cda5377c761b7e96446eb7922257`이다.
- 현재 작업 브랜치는 `r01/runningbom-vnext-first-pass`다.
- production-candidate source SHA는 `6dd45f26de428bb8115fc55d7b719e6b279635f6`다.

## 확인 결과

현재 vNext 변경은 기존 웹 UI 구조와 동작을 바꾸지 않는다. 다만 모바일·패밀리 버전 정합성을 위해 웹의 버전 표기, asset version, 서비스워커 cache와 패밀리 metadata를 `0.19.0`으로 함께 갱신했다.

다음 항목은 이 작업에서 의도적으로 변경하지 않았다.

- GitHub Pages 웹 UI
- 기존 PWA 화면 구조
- 웹 CSS
- 웹 딥링크 처리

대회 데이터 자동 동기화가 별도로 실행되면 웹과 모바일이 사용하는 데이터가 바뀔 수 있지만, 이는 vNext 화면 구현에 따른 웹 UI 변경과 구분해야 한다.

## 검증 상태

| 항목 | 상태 |
| --- | --- |
| 웹 화면 구조·CSS의 현재 diff | 변경 없음 확인 |
| 웹 버전·cache·asset metadata | `0.19.0`, `20260726-01`로 변경 |
| 웹 정적 검증 | 루트 `npm test` 78건 통과 |
| 운영 GitHub Pages 접속 | `NOT_RUN` |
| 기존 PWA 설치본 회귀 | `BLOCKED_EXTERNAL` |
| 모바일 vNext와 웹 기능 비교 | 정적 코드 범위만 확인 |
| 웹 스크린샷 전후 비교 | `NOT_RUN` |
| 웹 서비스워커 캐시 회귀 | `NOT_RUN` |

## 현재 알려진 테스트 상태

2026-07-26에 루트 `npm test`를 다시 실행했고 Node 테스트 78개가 모두 통과했다. 이 검사는 패밀리 검증, 정적 데이터 manifest, 대회 데이터, 모바일 런타임 계약, workflow pin과 Supabase 보안 계약을 포함한다. 다만 운영 GitHub Pages와 기존 PWA 설치본은 main 반영 후 다시 검증해야 한다.

## 결론

현재 vNext 1차 구현은 웹·PWA UI를 의도적으로 변경하지 않고 버전·cache 정합성만 갱신한다. 운영 URL과 기존 PWA 프로필의 실사용 회귀는 main 반영 후 별도로 기록한다.
