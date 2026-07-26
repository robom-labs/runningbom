# RUNNINGBOM vNext Baseline

> CODEX FIRST PASS v11 구현 전의 재현 가능한 기준선이다.

## Repository

- Repository: `robom-labs/runningbom`
- Starting branch: `main`
- Work branch: `r01/runningbom-vnext-first-pass`
- Starting SHA: `aa8fee4bac96cda5377c761b7e96446eb7922257`
- Rollback point: `aa8fee4bac96cda5377c761b7e96446eb7922257`
- Open PRs: `0`
- Starting app version: `0.18.3`
- Starting Android versionCode: `6`
- Starting iOS buildNumber: `5`
- Dirty before receipt: `NO`
- Existing alternate worktree branch `r01/runningbom-vnext-011`: main보다 48개 뒤, 고유 commit 없음

## Existing product

- Web: GitHub Pages 정적 PWA
- Mobile: Expo SDK 57, React Native 0.86, 단일 `App.tsx`
- Core native flow: 대회 검색, 지역·거리·접수 상태 필터, 공식 링크, 접수 알림 예약·취소, 원격 데이터/LKG 번들 fallback, 딥 링크
- Remote race data: GitHub Actions가 6시간마다 수집·검증 후 main에 반영
- Current bundled race rows: `183`
- Current race revision: `2026.07.24-race-data-12`
- Current web app version: `0.18.3`
- Current web deployment artifact SHA: `788447a9bbda6102bf7cda67e503f1f30b4bbdee` (`gh-pages`)
- Current source deployment SHA: `a8e05b10220237a0ac7464d755b519c565794791`

## Baseline validation

| Check | Result | Evidence |
| --- | --- | --- |
| Root tests | `PASS`, 63/63 | `npm test` |
| Root build | `PASS` | `npm run build` |
| Mobile install | `PASS` | `npm ci` in `apps/mobile` |
| Mobile type/config/static check | `PASS` | `npm run check` |
| Expo Doctor | `PASS`, 20/20 | `npx expo-doctor` |
| Production dependency audit | `10 moderate`, no high/critical gate failure | `npm ci`, further audit required |
| Open PR | `0` | `gh pr list --state open` |
| Last CI at source deployment | `PASS` | GitHub Actions run `30068327495` |
| Last Pages deploy | `PASS` | GitHub Actions run `30068327505` |
| Latest race refresh | `PASS` | GitHub Actions run `30175180127` |

## Google Play read-only baseline

Read at `2026-07-26` without saving or publishing changes.

- Highest used Android versionCode observed: `6`
- Closed track: `Alpha`, active, `0.18.3 (6)`
- Closed tester lists: `규랩스 테스터 목록` 44명, `로봄 4앱 비공개 테스터` 1명
- Internal track: inactive, no release
- Production track: access not yet granted
- Play package: `kr.robom.runningbom`
- Play internal changed: `NO`
- Play closed changed: `NO`
- Play production changed: `NO`
- Existing closed testers impacted: `NO`

## EAS and signing baseline

- EAS account: `robom-labs` owner access confirmed
- EAS project: `@robom-labs/runningbom`
- EAS project ID: `5be5e57e-a1a7-4d08-adf1-2218f38b32a5`
- Existing production build: `0.18.3 (6)`, build ID `b7e5c3d0-71c0-4399-b122-c16a819aedfb`
- Existing AAB SHA-256: `e3fc46966870313b57e1d442f5f14c2c0235cd95288de032ef2710df32194f30`
- Existing AAB size: approximately `47 MiB`
- Upload certificate SHA-256 extracted from the signed AAB: `68:F9:6A:DF:AB:A0:47:8A:53:F9:F7:70:2C:69:CA:43:EC:2E:59:91:0B:9C:06:0F:FB:72:70:82:62:28:F7:46`
- Play app signing certificate SHA-256: `BLOCKED_EXTERNAL` until the current Play certificate view is obtained
- `robom.kr/.well-known/assetlinks.json`: `[]`

## Cost and external systems

- New paid services planned: `0`
- Supabase connection in current repository: none
- Google/Kakao/Naver/Apple production OAuth credentials: none in repository
- Real-device long-session matrix: `NOT_RUN`
- Release stage: `CODE_ONLY`

