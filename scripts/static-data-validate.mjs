// 생성된 정적 데이터와 모바일 fallback의 SHA-256·크기·건수 계약을 검증한다.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  STATIC_DATA_FILES,
  assertStaticManifest,
  byteSize,
  sha256Text,
} from "./static-data-core.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestText = await readFile(join(root, "data", "manifest.json"), "utf8");
const manifest = assertStaticManifest(JSON.parse(manifestText));

for (const fileName of STATIC_DATA_FILES) {
  const rootText = await readFile(join(root, "data", fileName), "utf8");
  const fallbackText = await readFile(
    join(root, "apps", "mobile", "data", "fallback", fileName),
    "utf8",
  );
  if (rootText !== fallbackText) throw new Error(`${fileName}과 모바일 fallback이 다릅니다.`);
  if (sha256Text(rootText) !== manifest.checksums[fileName]) {
    throw new Error(`${fileName} SHA-256이 manifest와 다릅니다.`);
  }
  if (byteSize(rootText) !== manifest.sizes[fileName]) {
    throw new Error(`${fileName} byte size가 manifest와 다릅니다.`);
  }
  const data = JSON.parse(rootText);
  if (data.schemaVersion !== 1 || !Array.isArray(data.records)) {
    throw new Error(`${fileName} dataset schema가 올바르지 않습니다.`);
  }
  if (data.records.length !== manifest.recordCounts[fileName]) {
    throw new Error(`${fileName} recordCount가 manifest와 다릅니다.`);
  }
}

const fallbackManifest = await readFile(
  join(root, "apps", "mobile", "data", "fallback", "manifest.json"),
  "utf8",
);
if (fallbackManifest !== manifestText) throw new Error("모바일 fallback manifest가 root manifest와 다릅니다.");

const races = JSON.parse(await readFile(join(root, "data", "races.json"), "utf8"));
const sourceRaces = JSON.parse(
  await readFile(join(root, "apps", "mobile", "src", "data", "races.json"), "utf8"),
);
if (races.contentVersion !== sourceRaces.revision || races.records.length !== sourceRaces.races.length) {
  throw new Error("대회 sidecar가 모바일 대회 정본과 다릅니다.");
}

const shoes = JSON.parse(await readFile(join(root, "data", "shoes.json"), "utf8"));
for (const shoe of shoes.records) {
  if (!String(shoe.officialUrl ?? "").startsWith("https://")) {
    throw new Error(`공식 HTTPS 출처가 없는 러닝화가 있습니다: ${shoe.id}`);
  }
}

const upcoming = JSON.parse(await readFile(join(root, "data", "upcoming-shoes.json"), "utf8"));
if (upcoming.records.some((shoe) => shoe.status !== "upcoming")) {
  throw new Error("출시 예정 projection에 upcoming이 아닌 러닝화가 있습니다.");
}

console.log(`정적 데이터 manifest 검증 완료: ${manifest.contentVersion}`);
