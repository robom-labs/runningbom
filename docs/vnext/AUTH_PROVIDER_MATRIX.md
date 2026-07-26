# 러닝봄 로그인 제공자 매트릭스

## 기본 원칙

로그인은 핵심 대회·러닝화·코칭 기능에 필수가 아니다. 외부 설정이 검증되지 않은 제공자는 버튼을 노출하지 않는다.

## 제공자 상태

| 제공자 | 코드 경로 | 기본 활성 | 현재 판정 |
|---|---|---:|---|
| Google | Supabase built-in OAuth, PKCE | false | BLOCKED_EXTERNAL |
| Kakao | Supabase built-in OAuth, PKCE | false | BLOCKED_EXTERNAL |
| Naver | Custom OAuth2 endpoint 계약과 UserInfo adapter | false 고정 | BLOCKED_EXTERNAL |
| Apple | Supabase built-in OAuth, 기능 플래그 | false | BLOCKED_EXTERNAL |

Google과 Kakao는 Supabase URL·anon key 및 각 feature flag가 모두 있어야 활성화된다. Apple도 같은 조건이 필요하며 Apple Developer 자격과 서비스 설정 검증이 남아 있다.

Naver는 authorization, token, UserInfo endpoint와 `response.id` 필수 계약을 정의하고 공식 UserInfo 응답을 표준 필드로 줄이는 순수 adapter를 구현·테스트했다. synthetic email과 service role 세션 생성 우회는 금지돼 있다. 외부 Naver token을 안전하게 Supabase session으로 교환하는 서버 adapter는 아직 없으므로 버튼은 노출하지 않는다.

## OAuth 흐름

- Supabase client는 `flowType: pkce`를 사용한다.
- OS 브라우저 세션으로 provider URL을 연다.
- 앱 딥링크의 `code`를 `exchangeCodeForSession`에 전달한다.
- access token과 refresh token은 Expo SecureStore 기반 Supabase auth storage에 저장한다.
- service role key는 앱 코드에 없다.

## 연결과 해제

`MyScreen`에서 제공자 추가 연결과 identity 해제 UI를 제공한다. `unlinkIdentity`는 연결된 identity가 하나뿐이면 해제를 거부한다. 실제 외부 제공자 계정으로 연결·해제를 완료하는 검증은 외부 credential이 없어 차단돼 있다.

## 외부 검증 상태

| 항목 | 상태 |
|---|---|
| Google client ID와 redirect URI | BLOCKED_EXTERNAL |
| Kakao 앱과 동의 항목 | BLOCKED_EXTERNAL |
| Naver 앱 등록과 검수 | BLOCKED_EXTERNAL |
| Apple Developer 서비스 설정 | BLOCKED_EXTERNAL |
| 실제 로그인·로그아웃 | BLOCKED_EXTERNAL |
| 로그인 수단 실제 연결·해제 | BLOCKED_EXTERNAL |
| 계정 간 자동 병합 방지 실험 | NOT_RUN |
| Preview에서 production OAuth 차단 설정 | PASS_TEST |
