import { createHash } from "node:crypto";

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

export function normalizeRace(race, prefix) {
  const registrationUrl = typeof race.registrationUrl === "string" && race.registrationUrl.startsWith("https://")
    ? race.registrationUrl
    : undefined;
  const sourceDetailUrl = typeof race.sourceDetailUrl === "string" && race.sourceDetailUrl.startsWith("https://")
    ? race.sourceDetailUrl
    : undefined;
  const externalUrl = registrationUrl ?? sourceDetailUrl;
  const observedAt=race.lastObservedAt??race.dataVerifiedAt;
  const sourceCheckedAt = typeof observedAt === "string" && !Number.isNaN(Date.parse(observedAt))
    ? observedAt
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
