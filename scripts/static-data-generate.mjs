// 현재 대회·러닝화·코칭 정본에서 결정적인 배포 sidecar와 모바일 fallback을 생성한다.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  STATIC_DATA_FILES,
  byteSize,
  contentVersionFor,
  latestIso,
  sha256Text,
  stableJson,
} from "./static-data-core.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const minimumAppVersion = rootPackage.staticDataMinimumAppVersion;
if (!/^\d+\.\d+\.\d+$/.test(minimumAppVersion ?? "")) {
  throw new Error("staticDataMinimumAppVersion이 semver 형식이 아닙니다.");
}
const webRaces = JSON.parse(await readFile(join(root, "outputs", "pushrun-site", "races.json"), "utf8"));
const mobileRaces = JSON.parse(await readFile(join(root, "apps", "mobile", "src", "data", "races.json"), "utf8"));
const shoeModule = await import(
  pathToFileURL(join(root, "apps", "mobile", "domains", "shoes", "catalog.ts")).href
);
const coachModule = await import(
  pathToFileURL(join(root, "apps", "mobile", "domains", "coaching", "model.ts")).href
);

const runningKinds = [
  "편안한 지속주",
  "걷고 달리기",
  "회복하며",
  "계속 달리기",
  "조금 빠르게",
  "인터벌",
  "러닝머신",
  "대회 전",
];
const runningDurations = [10, 15, 20, 30, 40, 50, 60];
const movementSessions = [
  ["회복 루틴", 5],
  ["아침 깨우기", 5],
  ["걷기", 10],
  ["걷기", 20],
];

function isoFromDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`공식 확인일 형식이 올바르지 않습니다: ${value}`);
  }
  return `${value}T00:00:00.000Z`;
}

function isoFromMonthlyVersion(value) {
  const matched = String(value).match(/^(\d{4})\.(\d{2})/);
  if (!matched) throw new Error(`코칭 콘텐츠 버전에서 기준월을 읽지 못했습니다: ${value}`);
  return `${matched[1]}-${matched[2]}-01T00:00:00.000Z`;
}

function dataset({ contentVersion, generatedAt, source, records }) {
  return {
    schemaVersion: 1,
    contentVersion,
    generatedAt,
    source,
    records,
  };
}

if (mobileRaces.revision !== webRaces.version) {
  throw new Error("모바일 대회 번들과 웹 정본의 revision이 다릅니다. 먼저 npm run mobile:sync를 실행하세요.");
}

const raceRecords = [...mobileRaces.races].sort(
  (left, right) => left.raceDate.localeCompare(right.raceDate) || left.id.localeCompare(right.id),
);
const shoeRecords = [...shoeModule.shoes].sort((left, right) => left.id.localeCompare(right.id));
const upcomingShoeRecords = shoeRecords.filter((shoe) => shoe.status === "upcoming");
const coachingRecords = [
  ...runningKinds.flatMap((title) =>
    runningDurations.map((duration) => coachModule.createCoachSession(title, duration, "standard")),
  ),
  ...movementSessions.map(([title, duration]) =>
    coachModule.createCoachSession(title, duration, "standard"),
  ),
].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));

const raceGeneratedAt = webRaces.lastSuccessfulRefreshAt;
const shoeGeneratedAt = latestIso(shoeRecords.map((shoe) => isoFromDate(shoe.verifiedAt)));
const coachGeneratedAt = isoFromMonthlyVersion(coachModule.COACH_CONTENT_VERSION);

const datasets = {
  "races.json": dataset({
    contentVersion: mobileRaces.revision,
    generatedAt: raceGeneratedAt,
    source: {
      kind: "verified-web-normalization",
      path: "outputs/pushrun-site/races.json",
      upstreams: webRaces.sources,
    },
    records: raceRecords,
  }),
  "shoes.json": dataset({
    contentVersion: shoeModule.SHOE_DATA_VERSION,
    generatedAt: shoeGeneratedAt,
    source: {
      kind: "official-source-ledger",
      path: "apps/mobile/domains/shoes/catalog.ts",
    },
    records: shoeRecords,
  }),
  "upcoming-shoes.json": dataset({
    contentVersion: shoeModule.SHOE_DATA_VERSION,
    generatedAt: shoeGeneratedAt,
    source: {
      kind: "verified-upcoming-projection",
      path: "apps/mobile/domains/shoes/catalog.ts",
    },
    records: upcomingShoeRecords,
  }),
  "coaching.json": dataset({
    contentVersion: coachModule.COACH_CONTENT_VERSION,
    generatedAt: coachGeneratedAt,
    source: {
      kind: "runningbom-authored-content",
      path: "apps/mobile/domains/coaching/model.ts",
    },
    records: coachingRecords,
  }),
};

for (const fileName of STATIC_DATA_FILES) {
  if (!datasets[fileName]) throw new Error(`${fileName} 생성 결과가 없습니다.`);
}

const texts = Object.fromEntries(
  STATIC_DATA_FILES.map((fileName) => [fileName, stableJson(datasets[fileName])]),
);
const checksums = Object.fromEntries(
  STATIC_DATA_FILES.map((fileName) => [fileName, sha256Text(texts[fileName])]),
);
const sizes = Object.fromEntries(
  STATIC_DATA_FILES.map((fileName) => [fileName, byteSize(texts[fileName])]),
);
const recordCounts = Object.fromEntries(
  STATIC_DATA_FILES.map((fileName) => [fileName, datasets[fileName].records.length]),
);
const manifest = {
  schemaVersion: 1,
  contentVersion: contentVersionFor(checksums),
  generatedAt: latestIso([raceGeneratedAt, shoeGeneratedAt, coachGeneratedAt]),
  minimumAppVersion,
  checksums,
  sizes,
  recordCounts,
};
const manifestText = stableJson(manifest);

const targets = [
  ...STATIC_DATA_FILES.map((fileName) => [join(root, "data", fileName), texts[fileName]]),
  [join(root, "data", "manifest.json"), manifestText],
  ...STATIC_DATA_FILES.map((fileName) => [
    join(root, "apps", "mobile", "data", "fallback", fileName),
    texts[fileName],
  ]),
  [join(root, "apps", "mobile", "data", "fallback", "manifest.json"), manifestText],
];

for (const [path, expected] of targets) {
  if (checkOnly) {
    let current;
    try {
      current = await readFile(path, "utf8");
    } catch {
      throw new Error(`정적 데이터 파일이 없습니다: ${path}`);
    }
    if (current !== expected) {
      throw new Error(`정적 데이터가 현재 정본과 다릅니다: ${path}\nnpm run static-data:generate를 실행하세요.`);
    }
    continue;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, expected);
}

console.log(
  checkOnly
    ? `정적 데이터 sidecar 확인 완료: ${manifest.contentVersion}`
    : `정적 데이터 sidecar 생성 완료: ${manifest.contentVersion}`,
);
