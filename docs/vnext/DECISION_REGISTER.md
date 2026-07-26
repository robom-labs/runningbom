# RUNNINGBOM vNext Decision Register

| ID | Decision | Reason | Status |
| --- | --- | --- | --- |
| D-001 | 기존 closed track `0.18.3 (6)`은 읽기 전용으로 유지한다. | 현재 테스터를 보호하고 프롬프트의 CODE_ONLY 계약을 지킨다. | accepted |
| D-002 | 후보 Android versionCode는 Play 최고 사용 코드 6보다 큰 7을 사용한다. | Play에 올라간 versionCode 재사용을 막는다. | accepted |
| D-003 | 기존 단일 `App.tsx`를 화면·domain·service 단위로 분리한 뒤 5탭을 추가한다. | 대회 회귀를 고정하면서 확장 가능한 최소 경계를 만든다. | accepted |
| D-004 | Expo Router 전면 마이그레이션은 하지 않고 React Navigation을 사용한다. | 현재 작은 앱에서 불필요한 라우팅 마이그레이션 위험을 피한다. | accepted |
| D-005 | 대회·코칭·러닝화·배지·로컬 기록은 Supabase import를 금지한다. | Supabase 장애에서도 핵심 기능 100% 동작을 보장한다. | accepted |
| D-006 | 소셜·크루·리그·동네·OAuth는 feature flag OFF 기본값의 foundation으로 구현한다. | 외부 프로젝트·provider·법률 검토 없이 죽은 UI나 거짓 기능을 노출하지 않는다. | accepted |
| D-007 | 백그라운드 코치의 Android 기준 구현은 로컬 native module/foreground service로 한다. | JS timer만으로 잠금 화면 세션을 운영하지 않는다. | accepted |
| D-008 | 실기기 장시간·전화·Bluetooth·절전 검증은 실행 증거가 없으면 `NOT_RUN` 또는 `BLOCKED_EXTERNAL`이다. | 가짜 PASS를 금지한다. | accepted |
| D-009 | 러닝화 데이터는 공식 출처가 확인된 항목만 쓰며 목표 40개를 채우기 위한 가짜 행을 만들지 않는다. | 제품·가격·출처 정확성을 지킨다. | accepted |
| D-010 | 동네 확인은 공식 경계·라이선스·법률 검토 전 OFF, 수동 지역 선택만 제공한다. | 위치를 실거주 인증처럼 과장하거나 좌표를 서버에 남기지 않는다. | accepted |
| D-011 | Preview APK는 production 앱과 분리된 package가 안전하게 구성될 때만 만든다. | 기존 Play 설치와 동시 설치하고 production write를 막는다. | accepted |
| D-012 | main push가 Play 업로드를 실행하지 못하도록 Release Guard를 fail-closed로 추가한다. | 코드·웹 배포와 Play 제출을 분리한다. | accepted |
| D-013 | 현재 web PWA는 네이티브 vNext와 별도 회귀 대상으로 유지한다. | 기존 PWA 사용자를 보호하고 대규모 동시 재작성 위험을 피한다. | accepted |

