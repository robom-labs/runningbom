# Codex Changed Files

기준은 `aa8fee4bac96cda5377c761b7e96446eb7922257`이며, 전체 목록은 다음 명령으로 재현한다.

```bash
git diff --name-status aa8fee4bac96cda5377c761b7e96446eb7922257..HEAD
```

## 모바일 제품

- `apps/mobile/App.tsx`
- `apps/mobile/app.config.js`
- `apps/mobile/app.json`
- `apps/mobile/eas.json`
- `apps/mobile/package.json`
- `apps/mobile/app/design-system/*`
- `apps/mobile/app/navigation/*`
- `apps/mobile/app/screens/{home,explore,start,community,my}/*`
- `apps/mobile/app/state/*`
- `apps/mobile/domains/{activities,badges,coaching,identity,races,shoes,social}/*`
- `apps/mobile/services/{audio,feature-flags,static-data,storage,supabase}/*`
- `apps/mobile/modules/runningbom-coach/*`
- `apps/mobile/tests/*`

## 정적 데이터

- `data/{manifest,races,shoes,upcoming-shoes,coaching}.json`
- `apps/mobile/data/fallback/*`
- `scripts/static-data-*.mjs`

## 소셜 기반

- `supabase/config.toml`
- `supabase/migrations/20260726071733_vnext_social_foundation.sql`
- `supabase/functions/process-deletion-jobs/index.ts`
- `scripts/supabase-security-contract.test.mjs`

## 릴리스 안전장치

- `ops/release/RELEASE_STAGE.json`
- `scripts/release/assert-release-intent.mjs`
- `scripts/release/assert-release-intent.test.mjs`
- `.github/workflows/play-release.yml`
- `.github/workflows/{ci,pages,daily-self-improve,refresh-race-data}.yml`
- `docs/release/{PLAY_RELEASE_GUARD,CEO_APPROVALS}.md`

## 웹·패밀리

- `outputs/pushrun-site/{index.html,app.js,sw.js}`
- `outputs/pushrun-site/family/app-meta.json`
- `generated/robom-family/app-meta.json`
- `family.lock.json`

## vNext 증거 문서

- `docs/vnext/*`
