# RUNNINGBOM vNext Final Traceability Matrix

> 제품 코드 수정 전에 만든 전체 요구사항 체크리스트다. 구현 중 각 항목을 증거와 함께 갱신한다.

## Phase checklist

| Phase | Scope | Initial classification | Final state | Evidence |
| --- | --- | --- | --- | --- |
| 0 | prompt receipt, repo/Play/EAS baseline, rollback | implemented | PASS | `PROMPT_READ_RECEIPT.md`, `BASELINE.md` |
| 1 | race regression, race domain, 5 tabs, deep link | partial | PASS_WITH_NOT_RUN | `RACE_REGRESSION_MATRIX.md` |
| 2 | Android native background audio spike and fallback | missing | PASS_CODE_BLOCKED_DEVICE | `AUDIO_SPIKE_RESULTS.md`, `COACH_DEVICE_MATRIX.md` |
| 3 | coach schema, local records, checkpoint, offline | missing | PASS_TEST | `core-rules.test.ts`, `fallback-clock.test.ts` |
| 4 | streak, badges, tier | missing | PASS_TEST | `BADGE_RULES.md`, `core-rules.test.ts` |
| 5 | official shoe data, finder, compare, manifest/LKG | missing | PASS_TEST | `SHOE_SOURCE_LEDGER.md`, `STATIC_DATA_REPORT.md` |
| 6 | local Supabase schema, RLS, degradation | missing | PASS_STATIC_BLOCKED_EXTERNAL | migration, `RLS_NEGATIVE_RESULTS.md` |
| 7 | provider adapters, linking, deletion | missing | PASS_CODE_BLOCKED_EXTERNAL | `AUTH_PROVIDER_MATRIX.md`, `IDENTITY_TESTS.md` |
| 8 | profile, feed, reactions, comments, moderation | missing | PASS_FOUNDATION_DISABLED | source, `MODERATION_RUNBOOK.md` |
| 9 | crews, events, attendance, normalized league | missing | PASS_FOUNDATION_DISABLED | `CREW_RUNBOOK.md`, `LEAGUE_METHODOLOGY.md` |
| 10 | on-device neighborhood foundation, privacy flag | missing | SAFE_FALLBACK_ONLY | `NEIGHBORHOOD_PRIVACY.md` |
| 11 | privacy, security automation, release guard | partial | PASS_TEST | workflows, release scripts, security tests |
| 12 | full audit | pending | PASS_WITH_BLOCKERS | `CODEX_TEST_RESULTS.md`, `CODEX_KNOWN_GAPS.md` |
| 13 | Preview APK, candidate AAB, bundle inspection | pending | PASS_ARTIFACT_BLOCKED_DEVICE | `ARTIFACT_REPORT.md` |
| 14 | Claude Code handoff | pending | PASS | `HANDOFF_CODEX_TO_CLAUDE.md` |

## Detailed contract groups

