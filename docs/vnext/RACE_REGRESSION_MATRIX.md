# Race Regression Matrix

상태는 `PASS`, `FAIL`, `BLOCKED_EXTERNAL`, `BLOCKED_CEO`, `NOT_RUN` 중 하나만 사용한다.

| ID | Contract | Baseline | Final | Evidence |
| --- | --- | --- | --- | --- |
| R-01 | 대회 목록 | PASS | pending | `apps/mobile/src/races.ts`, root tests |
| R-02 | 지역 필터 | PASS | pending | mobile domain tests |
| R-03 | 거리 필터 | PASS | pending | mobile domain tests |
| R-04 | 접수 상태 | PASS | pending | mobile domain tests |
| R-05 | 필터 조합 | PASS | pending | mobile domain tests |
| R-06 | 한글 부분검색 | PASS | pending | mobile domain tests |
| R-07 | 상세 진입·복귀 | partial | pending | navigation tests |
| R-08 | 공식 페이지 외부 브라우저 | PASS | pending | secure link tests |
| R-09 | 정확한 시각 알림 예약 | PASS | pending | notification contract tests |
| R-10 | 알림 취소 | PASS | pending | notification contract tests |
| R-11 | 권한 거부 후 기본 기능 | PASS | pending | notification tests |
| R-12 | 권한 재안내 | partial | pending | UI tests |
| R-13 | 원격 데이터 | PASS | pending | `fetchLatestRaces` tests |
| R-14 | 번들 fallback | PASS | pending | race feed tests |
| R-15 | 오프라인 대회 | PASS | pending | bundle smoke |
| R-16 | `runningbom://race/{raceId}` | PASS | pending | deep-link tests |
| R-17 | Android package·signing | PASS | pending | config check, candidate artifact |
| R-18 | iOS bundle ID | PASS | pending | config check |
| R-19 | 기존 저장값 migration | not applicable yet | pending | migration tests |
| R-20 | privacy·support | PASS | pending | config and link smoke |
| R-21 | ROBOM 패밀리 | PASS | pending | family contract |
| R-22 | 데이터 revision·검증시각 | PASS | pending | data contract |
| R-23 | 로그인 없이 핵심 사용 | PASS | pending | feature flag tests |
| R-24 | 앱 재시작 상태복원 | partial | pending | local storage tests |
| R-25 | 비로그인 스트릭·배지 로컬 작동 | missing | pending | badge tests |
| R-26 | Supabase 차단 상태에서 코어 100% 작동 | not applicable | pending | import boundary and offline tests |

