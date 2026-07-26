# 러닝봄 Preview 내부 확인 가이드

## 현재 artifact 상태

설치용 Preview APK와 Play에 올리지 않은 production-candidate AAB를 생성했다.

| 항목 | 상태 |
| --- | --- |
| Preview APK | `/Users/runner706/Documents/Codex/2026-07-11/01-2/work/vnext-runningbom-artifacts-final/runningbom-preview-0.19.0-v7.apk` |
| Preview APK SHA-256 | `fdfadc7baf06fa2194fbed7f28cd1483302983d84957fc0f3bda741bd408fb2c` |
| production-candidate AAB | `/Users/runner706/Documents/Codex/2026-07-11/01-2/work/vnext-runningbom-artifacts-final/runningbom-production-candidate-0.19.0-v7.aab` |
| production AAB SHA-256 | `f23d9a10d6c3cd1f9a6ec0f11a52b20014fee6c5c66ed1703d4bf3c77ed2a502` |
| 실기기 설치 | `BLOCKED_EXTERNAL` |
| Google Play 내부 테스트 업로드 | 실행 금지 |
| 기존 비공개 테스트 변경 | 실행하지 않음 |

아래 절차는 Preview APK를 실제 Android 기기에서 확인하는 목록이다. 현재 Mac에는 연결된 Android 기기와 AVD가 없어 설치 단계는 실행하지 않았다.

## Preview 식별자

- 앱 이름은 `러닝봄 Preview`다.
- Android package는 `kr.robom.runningbom.preview`다.
- iOS bundle identifier는 `kr.robom.runningbom.preview`다.
- scheme은 `runningbom-preview`다.
- EAS Preview Android 형식은 APK다.
- Preview는 production OAuth redirect와 production 소셜 쓰기를 기본 차단한다.
- 기존 Play 설치 러닝봄과 별도 앱으로 설치되도록 구성돼 있다.

## 설치 절차

1. 제공된 파일명과 SHA-256을 artifact 보고서와 대조한다.
2. APK를 Android 기기로 옮긴다.
3. 파일을 여는 앱에만 `알 수 없는 앱 설치` 권한을 임시 허용한다.
4. `러닝봄 Preview`가 기존 `러닝봄`과 별도로 보이는지 확인한다.
5. 설치 뒤 해당 임시 설치 권한을 다시 끈다.
6. 검증이 끝나면 Preview만 삭제한다.

## 코어 확인 흐름

### 대회

1. 앱 시작 후 대회 목록이 보이는지 확인한다.
2. 한글 부분 검색, 지역, 거리, 접수 상태를 각각 바꾼다.
3. 필터를 조합하고 결과가 일치하는지 확인한다.
4. 대회 상세에서 공식 링크가 외부 브라우저로 열리는지 확인한다.
5. 알림 권한 허용·거부 뒤에도 탐색이 유지되는지 확인한다.
6. 알림 예약·취소와 앱 재실행 후 상태 복원을 확인한다.
7. 네트워크를 끄고 번들 대회 fallback을 확인한다.

### 코칭

1. 10~120분 슬라이더와 5분 단위를 확인한다.
2. 직접 입력의 정상값과 잘못된 값을 확인한다.
3. 러닝 유형, 안내량, 말하기 속도를 변경한다.
4. 코칭을 시작하고 일시정지·재개·종료한다.
5. 잠금 화면, 전화, 이어폰 해제, Bluetooth, 절전모드를 별도 기기 매트릭스로 확인한다.

### 로컬 기록

1. 코칭 완료 뒤 활동·스트릭·배지 변화가 보이는지 확인한다.
2. 앱을 종료했다가 다시 열어 기록을 확인한다.
3. 기기 데이터 내보내기를 확인한다.
4. 삭제 확인창과 실제 기기 활동 기록 삭제를 확인한다.

### 커뮤니티

Preview는 기본 `CORE_ONLY`다.

- 공개 피드가 비어 있어도 앱이 종료되지 않아야 한다.
- 소셜 쓰기와 OAuth 버튼이 production 기능처럼 활성화되면 안 된다.
- 크루·리그는 준비 상태 안내만 보여야 한다.

## 실기기 필수 매트릭스

| 항목 | 상태 |
| --- | --- |
| Samsung Android | `BLOCKED_EXTERNAL` |
| Pixel 또는 다른 제조사 Android | `BLOCKED_EXTERNAL` |
| 잠금 화면 60분 | `BLOCKED_EXTERNAL` |
| 절전모드 40분 | `BLOCKED_EXTERNAL` |
| 전화 수신·종료 | `BLOCKED_EXTERNAL` |
| Bluetooth | `BLOCKED_EXTERNAL` |
| 이어폰 해제 즉시 pause | `BLOCKED_EXTERNAL` |
| force-stop 후 완료 오판 없음 | `BLOCKED_EXTERNAL` |

## Play 영향

이 가이드는 CODE_ONLY Preview 검증용이다.

- Play 내부 테스트를 변경하지 않는다.
- 기존 비공개 테스트를 변경하지 않는다.
- 프로덕션을 변경하지 않는다.
- 기존 비공개 테스터에게 영향을 주지 않는다.
