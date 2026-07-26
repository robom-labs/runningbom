# Race Regression Matrix

상태는 `PASS`, `FAIL`, `BLOCKED_EXTERNAL`, `BLOCKED_CEO`, `NOT_RUN` 중 하나만 사용한다.

| ID | Contract | Baseline | Final | Evidence |
| --- | --- | --- | --- | --- |
| R-01 | 대회 목록 | PASS | PASS | `apps/mobile/src/races.ts`, `npm test` |
| R-02 | 지역 필터 | PASS | PASS | `mobile-runtime-contract.test.mjs` |
| R-03 | 거리 필터 | PASS | PASS | `mobile-runtime-contract.test.mjs` |
| R-04 | 접수 상태 | PASS | PASS | `mobile-runtime-contract.test.mjs` |
| R-05 | 필터 조합 | PASS | PASS | `mobile-runtime-contract.test.mjs` |
| R-06 | 한글 부분검색 | PASS | PASS | `mobile-runtime-contract.test.mjs` |
| R-07 | 상세 진입·복귀 | partial | NOT_RUN | 화면 구조는 구현했으나 실제 Android 내비게이션 왕복을 실행하지 않음 |
| R-08 | 공식 페이지 외부 브라우저 | PASS | PASS | `secure-link-core.test.mjs`, `map-links.test.mjs` |
| R-09 | 정확한 시각 알림 예약 | PASS | PASS | `alerts-core.test.mjs`, 모바일 알림 계약 |
| R-10 | 알림 취소 | PASS | PASS | `mobile-runtime-contract.test.mjs`, `notifications.ts` |
| R-11 | 권한 거부 후 기본 기능 | PASS | PASS | 알림 권한과 대회 탐색 경계 정적 계약 |
| R-12 | 권한 재안내 | partial | NOT_RUN | 실제 Android 권한 거부·재요청 흐름 미실행 |
| R-13 | 원격 데이터 | PASS | PASS | `mobile-data-contract.test.mjs`, revision 비교 |
| R-14 | 번들 fallback | PASS | PASS | `static-data.test.ts`, `races.ts` |
| R-15 | 오프라인 대회 | PASS | PASS | 원격 URL 부재 시 bundle 사용 자동 테스트 |
| R-16 | `runningbom://race/{raceId}` | PASS | PASS | Expo config·linking 설정과 알림 payload 정적 검증 |
| R-17 | Android package·signing | PASS | PASS | Expo config와 production-candidate AAB 검사 |
| R-18 | iOS bundle ID | PASS | PASS | Expo public config 및 iOS export |
| R-19 | 기존 저장값 migration | not applicable yet | PASS | 기존 대회 알림의 legacy key 변환 테스트, 기존 저장 키 유지 |
| R-20 | privacy·support | PASS | PASS | production config의 공식 URL과 root link tests |
| R-21 | ROBOM 패밀리 | PASS | PASS | `family-analytics.test.mjs`, family static 검증 |
| R-22 | 데이터 revision·검증시각 | PASS | PASS | revision `2026.07.26-race-data-14`, data contract tests |
| R-23 | 로그인 없이 핵심 사용 | PASS | PASS | `CORE_ONLY` config, Preview config tests |
| R-24 | 앱 재시작 상태복원 | partial | PASS | AsyncStorage·SQLite 복원 경로와 완료 세션 중복 방지 테스트 |
| R-25 | 비로그인 스트릭·배지 로컬 작동 | missing | PASS | `core-rules.test.ts`, SQLite local-first 구현 |
| R-26 | Supabase 차단 상태에서 코어 100% 작동 | not applicable | PASS | `CORE_ONLY`, 정적 import 경계, bundle/LKG 테스트 |

`PASS`는 코드·정적 계약 또는 자동 테스트 증거가 있는 항목만 사용했다. R-07과 R-12는 Preview APK가 있어도 실제 Android 조작을 수행하지 않았으므로 `NOT_RUN`으로 유지한다.
