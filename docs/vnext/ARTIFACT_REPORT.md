# Artifact Report

## 빌드 대상

- Candidate source SHA: `6dd45f26de428bb8115fc55d7b719e6b279635f6`
- Version: `0.19.0`
- Android versionCode: `7`
- Production package: `kr.robom.runningbom`
- Preview package: `kr.robom.runningbom.preview`
- Release stage: `CODE_ONLY`

## 최종 산출물

산출물 디렉터리는 `/Users/runner706/Documents/Codex/2026-07-11/01-2/work/vnext-runningbom-artifacts-final`이다. 이 디렉터리는 Git에 커밋하지 않는다.

| 산출물 | 크기 | SHA-256 | 용도 |
| --- | ---: | --- | --- |
| `runningbom-preview-0.19.0-v7.apk` | 92,194,976 bytes | `fdfadc7baf06fa2194fbed7f28cd1483302983d84957fc0f3bda741bd408fb2c` | 기존 러닝봄과 함께 설치하는 Preview |
| `runningbom-production-candidate-0.19.0-v7.aab` | 61,834,966 bytes | `f23d9a10d6c3cd1f9a6ec0f11a52b20014fee6c5c66ed1703d4bf3c77ed2a502` | Play에 올리지 않은 production candidate |
| `runningbom-production-candidate-0.19.0-v7.apks` | 92,271,926 bytes | `cb10c98c71f2efb40d28369062948f2ae6a171c686def2b0ae8b614f87191c2b` | 구조 검사 전용, 서명되지 않아 설치 금지 |
| `runningbom-production-candidate-0.19.0-v7-universal.apk` | 92,271,624 bytes | `85c07c2f2624a798ff8c7aee040c017bf1fa53fcc3d7f885f7a01bc1d36918b0` | 구조 검사 전용, 서명되지 않아 설치 금지 |

## 최종 빌드 방식

- 원격 EAS 무료 Android 빌드 한도가 2026-08-01까지 소진돼 새 원격 빌드를 만들지 않았다.
- 비용을 추가하지 않고 기존 원격 signing credential을 이용한 EAS local build로 Preview APK와 production AAB를 생성했다.
- 최종 산출물은 source SHA `6dd45f26de428bb8115fc55d7b719e6b279635f6`에서 생성했다.
- 이전 원격 성공 artifact는 민감 권한 제거 전 source에서 생성됐으므로 최종 후보로 사용하지 않는다.

## 검사 결과

| 검사 | 결과 |
| --- | --- |
| production package | `kr.robom.runningbom` |
| Preview package | `kr.robom.runningbom.preview` |
| versionName / versionCode | `0.19.0` / `7` |
| minSdk / targetSdk | `24` / `36` |
| AAB 서명 | PASS |
| upload certificate SHA-256 | `68:F9:6A:DF:AB:A0:47:8A:53:F9:F7:70:2C:69:CA:43:EC:2E:59:91:0B:9C:06:0F:FB:72:70:82:62:28:F7:46` |
| Play app signing certificate | `BLOCKED_EXTERNAL`, Play Console 최신 화면 재대조 필요 |
| bundletool `validate` | PASS, `1.18.3` |
| 16KB page alignment | PASS, `PAGE_ALIGNMENT_16K` |
| ABI | ARM64, armeabi-v7a, x86, x86_64 |
| Preview APK 서명 | PASS, APK Signature Scheme v2 |
| Preview APK 16KB zip alignment | PASS |
| `debuggable` / `testOnly` | manifest에 선언 없음, 기본 false |
| foreground service | `RunningbomCoachService`, `mediaPlayback` 확인 |
| 금지 권한 | CAMERA, RECORD_AUDIO, SYSTEM_ALERT_WINDOW, legacy storage, AD_ID, 위치 권한 모두 0건 |
| 실기기 설치·업데이트 | `BLOCKED_EXTERNAL`, 연결된 Android 기기와 AVD 없음 |

## EAS 원격 빌드 이력

| 변형 | Build ID | 상태 | 설명 |
| --- | --- | --- | --- |
| Preview | `13d4927b-c7ce-4801-a79e-df49a01432e5` | FAIL | Android manifest namespace 누락 |
| Production | `986c6af9-8c48-410c-9e85-5efcb87dcb76` | FAIL | Android manifest namespace 누락 |
| Preview retry | `7bc9b8da-c07a-419d-b099-db12046a7e4d` | OBSOLETE | 민감 권한 제거 전 source에서 생성 |
| Production retry | `9a05a267-0d0a-4e2d-be70-3fa6449f9a01` | OBSOLETE | 민감 권한 제거 전 source에서 생성 |

Play 내부·비공개·프로덕션 트랙은 변경하지 않았다.
