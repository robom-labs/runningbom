# Codex 1차 결과를 Claude Code에 인계

Codex 1차 결과입니다.
아래 주장을 신뢰하지 말고 실제 저장소와 artifact를 독립적으로 검증하십시오.

## 기준

- Starting SHA: `aa8fee4bac96cda5377c761b7e96446eb7922257`
- Candidate artifact source SHA: `6dd45f26de428bb8115fc55d7b719e6b279635f6`
- Starting version: `0.18.3`, Android versionCode `6`
- Candidate version: `0.19.0`, Android versionCode `7`
- Release stage: `CODE_ONLY`
- Play internal·closed·production 변경: 없음

## 커밋

1. `7510171` `docs(vnext): record prompt receipt and release baseline`
2. `7e2eff2` `feat(mobile): add local-first runningbom vnext`
3. `c8307d7` `feat(platform): add protected social foundation`
4. `f234df3` `feat(data): add verified static data sidecar`
5. `b0d8e88` `chore(release): enforce code-only play guard`
6. `f735589` `fix(coach): declare Android manifest namespace`
7. `ab4329f` `fix(mobile): strip unused sensitive permissions`
8. `6dd45f2` `fix(mobile): install required Expo native peers`

## 독립 재검증 우선순위

1. `apps/mobile/modules/runningbom-coach`의 foreground service, MediaSession, audio focus, checkpoint.
2. 삼성·Pixel에서 20·40·60분, 잠금·절전·전화·Bluetooth·이어폰 해제.
3. v0.18.3에서 0.19.0 candidate로 업데이트 설치했을 때 localStorage·AsyncStorage·SQLite·알림 보존.
4. R-01~R-26 대회 회귀.
5. Supabase migration의 모든 RLS와 SECURITY DEFINER를 서로 다른 JWT로 공격 검증.
6. OAuth 버튼이 production credential 없이 노출되지 않는지.
7. Preview가 production social write와 OAuth redirect를 사용하지 않는지.
8. release workflow가 `CODE_ONLY`에서 fail closed인지.
9. artifact hash, package, versionCode, permissions, debuggable, testOnly, ARM64, 16KB.
10. `expo-dev-client`, `expo-image-picker`, `expo-image-manipulator` 제거 뒤 Camera·Audio·Overlay·legacy storage 권한이 최종 AAB에 다시 들어오지 않는지.

## 테스트 명령

```bash
npm test
npm run build
npm run audit:prod
cd apps/mobile
npm ci
npm run check
npx expo-doctor
npx expo install --check
npm run export:native
```

## 알려진 차단

- 운영 Supabase·OAuth는 연결하지 않았다.
- 실제 UGC·크루·리그·동네 위치는 기능 플래그로 차단한다.
- 실기기 장시간 코치와 접근성 검증은 실행하지 않았다.
- Play 트랙은 이 작업에서 변경하지 않았다.
- 원격 EAS 무료 Android 빌드 한도가 2026-08-01까지 소진돼 최종 artifact는 EAS local build로 생성했다.

## artifact

최종 artifact 경로·SHA·검사 결과는 `ARTIFACT_REPORT.md`와 `CODEX_ARTIFACT_REPORT.md`를 정본으로 사용하십시오.

Preview APK는 서명·패키지 분리까지 확인했지만 연결된 Android 기기가 없어 설치하지 못했다. APKS와 universal APK는 서명되지 않은 구조 검사 전용이며 설치 artifact로 사용하면 안 된다.
