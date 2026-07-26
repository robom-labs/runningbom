# 현금 비용 없는 코어 운영 현황

## 목표와 판정 범위

현재 코드의 코어 기능은 유료 음성 API나 소셜 서버가 없어도 동작하도록 분리돼 있다. 이 문서의 `0원`은 새 유료 서비스를 코드에 추가하지 않았다는 뜻이며, 조직의 실제 GitHub·EAS·Supabase 요금 청구액이 0원임을 뜻하지 않는다.

## 비용 구조

| 기능 | 현재 방식 | 판정 |
| --- | --- | --- |
| 한국어 음성 코치 | Android 기기 TextToSpeech | 새 유료 TTS 없음 |
| 대회 데이터 | 저장소 정적 데이터와 GitHub Pages 원격 JSON | 코드상 별도 유료 API 없음 |
| 러닝화·코칭 콘텐츠 | 앱 번들 정적 데이터 | 런타임 API 비용 없음 |
| 활동·스트릭·배지 | 기기 SQLite·AsyncStorage | 서버 필수 아님 |
| 로그인·커뮤니티·크루 | 선택적 Supabase | 코어와 분리 |
| 광고·분석 SDK | 현재 번들에 없음 | 광고비·분석 서비스 추가 없음 |
| Preview·AAB 빌드 | EAS local build와 기존 remote signing credential | 새 결제 없이 완료 |
| CI·정적 배포 | GitHub Actions·GitHub Pages | 계정별 사용량·요금은 미확인 |

## 코어 독립성

Supabase URL과 공개 키가 없으면 클라이언트를 만들지 않고 커뮤니티 모드는 `CORE_ONLY`가 된다. 다음 기능은 Supabase를 직접 import하지 않는다.

- 대회 탐색
- 코칭
- 러닝화
- 로컬 활동
- 스트릭
- 로컬 배지

커뮤니티 서버가 없어도 앱이 종료되지 않고 빈 공개 피드와 상태 안내를 제공한다.

## 보호 모드

현재 코드가 인식하는 모드는 다음과 같다.

- `NORMAL`
- `LIMITED_WRITE`
- `READ_ONLY_COMMUNITY`
- `CORE_ONLY`

Supabase가 연결돼도 명시적인 모드가 없으면 기본값은 `READ_ONLY_COMMUNITY`다. 쓰기 서비스는 `NORMAL`이 아니면 거부한다.

## 새 유료 서비스

다음 유료 음성 서비스는 사용하지 않는다.

- OpenAI TTS
- ElevenLabs
- Google Cloud TTS
- Azure Speech
- Amazon Polly

현재 코드에서 새로 계획한 유료 서비스 수는 0이다.

## 미검증 항목

| 항목 | 상태 |
| --- | --- |
| 실제 월별 GitHub 사용료 | `NOT_RUN` |
| 실제 EAS Android 원격 빌드 한도 | 무료 한도 소진, 2026-08-01 갱신 표시 확인 |
| 실제 Supabase 프로젝트 플랜·쿼터 | `BLOCKED_EXTERNAL` |
| Apple Developer 비용 | `BLOCKED_EXTERNAL` |
| 실제 네트워크·저장 용량 비용 | `NOT_RUN` |

## 운영 원칙

- 코어 기능을 살리기 위해 의미 없는 keepalive 요청을 만들지 않는다.
- 무료 한도를 초과할 때 자동으로 유료 플랜으로 전환하는 코드는 두지 않는다.
- 외부 서비스 제한 시 커뮤니티 쓰기를 먼저 제한하고 코어는 유지한다.
- 공개 저장소나 공개 릴리스 자산에 데이터베이스 백업을 두지 않는다.

## 현재 결론

코드 기준으로 새 유료 서비스 없이 코어를 실행할 수 있다. 실제 월 현금 비용 0원 여부는 연결된 계정과 청구 화면을 확인하지 않았으므로 `NOT_RUN`이다.

원격 Android 빌드 한도 소진은 유료 플랜으로 자동 전환하지 않고 local build로 우회했다.
