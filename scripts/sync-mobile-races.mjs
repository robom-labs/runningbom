// 웹 정본의 검증된 대회 데이터를 네이티브 오프라인 번들 형식으로 재현 가능하게 변환한다.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collapseRaceRows } from "./race-data-core.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "outputs", "pushrun-site", "races.json");
const targetPath = join(root, "apps", "mobile", "src", "data", "races.json");
const source = JSON.parse(await readFile(sourcePath, "utf8"));

function stableId(race, prefix) {
  if (race.id) return race.id;
  const sourceNumber = String(race.sourceDetailUrl ?? "").match(/[?&]no=(\d+)/)?.[1];
  if (sourceNumber) return `${prefix}-${sourceNumber}`;
  const fingerprint = createHash("sha256")
    .update(`${race.name}|${race.raceDate ?? race.date}`)
    .digest("hex")
    .slice(0, 12);
  return `${prefix}-${fingerprint}`;
}

function normalizeRace(race, prefix) {
  const registrationUrl = typeof race.registrationUrl === "string" && race.registrationUrl.startsWith("https://")
    ? race.registrationUrl
    : undefined;
  const sourceDetailUrl = typeof race.sourceDetailUrl === "string" && race.sourceDetailUrl.startsWith("https://")
    ? race.sourceDetailUrl
    : undefined;
  const externalUrl = registrationUrl ?? sourceDetailUrl;
  const sourceCheckedAt = typeof race.dataVerifiedAt === "string" && !Number.isNaN(Date.parse(race.dataVerifiedAt))
    ? race.dataVerifiedAt
    : undefined;
  // 접수 중이라는 상태만 있고 마지막 확인 시각이 없으면, 기본 접수·알림 행동에서 안내하지 않습니다.
  // 원본 행은 남기되 앱에서 확인 필요로 분리해, 확인 시각을 지어내거나 대회를 삭제하지 않습니다.
  const registrationDataStatus = race.registrationDataStatus ?? (sourceCheckedAt ? undefined : "needs-review");
  const registrationDataIssue = race.registrationDataIssue
    ?? (!sourceCheckedAt ? "마지막 데이터 확인 시각이 없어 접수 상태를 안내하지 않아요." : undefined);
  return {
    id: stableId(race, prefix),
    name: race.name,
    region: race.region,
    venue: race.venue,
    raceDate: String(race.raceDate ?? race.date).slice(0, 10),
    distances: race.distances,
    registrationOpensAt: race.registrationOpenAt,
    registrationClosesAt: race.registrationCloseAt ?? undefined,
    registrationTimeConfirmed: race.registrationOpenTimeConfirmed === true,
    registrationWindows: Array.isArray(race.registrationWindows)
      ? race.registrationWindows
        .filter((window) => window?.opensAt)
        .map((window) => ({
          label: window.label,
          distance: window.distance,
          opensAt: window.opensAt,
          closesAt: window.closesAt ?? undefined,
          timeConfirmed: window.timeConfirmed === true,
        }))
      : undefined,
    registrationStatus: race.status ?? "unknown",
    registrationDataStatus,
    registrationDataIssue,
    registrationPeriodLabel: race.registrationPeriodLabel ?? undefined,
    note: race.note ?? undefined,
    capacity: Number.isFinite(race.capacity) ? race.capacity : undefined,
    organizer: race.organizer ?? undefined,
    sourceCheckedAt,
    registrationUrl,
    sourceDetailUrl,
    linkReference: typeof race.linkVerifiedFrom === "string" ? race.linkVerifiedFrom : undefined,
    verifiedAt: race.registrationTimeVerifiedAt ?? race.linkVerifiedFrom ?? undefined,
    externalUrl,
    // 0.21.0 이하가 원격 피드를 읽어도 링크를 잃지 않도록 다음 출시 한 번은 별칭을 함께 냅니다.
    officialUrl: externalUrl,
    externalLinkKind: externalUrl ? (registrationUrl ? "registration" : "source") : undefined,
    sourceName: race.sourceName,
  };
}

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
