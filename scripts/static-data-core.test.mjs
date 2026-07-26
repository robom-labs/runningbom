// 정적 데이터 manifest의 결정성과 변조 감지를 단위 테스트한다.
import assert from "node:assert/strict";
import test from "node:test";

import {
  STATIC_DATA_FILES,
  assertStaticManifest,
  byteSize,
  contentVersionFor,
  latestIso,
  sha256Text,
  stableJson,
} from "./static-data-core.mjs";

test("같은 입력은 같은 JSON·SHA-256·contentVersion을 만든다", () => {
  const text = stableJson({ schemaVersion: 1, records: [{ id: "race-1" }] });
  const checksums = Object.fromEntries(STATIC_DATA_FILES.map((name) => [name, sha256Text(text)]));
  assert.equal(text, stableJson({ schemaVersion: 1, records: [{ id: "race-1" }] }));
  assert.equal(sha256Text(text), sha256Text(text));
  assert.equal(contentVersionFor(checksums), contentVersionFor(checksums));
  assert.equal(byteSize("가"), 3);
});

test("manifest 검증은 변조된 checksum 기반 contentVersion을 거부한다", () => {
  const checksums = Object.fromEntries(
    STATIC_DATA_FILES.map((name) => [name, sha256Text(`${name}\n`)]),
  );
  const manifest = {
    schemaVersion: 1,
    contentVersion: contentVersionFor(checksums),
    generatedAt: "2026-07-25T15:52:29.628Z",
    minimumAppVersion: "0.18.3",
    checksums,
    sizes: Object.fromEntries(STATIC_DATA_FILES.map((name) => [name, 10])),
    recordCounts: Object.fromEntries(STATIC_DATA_FILES.map((name) => [name, 0])),
  };
  assert.equal(assertStaticManifest(manifest), manifest);
  assert.throws(
    () => assertStaticManifest({ ...manifest, contentVersion: "static-00000000000000000000" }),
    /checksums/,
  );
});

test("generatedAt은 입력 순서와 무관하게 가장 최신 검증 시각이다", () => {
  assert.equal(
    latestIso(["2026-07-01T00:00:00.000Z", "2026-07-25T15:52:29.628Z"]),
    "2026-07-25T15:52:29.628Z",
  );
});
