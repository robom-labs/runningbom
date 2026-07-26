# Codex Test Results

## 자동 검증

| 명령 | 결과 | 증거 |
| --- | --- | --- |
| `npm run check` in `apps/mobile` | PASS | 모바일 단위 테스트 34/34, TypeScript, 정적 설정, Expo public config |
| `npm test` | PASS | 저장소 계약·데이터·릴리스 가드 테스트 78/78 |
| `npm run build` | PASS | 패밀리 동기화, 모바일 대회 데이터, 정적 데이터, 웹 산출물 검증 |
| `npm run audit:prod` | PASS_WITH_NOTE | high·critical 0, `uuid` moderate advisory 1건 |
| `npm audit --omit=dev` | PASS_WITH_NOTE | high·critical 0, 같은 transitive advisory가 Expo CLI/config 관련 10개 패키지 경로에 집계 |
| `npx expo-doctor` | PASS | 20/20 검사 통과 |
| `npx expo install --check` | PASS | Expo 의존성 호환 |
| `npx expo export --platform android` | PASS | Hermes Android bundle 4,182,720 bytes |
| `npx expo export --platform ios` | PASS | Hermes iOS bundle 4,175,295 bytes |
| `xmllint --noout modules/runningbom-coach/android/src/main/AndroidManifest.xml` | PASS | Android namespace 포함 XML 문법 검증 |
| `git diff --check` | PASS | 공백 오류 없음 |

## Android artifact

- 첫 Preview build `13d4927b-c7ce-4801-a79e-df49a01432e5`와 첫 production build `986c6af9-8c48-410c-9e85-5efcb87dcb76`는 Android manifest의 `android` XML namespace 누락으로 실패했다.
- 원인을 `fix(coach): declare Android manifest namespace` 커밋으로 수정했다.
- 재시도 원격 build는 성공했지만 민감 권한 제거 전 source에서 생성돼 폐기 후보로 분류했다.
- 최신 source의 원격 EAS rebuild는 무료 Android build quota 소진으로 실행되지 않았다.
- 추가 결제 없이 기존 remote signing credential을 이용해 EAS local build를 완료했다.
- Preview APK SHA-256은 `fdfadc7baf06fa2194fbed7f28cd1483302983d84957fc0f3bda741bd408fb2c`다.
- production AAB SHA-256은 `f23d9a10d6c3cd1f9a6ec0f11a52b20014fee6c5c66ed1703d4bf3c77ed2a502`다.
- bundletool validate, 16KB alignment, package·version·ABI·service·permission 검사를 통과했다.
- 최종 artifact 결과는 `ARTIFACT_REPORT.md`를 정본으로 사용한다.

## 실행하지 못한 검증

- 삼성·Pixel 실기기 20·40·60분 음성 세션
- 잠금 화면, 절전 모드, 실제 전화, Bluetooth, 이어폰 해제
- TalkBack, 125%·200% 시스템 글자, 실제 태블릿
- 기존 Play 설치본 위에 candidate를 설치하는 업데이트 smoke
- 운영 Supabase와 OAuth 제공자 연결

위 항목은 실행 증거가 없으므로 `PASS`가 아니라 `BLOCKED_EXTERNAL` 또는 `NOT_RUN`이다.
