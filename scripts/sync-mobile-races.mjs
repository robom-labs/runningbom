// 웹 정본의 검증된 대회 데이터를 네이티브 오프라인 번들 형식으로 재현 가능하게 변환한다.
import { normalizeRace } from "./mobile-race-core.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collapseRaceRows } from "./race-data-core.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "outputs", "pushrun-site", "races.json");
const targetPath = join(root, "apps", "mobile", "src", "data", "races.json");
const source = JSON.parse(await readFile(sourcePath, "utf8"));

const canonicalRows = collapseRaceRows([
  ...(source.featuredRaces ?? []).map((race) => ({ ...race, __syncPrefix: "featured" })),
  ...(source.scheduleFeed ?? []).map((race) => ({ ...race, __syncPrefix: "schedule" })),
]);

const races = canonicalRows
  .map((race) => normalizeRace(race, race.__syncPrefix ?? "schedule"))
  .filter((race) => race.name && race.region && race.venue && race.raceDate && race.registrationOpensAt)
  .sort((left, right) => left.raceDate.localeCompare(right.raceDate) || left.name.localeCompare(right.name, "ko"));

const output = `${JSON.stringify({
  revision: source.version,
  source: "RunningBom 웹 정본의 검증된 대회 데이터",
  races,
}, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = await readFile(targetPath, "utf8");
  if (current !== output) {
    throw new Error("모바일 대회 번들이 웹 정본과 다릅니다. npm run mobile:sync를 실행하세요.");
  }
} else {
  await writeFile(targetPath, output);
  console.log(`모바일 대회 ${races.length}개를 동기화했습니다.`);
}
