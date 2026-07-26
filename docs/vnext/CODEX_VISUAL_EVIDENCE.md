# Codex Visual Evidence

## 확보한 코드 기반 증거

- 5탭 shell과 넓은 화면 navigation rail이 `AppNavigator.tsx`에 있다.
- 홈은 `Today Run` 한 장을 최상단에 두며 시간 버튼 배열을 사용하지 않는다.
- 시작 화면은 10~120분 슬라이더, 직접 입력, 유형 선택 sheet를 제공한다.
- 탐색 화면은 대회·러닝화·출시예정 세 구역으로 분리한다.
- 마이 화면은 설치 채널, 버전, versionCode, source SHA, 데이터 버전을 표시한다.
- Preview variant는 앱 이름과 wordmark에 `Preview`를 명시한다.

## 실제 화면 증거 상태

| 항목 | 상태 | 이유 |
| --- | --- | --- |
| Emulator 320·390·430px | NOT_RUN | Android SDK는 있으나 AVD·실행 emulator 없음 |
| Android 태블릿 | NOT_RUN | AVD·실기기 없음 |
| Preview APK 실제 화면 | BLOCKED_EXTERNAL | 설치 기기 없음 |
| TalkBack 영상 | BLOCKED_EXTERNAL | 실기기 없음 |
| 200% 글자 영상 | BLOCKED_EXTERNAL | 실기기 없음 |
| 화면 잠금 음성 영상 | BLOCKED_EXTERNAL | 실기기 없음 |

실제 화면을 실행하지 않았으므로 이 문서는 screenshot이나 recording이 있다고 주장하지 않는다.
