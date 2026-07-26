# 러닝봄 음성 코치 기술 스파이크 결과

## 결론

Android용 로컬 Expo 모듈과 Kotlin foreground service 구현은 존재한다. 기기 TTS 큐 생성 규칙의 자동 테스트는 통과했다. 실제 삼성·Pixel 기기, 잠금 화면, 절전 모드, 전화, Bluetooth, 이어폰 해제 검증은 수행하지 않았으므로 출시 적합성은 `BLOCKED_EXTERNAL`이다.

## 구현된 경로

Android 경로는 다음 구성요소를 사용한다.

- Android `TextToSpeech`
- `speak`
- `playSilentUtterance`
- `UtteranceProgressListener`
- `SystemClock.elapsedRealtime`
- `mediaPlayback` foreground service
- `MediaSession`
- 알림의 일시정지, 재개, 종료 동작
- audio focus
- `ACTION_AUDIO_BECOMING_NOISY`
- 세션 checkpoint 저장

근거는 `apps/mobile/modules/runningbom-coach`와 `apps/mobile/services/audio/coachService.ts`다.

## fallback 경로

Android 네이티브 모듈을 사용할 수 없으면 `expo-speech`로 첫 큐만 읽는다. 반복 백그라운드 큐를 제공하지 않으며 화면 안내와 단조 시계를 사용한다. 실제 설정 시간이 경과한 뒤 완료 상태가 된 경우에만 활동을 기록하며 중도 중단은 완료 처리하지 않는다.

## 큐 생성 규칙

- 콘텐츠 버전은 `2026.07-v1`이다.
- 최소 안내는 300초, 기본 안내는 180초, 자세한 안내는 120초 간격이다.
- 첫 큐는 주변 확인 안전 안내다.
- 10분 이상 세션은 중간에 불편·통증 시 감속 또는 중단 안내를 넣는다.
- 마지막 5초에 완료 안내를 넣는다.
- 네이티브 전송 문자열에서 파이프와 줄바꿈을 제거한다.

## 자동 테스트 결과

`apps/mobile/tests/core-rules.test.ts`에서 다음을 검증했다.

| 항목 | 상태 |
|---|---|
| 모든 큐 사이 최소 90초 | PASS_TEST |
| 추정 침묵 비율 75% 이상 | PASS_TEST |
| 최근 네 문장 안의 동일 문장 반복 없음 | PASS_TEST |
| 네이티브 전송 형식 정규화 | PASS_TEST |

이 테스트는 큐 생성 순수 함수를 검증한 것이며 실제 음성 출력 품질이나 백그라운드 생존을 검증한 것은 아니다.

## 확인되지 않은 항목

| 항목 | 상태 | 이유 |
|---|---|---|
| 삼성 Android 20·40·60분 | BLOCKED_EXTERNAL | 실기기 미실행 |
| Pixel 또는 타 제조사 20·40·60분 | BLOCKED_EXTERNAL | 실기기 미실행 |
| 화면 잠금 60분 | BLOCKED_EXTERNAL | 실기기 미실행 |
| 절전 모드 40분 | BLOCKED_EXTERNAL | 실기기 미실행 |
| 전화 수신과 종료 후 재개 | BLOCKED_EXTERNAL | 실제 통화 미실행 |
| 문자·다른 앱 전환 | BLOCKED_EXTERNAL | 실기기 미실행 |
| Bluetooth 연결 | BLOCKED_EXTERNAL | 장치 미실행 |
| 이어폰 해제 후 즉시 pause | BLOCKED_EXTERNAL | 장치 미실행 |
| force-stop 후 완료 미처리 | BLOCKED_EXTERNAL | 실기기 미실행 |
| 한국어 음성 미설치 기기 | BLOCKED_EXTERNAL | 실기기 미실행 |
| iOS 반복 백그라운드 코칭 | NOT_IMPLEMENTED | fallback은 첫 음성과 화면 안내만 제공 |

## 비용

OpenAI TTS, ElevenLabs, Google Cloud TTS, Azure Speech, Amazon Polly 호출은 코드에서 확인되지 않았다. 기기 TTS를 사용하므로 현재 코드의 음성 코어는 외부 TTS 사용료가 없다.
