# Codex Artifact Report

`ARTIFACT_REPORT.md`의 artifact와 검증 결과를 Claude Code가 독립적으로 대조하기 위한 요약 문서다.

- Artifact source SHA: `6dd45f26de428bb8115fc55d7b719e6b279635f6`
- Preview APK: `/Users/runner706/Documents/Codex/2026-07-11/01-2/work/vnext-runningbom-artifacts-final/runningbom-preview-0.19.0-v7.apk`
- Preview SHA-256: `fdfadc7baf06fa2194fbed7f28cd1483302983d84957fc0f3bda741bd408fb2c`
- Candidate AAB: `/Users/runner706/Documents/Codex/2026-07-11/01-2/work/vnext-runningbom-artifacts-final/runningbom-production-candidate-0.19.0-v7.aab`
- Candidate AAB SHA-256: `f23d9a10d6c3cd1f9a6ec0f11a52b20014fee6c5c66ed1703d4bf3c77ed2a502`
- AAB size: `61,834,966 bytes`
- Build method: EAS local build, 기존 remote signing credential 사용
- bundletool validate: PASS, `1.18.3`
- Manifest dump: PASS
- Config dump: PASS, `PAGE_ALIGNMENT_16K`
- APK set: 생성 완료, 다만 서명되지 않아 구조 검사 전용
- Forbidden permissions: 0
- Device install: `BLOCKED_EXTERNAL`
- Play upload: 실행하지 않음
