# 러닝봄 코치 실기기 검증 매트릭스

## 판정 원칙

현재 작업공간에서는 실기기 검증을 실행하지 않았다. 아래 항목은 코드 존재 여부와 무관하게 모두 실제 실행 전까지 `BLOCKED_EXTERNAL`이다.

| 기기·상황 | 20분 | 40분 | 60분 | 현재 상태 |
|---|---:|---:|---:|---|
| 삼성 Android, 화면 켬 | 미실행 | 미실행 | 미실행 | BLOCKED_EXTERNAL |
| 삼성 Android, 화면 잠금 | 미실행 | 미실행 | 미실행 | BLOCKED_EXTERNAL |
| Pixel 또는 타 제조사, 화면 켬 | 미실행 | 미실행 | 미실행 | BLOCKED_EXTERNAL |
| Pixel 또는 타 제조사, 화면 잠금 | 미실행 | 미실행 | 미실행 | BLOCKED_EXTERNAL |
| 절전 모드 | 미실행 | 미실행 | 미실행 | BLOCKED_EXTERNAL |
| Bluetooth 이어폰 | 미실행 | 미실행 | 미실행 | BLOCKED_EXTERNAL |

## 방해 상황

| 시나리오 | 기대 동작 | 현재 상태 |
|---|---|---|
| 다른 앱으로 전환 | 코칭 상태와 큐 유지 | BLOCKED_EXTERNAL |
| 문자 앱 사용 | 큐 중복이나 몰아재생 없음 | BLOCKED_EXTERNAL |
| 전화 수신 | 코칭 pause, 통화 중 큐 미적립 | BLOCKED_EXTERNAL |
| 통화 종료 | 사용자 정책에 맞는 재개 | BLOCKED_EXTERNAL |
| 이어폰 해제 | 즉시 pause, 스피커 돌발 재생 없음 | BLOCKED_EXTERNAL |
| audio focus 상실 | pause 또는 안전한 감쇠 | BLOCKED_EXTERNAL |
| 알람·내비게이션 음성 | 충돌 없이 상태 보존 | BLOCKED_EXTERNAL |
| force-stop | 세션 중단, 완료 기록 없음 | BLOCKED_EXTERNAL |
| 앱 재실행 | checkpoint를 기준으로 상태 설명 | BLOCKED_EXTERNAL |

## 코드에서 확인한 준비 요소

- foreground service와 `mediaPlayback` 서비스 유형
- MediaSession과 알림 컨트롤
- monotonic elapsed time
- audio focus 처리
- noisy audio broadcast 처리
- TTS 진행 listener
- checkpoint 저장

위 항목은 실기기 합격을 의미하지 않는다.

## 실기기 기록 양식

각 실행마다 다음을 남겨야 한다.

- 기기 모델과 Android 버전
- 제조사 절전 설정
- 앱 버전과 source SHA
- 세션 종류와 길이
- 큐 기대 수와 실제 수
- 중복, 누락, 몰아재생 여부
- 통화·Bluetooth·이어폰 이벤트 시각
- 종료 상태와 활동 저장 여부
- 로그와 화면 녹화 위치
