# RUNNINGBOM vNext Final Traceability Matrix

> 제품 코드 수정 전에 만든 전체 요구사항 체크리스트다. 구현 중 각 항목을 증거와 함께 갱신한다.

## Phase checklist

| Phase | Scope | Initial classification | Final state | Evidence |
| --- | --- | --- | --- | --- |
| 0 | prompt receipt, repo/Play/EAS baseline, rollback | implemented | pending | `PROMPT_READ_RECEIPT.md`, `BASELINE.md` |
| 1 | race regression, race domain, 5 tabs, deep link | partial | pending | `RACE_REGRESSION_MATRIX.md` |
| 2 | Android native background audio spike and fallback | missing | pending | `AUDIO_SPIKE_RESULTS.md` |
| 3 | coach schema, local records, checkpoint, offline | missing | pending | tests and source |
| 4 | streak, badges, tier | missing | pending | `BADGE_RULES.md` |
| 5 | official shoe data, finder, compare, manifest/LKG | missing | pending | `SHOE_SOURCE_LEDGER.md` |
| 6 | local Supabase schema, RLS, degradation | missing | pending | migrations and RLS tests |
| 7 | provider adapters, linking, deletion | missing | pending | `AUTH_PROVIDER_MATRIX.md` |
| 8 | profile, feed, reactions, comments, moderation | missing | pending | source and runbook |
| 9 | crews, events, attendance, normalized league | missing | pending | source and runbooks |
| 10 | on-device neighborhood foundation, privacy flag | missing | pending | `NEIGHBORHOOD_PRIVACY.md` |
| 11 | privacy, security automation, release guard | partial | pending | workflows and release scripts |
| 12 | full audit | pending | pending | test reports |
| 13 | Preview APK, candidate AAB, bundle inspection | pending | pending | `ARTIFACT_REPORT.md` |
| 14 | Claude Code handoff | pending | pending | `HANDOFF_CODEX_TO_CLAUDE.md` |

## Detailed contract groups

| Group | Required IDs or checks | Initial state | Final state | Evidence |
| --- | --- | --- | --- | --- |
| A Baseline | SHA, versions, dirty, PR, Play tracks, signing, web, rollback | partial | pending | `BASELINE.md` |
| B Race | R-01 through R-26 | partial | pending | `RACE_REGRESSION_MATRIX.md` |
| C UX | 5 tabs, one Today Run, wheel/direct input, sheets, 48dp, 200%, TalkBack, 320/tablet, themes, no dead action, state restore | missing | pending | UI tests/screenshots |
| D Audio | local module, Korean/offline TTS, queue, monotonic clock, FGS, MediaSession, interruption handling, 20/40/60m, Samsung/Pixel, zero paid fallback | missing | pending | audio spike/device matrix |
| E Streak/Badges | timezone, 04:00, movement/run rules, weekly 3, tier/freeze/best, local/server authority, featured badge, idempotency/revoke | missing | pending | badge tests |
| F League | opt-in OFF, 30 cohort, caps, T3 excluded, no shame, normalized crew/neighborhood, appeal, settlement | missing | pending | league tests |
| G Shoes | official catalog, null unknowns, facts/editorial split, finder/compare/current/upcoming, no unauthorized media, external browser, manifest/checksum/LKG | missing | pending | shoe ledger/tests |
| H Auth | Google/Kakao/Naver/Apple adapters and flags, no secret, PKCE/state/nonce, linking/unlinking, local sync, deletion | missing | pending | auth matrix/tests |
| I Social/Profile | guest read, login write, profile/privacy/avatar, safe image, draft/share confirmation, 4 reactions, comment/report/block/moderation/appeal, no fake users/media/DM | missing | pending | social tests/runbook |
| J Crews | visibility types, roles, join/approve/invite, ownership transfer, events/attendance/capacity/place visibility/delete, no instant run/location | missing | pending | crew tests/runbook |
| K RLS/Security | all RLS, projections, service-role absence, cross-user denial, authority denial, role escalation denial, hardened functions, rate limits, forward migrations, scans | missing | pending | RLS negative report |
| L Neighborhood | official data/license, permission-on-action, accuracy/mock, on-device polygon, no coordinate transfer/storage/log, safe wording/privacy/expiry/cooldown/delete/flag/fallback | missing | pending | privacy report/tests |
| M Cost/Failure | core no Supabase, free limits, no keepalive, four degradation modes, quota, no auto-upgrade, zero monthly cash, Apple gate, private backup only | missing | pending | zero-cost report |
| N Artifact | Preview separation/install, signed unused-code AAB, hashes/size/bundle/manifest/permissions/debug/ARM64/16KB/certs/APK/cold/update/data/web diff | pending | pending | artifact report |
| O Release Guard | CODE_ONLY, no push upload, dispatch+approval, track/hash/source/approval checks, all Play flags false, tester list unchanged | missing | pending | release guard tests |
| P Final audit | product/UX/audio/streak/auth/social/privacy/data/release audits, P0/P1 zero, accurate NOT_RUN, no fake PASS | pending | pending | final reports |

## Required deliverables

All files requested by section 29 are tracked here. Missing files must not be reported complete.

- [x] `PROMPT_READ_RECEIPT.md`
- [x] `BASELINE.md`
- [x] `DECISION_REGISTER.md`
- [ ] `PRODUCT_IA.md`
- [ ] `UX_INTERACTION_CONTRACTS.md`
- [x] `RACE_REGRESSION_MATRIX.md`
- [ ] `AUDIO_SPIKE_RESULTS.md`
- [ ] `COACH_DEVICE_MATRIX.md`
- [ ] `BADGE_RULES.md`
- [ ] `LEAGUE_METHODOLOGY.md`
- [ ] `SHOE_SOURCE_LEDGER.md`
- [ ] `STATIC_DATA_REPORT.md`
- [ ] `AUTH_PROVIDER_MATRIX.md`
- [ ] `IDENTITY_TESTS.md`
- [ ] `SUPABASE_SCHEMA.md`
- [ ] `RLS_NEGATIVE_RESULTS.md`
- [ ] `MODERATION_RUNBOOK.md`
- [ ] `CREW_RUNBOOK.md`
- [ ] `NEIGHBORHOOD_PRIVACY.md`
- [ ] `ZERO_COST_OPERATIONS.md`
- [ ] `ACCESSIBILITY_RESULTS.md`
- [ ] `PERFORMANCE_RESULTS.md`
- [ ] `WEB_DIFF_REPORT.md`
- [ ] `RELEASE_MANIFEST.json`
- [ ] `ARTIFACT_REPORT.md`
- [ ] `INTERNAL_TESTER_GUIDE.md`
- [ ] `RECOVERY_RUNBOOK.md`
- [x] `FINAL_TRACEABILITY_MATRIX.md`
- [ ] `HANDOFF_CODEX_TO_CLAUDE.md`
- [ ] `CODEX_CHANGED_FILES.md`
- [ ] `CODEX_TEST_RESULTS.md`
- [ ] `CODEX_KNOWN_GAPS.md`
- [ ] `CODEX_VISUAL_EVIDENCE.md`
- [ ] `CODEX_ARTIFACT_REPORT.md`
- [ ] `CODEX_TRACEABILITY.json`
