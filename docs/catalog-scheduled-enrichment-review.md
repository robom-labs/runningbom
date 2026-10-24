# Scheduled catalog enrichment — review before any remote writes

Prepared only in ops-v53-activation. No application files, native builds, Play,
EAS, OTA, Pages settings, accounts, keys or full-site publication were changed.
Remote main readback remains `eb0370ac19f23d793dd6915dd5bfa2b809885551`.
No commit/push/dispatch was performed. Sagan's concurrent course changes are NOT
part of this catalog patch or its allowlist.

## Final owner and slim public candidate

The preserved earlier full owner input is `catalog-7b2f469c8b2e7df3`, JSON SHA
`2bc2dcace2a9e47165841c7cdff57bfe8e0dad8dc2bbeb6a1f86f6df224755c3`.
Its 660 SKUs,449 complete+6 partial records,565 frames and269 model groups remain.
Main has now adopted the following slim pair for the frozen v54 APK; no app files
were written by this ops preparation.

The separate public candidate is in outputs/operations/catalog-owner-public-final.
It has the SAME product identity, commercial and photo/frame fields; only public
decisionEvidence projection differs. Revision `catalog-7460d1b9ebfddae2`, SHA
`111fcf4ac8fa78ae9b05addba2e73373b66d44ab12e638951637638ce974e81f`.
Size2,436,373 UTF-8 bytes /2,201,234 JS characters, down from3,904,291 bytes.
New content has a new revision; this does not reuse the APK's revision.

Public evidence fields: schemaVersion,productId,sku,brand,source,sourceSha256,
checkedAt,headline,supportingText,features,benefits,tradeoff,completeness.
No facts/quotes/raw descriptions/identity internals in public decisionEvidence.
The persistent main-only evidence retains IDs, exact identity fingerprint,
dictionary fact IDs, original source hashes/dates and short matches (current max34
characters), not paragraphs. Full observed HTML/long proof lives in Actions cache
and artifacts only. Public gh-pages overlay still permits exactly the original
JSON+manifest pair, never server evidence, original bitmaps or app/site files.
The full evidence artifact explicitly expires after7days; source/original caches
also have7day reuse TTL and preserve original observation timestamps.

## Actual scheduled sequence in the proposed workflow

1. Install root lock and isolated locked sharp0.35.5 tooling, no app installation.
2. Restore SHA/date-verified document/original cache and actual-attempt rotation.
3. Run source policy, extraction, source identity, LKG, geometry and publication
   tests BEFORE collection.
4. Run existing robots-respecting collector into a candidate, not canonical data.
   Retain the same successful official HTML SHA/date for downstream reuse.
5. Enrich from those documents/cache first. At most24 extra product-page attempts
   and24 exact image attempts; hard wire caps96 source HTTP +64 image HTTP include
   robots/redirects. No retry in enrichment; collector keeps its existing one retry.
6. Features require exact generation/SKU/market/gender/width identity. Full LKG is
   restored only if the public projection AND the current identity fingerprint
   exactly match server evidence. Missing/failed sources never donate other-model
   content or get their checkedAt advanced. Stale unchanged LKG is counted visibly.
7. New image hashes/frames require exact source-owned SKU/color/product/image proof
   <=7days old. URL change invalidates old frames. Original-byte caches are rehashed;
   frames expire after7days. Uncertain canvases use contain, never a guessed crop.
8. Validate schema, identities, all previous records/families and public byte/char
   budget3,500,000 before any canonical persistence. Budget failures retain LKG;
   SKUs are never dropped to fit the budget.
9. Stage ONLY catalog pair plus compact server evidence on main. Compare fresh main
   SHA before push. Overlay ONLY pair onto fresh gh-pages CAS. Existing public HTTP
   checksum/revision/count readback remains mandatory; no broad site workflow.
10. Preserve cache even on partial-failed runs, so blocked sources cannot starve
    later pages or cause repeated cold starts. Collection, enrichment, safe pair
    validation and actual publication are distinct outcomes. Partial coverage is
    not all-source green; the final health gate stays nonzero for incomplete phases.

Network bounds: exact approved supplier URLs, pinned public DNS for new enrichment
reads, HTTPS with certificates, no redirects for images, limited approved source
redirects, per-host serial requests/minimum750ms HTML or1000ms images plus robots
delay.429 cooldown persisted.15s response timeout,8MB HTML/10MiB image,16M pixels.
Document cache capped512 entries/type and7day TTL; own expired cache files pruned.
No bypass, login, proxy rotation or paid provider.

## Local verification actually performed

-127 scoped tests PASS,0fail/0skip, including reused worker geometry/generation tests
- The EXACT workflow command is126 tests; one additional local helper makes127
  scoped tests. The retention7day assertion is in an existing workflow test.
  and the actual isolated decoder. Generic root tests may explicitly skip the
  isolated decoder integration when that separate tool package is absent; the
  catalog workflow installs its lock and requires the test, never skips it.
- Actual scheduled runner offline replay on660:0 page/image/wire HTTP,449complete+
  6partial,565 frames retained; same public product revision after server restore.
- Earlier bounded real collection and new55 photo audit are in owner handoff receipts;
  no new full crawl was performed for this workflow preparation.
- Actual v54 verifyProductFeed accepted the slim candidate from frozen owner2bc;
  groupShoeModels stays269, ACG4 promoted features stay2 each.
- Current/future payload-budget tests include UTF-8 Korean expansion, oversized
  candidates leaving existing files unchanged, new revision and exact manifest SHA.
- Source identity, cross-SKU/market/generation changes, partial overwrite protection,
  cache hash/TTL/date preservation, blocked-source rotation, robots/429 behavior,
  unrelated course64/JTBC sentinel preservation and two-file public policy are tested.

Not claimed: a live run of this new workflow, successful deployment, all sources
healthy or all660 feature/photo source identities freshly verified. Full provider
coverage remains partial;53 new numerical frame candidates await source approval.

## Proposed git boundary

The machine-readable review allowlist and exact diff live under
outputs/operations/catalog-scheduled-review/. Only listed catalog files may enter
the future catalog commit. Include main-only compact evidence with the slim initial
pair so a fresh checkout can preserve the455 reviewed feature records.

Do not stage node_modules, outputs, local native tests, diagnostic research tools,
other agents' course/race files, application code or binary/image assets. Fetch
fresh main again at approval time; no force push and no overwrite of concurrent
writers. The SHA here is a review base, not permission to push later without CAS.