| Group | Required IDs or checks | Initial state | Final state | Evidence |
| --- | --- | --- | --- | --- |
| A Baseline | SHA, versions, dirty, PR, Play tracks, signing, web, rollback | partial | PASS | `BASELINE.md` |
| B Race | R-01 through R-26 | partial | PASS_WITH_NOT_RUN | `RACE_REGRESSION_MATRIX.md` |
| C UX | 5 tabs, one Today Run, wheel/direct input, sheets, 48dp, 200%, TalkBack, 320/tablet, themes, no dead action, state restore | missing | PASS_CODE_BLOCKED_DEVICE | `PRODUCT_IA.md`, `ACCESSIBILITY_RESULTS.md`, `CODEX_VISUAL_EVIDENCE.md` |
| D Audio | local module, Korean/offline TTS, queue, monotonic clock, FGS, MediaSession, interruption handling, 20/40/60m, Samsung/Pixel, zero paid fallback | missing | PASS_CODE_BLOCKED_DEVICE | `AUDIO_SPIKE_RESULTS.md`, `COACH_DEVICE_MATRIX.md` |
| E Streak/Badges | timezone, 04:00, movement/run rules, weekly 3, tier/freeze/best, local/server authority, featured badge, idempotency/revoke | missing | PASS_TEST | `BADGE_RULES.md`, `core-rules.test.ts` |
| F League | opt-in OFF, 30 cohort, caps, T3 excluded, no shame, normalized crew/neighborhood, appeal, settlement | missing | PASS_FOUNDATION_DISABLED | `LEAGUE_METHODOLOGY.md` |
| G Shoes | official catalog, null unknowns, facts/editorial split, finder/compare/current/upcoming, no unauthorized media, external browser, manifest/checksum/LKG | missing | PASS_TEST | `SHOE_SOURCE_LEDGER.md`, static-data tests |
| H Auth | Google/Kakao/Naver/Apple adapters and flags, no secret, PKCE/state/nonce, linking/unlinking, local sync, deletion | missing | PASS_CODE_BLOCKED_EXTERNAL | `AUTH_PROVIDER_MATRIX.md`, `IDENTITY_TESTS.md` |
| I Social/Profile | guest read, login write, profile/privacy/avatar, safe image, draft/share confirmation, 4 reactions, comment/report/block/moderation/appeal, no fake users/media/DM | missing | PASS_FOUNDATION_DISABLED | social contracts, migration, `MODERATION_RUNBOOK.md` |
| J Crews | visibility types, roles, join/approve/invite, ownership transfer, events/attendance/capacity/place visibility/delete, no instant run/location | missing | PASS_FOUNDATION_DISABLED | migration, `CREW_RUNBOOK.md` |
| K RLS/Security | all RLS, projections, service-role absence, cross-user denial, authority denial, role escalation denial, hardened functions, rate limits, forward migrations, scans | missing | PASS_STATIC_BLOCKED_EXTERNAL | security contract tests, `RLS_NEGATIVE_RESULTS.md` |
| L Neighborhood | official data/license, permission-on-action, accuracy/mock, on-device polygon, no coordinate transfer/storage/log, safe wording/privacy/expiry/cooldown/delete/flag/fallback | missing | SAFE_FALLBACK_ONLY | `NEIGHBORHOOD_PRIVACY.md` |
| M Cost/Failure | core no Supabase, free limits, no keepalive, four degradation modes, quota, no auto-upgrade, zero monthly cash, Apple gate, private backup only | missing | PASS_CODE_WITH_NOT_RUN | `ZERO_COST_OPERATIONS.md` |
| N Artifact | Preview separation/install, signed unused-code AAB, hashes/size/bundle/manifest/permissions/debug/ARM64/16KB/certs/APK/cold/update/data/web diff | pending | PASS_BUILD_BLOCKED_INSTALL | `ARTIFACT_REPORT.md` |
| O Release Guard | CODE_ONLY, no push upload, dispatch+approval, track/hash/source/approval checks, all Play flags false, tester list unchanged | missing | PASS_TEST | release guard tests, `PLAY_RELEASE_GUARD.md` |
| P Final audit | product/UX/audio/streak/auth/social/privacy/data/release audits, P0/P1 zero, accurate NOT_RUN, no fake PASS | pending | PASS_WITH_BLOCKERS | all vNext reports |

## Required deliverables

All files requested by section 29 are tracked here. Missing files must not be reported complete.

- [x] `PROMPT_READ_RECEIPT.md`
- [x] `BASELINE.md`
- [x] `DECISION_REGISTER.md`
- [x] `PRODUCT_IA.md`
- [x] `UX_INTERACTION_CONTRACTS.md`
- [x] `RACE_REGRESSION_MATRIX.md`
- [x] `AUDIO_SPIKE_RESULTS.md`
- [x] `COACH_DEVICE_MATRIX.md`
- [x] `BADGE_RULES.md`
- [x] `LEAGUE_METHODOLOGY.md`
- [x] `SHOE_SOURCE_LEDGER.md`
- [x] `STATIC_DATA_REPORT.md`
- [x] `AUTH_PROVIDER_MATRIX.md`
- [x] `IDENTITY_TESTS.md`
- [x] `SUPABASE_SCHEMA.md`
- [x] `RLS_NEGATIVE_RESULTS.md`
- [x] `MODERATION_RUNBOOK.md`
- [x] `CREW_RUNBOOK.md`
- [x] `NEIGHBORHOOD_PRIVACY.md`
- [x] `ZERO_COST_OPERATIONS.md`
- [x] `ACCESSIBILITY_RESULTS.md`
- [x] `PERFORMANCE_RESULTS.md`
- [x] `WEB_DIFF_REPORT.md`
- [x] `RELEASE_MANIFEST.json`
- [x] `ARTIFACT_REPORT.md`
- [x] `INTERNAL_TESTER_GUIDE.md`
- [x] `RECOVERY_RUNBOOK.md`
- [x] `FINAL_TRACEABILITY_MATRIX.md`
- [x] `HANDOFF_CODEX_TO_CLAUDE.md`
- [x] `CODEX_CHANGED_FILES.md`
- [x] `CODEX_TEST_RESULTS.md`
- [x] `CODEX_KNOWN_GAPS.md`
- [x] `CODEX_VISUAL_EVIDENCE.md`
- [x] `CODEX_ARTIFACT_REPORT.md`
- [x] `CODEX_TRACEABILITY.json`
