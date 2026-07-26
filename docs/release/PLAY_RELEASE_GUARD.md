<!-- 수동 Google Play workflow의 안전 조건과 사용법을 설명한다. -->
# Google Play release guard

## 기본 보장

- `ops/release/RELEASE_STAGE.json`의 기본 단계는 `CODE_ONLY`입니다.
- `.github/workflows/play-release.yml`은 `workflow_dispatch`로만 실행됩니다.
- `main` push, PR, schedule 이벤트로 Play 업로드가 실행되지 않습니다.
- source SHA, EAS build ID, AAB SHA-256, 승인 참조값이 모두 필요합니다.
- AAB와 EAS build의 source SHA가 checkout SHA와 다르면 중단합니다.
- 실제 제출 job은 대상별 GitHub environment 승인을 거칩니다.
- `execute=false`가 기본이며 실제 Play 제출을 하지 않습니다.
- 실제 제출 직전 가드를 다시 실행하고 실패하면 닫힌 상태로 종료합니다.

## 단계 변경

승인된 별도 릴리스 요청이 있을 때만 `RELEASE_STAGE.json`의 stage와 네 boolean을 함께 변경합니다. 가드는 stage와 boolean의 조합이 하드코딩 정책과 정확히 일치하지 않으면 거부합니다.

## 로컬 검증

```bash
node --test scripts/release/assert-release-intent.test.mjs
```

현재 `CODE_ONLY` 정본으로 실제 제출을 시도하면 dry-run 단계에서 차단되는 것이 정상입니다.

## 수동 workflow 입력

- `target_track`: `internal`, `closed`, `production`
- `release_intent`: 단계와 일치하는 명시적 의도
- `source_sha`: 전체 40자리 Git SHA
- `eas_build_id`: 해당 source SHA로 생성한 EAS build ID
- `artifact_sha256`: 다운로드될 AAB의 SHA-256
- `approval_reference`: `docs/release/CEO_APPROVALS.md`의 승인 참조값
- `execute`: 기본 `false`

`closed/CLOSED_REVIEW`는 검토 전용 게시를 보장할 안전한 API가 구성될 때까지 실제 실행하지 않습니다.
