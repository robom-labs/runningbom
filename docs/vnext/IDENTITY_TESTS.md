# 러닝봄 신원·세션 검증 결과

## 자동으로 확인한 항목

| 항목 | 상태 | 근거 |
|---|---|---|
| Supabase auth 저장 키 네임스페이스 | PASS_TEST | `core-rules.test.ts` |
| 저장 키의 안전하지 않은 문자 치환 | PASS_TEST | `secureAuthStorageKey` 테스트 |
| Preview의 OAuth·소셜 쓰기 기본 차단 | PASS_TEST | `preview-config.test.ts` |
| production과 Preview package 분리 | PASS_TEST | `preview-config.test.ts` |
| 마지막 identity 해제 방지 | PASS_CODE | `unlinkIdentity` |
| provider 연결·해제 UI | PASS_CODE | `MyScreen`, `linkIdentity`, `unlinkIdentity` |
| PKCE 설정 | PASS_CODE | Supabase client와 `signIn` |
| Naver 공식 UserInfo 응답 정규화 | PASS_TEST | `core-rules.test.ts`, `naverAdapter.ts` |
| SELF_LOGGED 기록의 명시적 동기화 | PASS_CODE | `MyScreen`, `activitySync.ts` |
| 앱 내 service role 부재 | PASS_CODE | 현재 client 코드 정적 검사 |

## 실행하지 않은 항목

| 시나리오 | 상태 | 이유 |
|---|---|---|
| Google 신규 로그인 | BLOCKED_EXTERNAL | provider·credential 미연결 |
| Google 재로그인과 토큰 갱신 | BLOCKED_EXTERNAL | 외부 계정 필요 |
| Kakao 이메일 미제공 계정 | BLOCKED_EXTERNAL | 외부 계정과 앱 설정 필요 |
| Naver 전체 OAuth와 Supabase 세션 교환 | BLOCKED_EXTERNAL | 앱 등록·서버 adapter·외부 계정 필요 |
| Apple 최초 로그인 | BLOCKED_EXTERNAL | Apple 자격과 설정 필요 |
| provider 수동 연결 실사용 | BLOCKED_EXTERNAL | UI는 구현됐으나 외부 provider 설정이 없음 |
| 마지막 제공자 해제 실사용 | BLOCKED_EXTERNAL | UI와 guard는 구현됐으나 실제 계정 미실행 |
| 서로 다른 계정 자동 병합 방지 | NOT_RUN | 실제 두 계정 미실행 |
| 비로그인 SELF_LOGGED 활동의 idempotent 업로드 | BLOCKED_EXTERNAL | 명시적 확인·upsert·queue 정리는 구현됐으나 운영 Supabase 미연결 |
| 계정 삭제의 서버 처리 완료 | BLOCKED_EXTERNAL | 요청 row 이후 worker 미검증 |

## 로컬 데이터 경계

- 비로그인 활동에는 기기에서 생성한 `localUuid`를 붙인다.
- 활동, 스트릭, 배지는 SQLite에 남는다.
- 로그아웃해도 기기 기록은 삭제하지 않는다.
- 로그인 성공 메시지는 기기 기록을 자동 병합하지 않는다고 명시한다.
- SELF_LOGGED 기록은 사용자가 마이 화면에서 동기화를 확인한 경우에만 idempotent upsert한다.
- 다른 계정으로 로그인해도 자동 병합하지 않는다.

## 판정

로컬 세션 저장 구조, Preview 차단, provider 연결 UI, Naver UserInfo 정규화와 명시적 SELF_LOGGED 동기화 경로는 코드·자동 테스트 수준에서 확인했다. 실제 제공자 인증, Naver 서버 교환, 계정 삭제 worker와 운영 Supabase는 `BLOCKED_EXTERNAL`이므로 로그인 기능 전체를 출시 PASS로 판정하지 않는다.
