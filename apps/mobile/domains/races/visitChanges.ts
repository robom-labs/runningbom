// 지난 방문의 대회 피드와 최신 피드를 비교해 다시 확인할 일정만 고릅니다.
import type { RaceFeed } from '../../src/races';

export const RACE_VISIT_SNAPSHOT_VERSION = 1;

export type RaceVisitChangeKind = 'new-race' | 'registration-opened' | 'link-added' | 'schedule-updated';

export type RaceVisitChange = {
  raceId: string;
  kind: RaceVisitChangeKind;
};

type RaceVisitEntry = {
  id: string;
  registrationStatus: string;
  needsReview: boolean;
  hasLink: boolean;
  scheduleSignature: string;
};

export type RaceVisitSnapshot = {
  version: typeof RACE_VISIT_SNAPSHOT_VERSION;
  revision: string;
  entries: RaceVisitEntry[];
};

const changePriority: Record<RaceVisitChangeKind, number> = {
  'registration-opened': 0,
  'new-race': 1,
  'link-added': 2,
  'schedule-updated': 3,
};

function scheduleSignature(entry: {
  raceDate: string;
  region: string;
  venue: string;
  registrationClosesAt?: string;
}): string {
  return [entry.raceDate, entry.region, entry.venue, entry.registrationClosesAt ?? ''].join('\u0001');
}

function isRaceVisitEntry(value: unknown): value is RaceVisitEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<RaceVisitEntry>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.registrationStatus === 'string' &&
    typeof entry.needsReview === 'boolean' &&
    typeof entry.hasLink === 'boolean' &&
    typeof entry.scheduleSignature === 'string'
  );
}

export function isRaceVisitSnapshot(value: unknown): value is RaceVisitSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<RaceVisitSnapshot>;
  return (
    snapshot.version === RACE_VISIT_SNAPSHOT_VERSION &&
    typeof snapshot.revision === 'string' &&
    Array.isArray(snapshot.entries) &&
    snapshot.entries.every(isRaceVisitEntry)
  );
}

/** 현재 표시 가능한 대회만 작은 비교용 값으로 저장합니다. */
export function createRaceVisitSnapshot(feed: RaceFeed): RaceVisitSnapshot {
  return {
    version: RACE_VISIT_SNAPSHOT_VERSION,
    revision: feed.revision,
    entries: feed.races.map((race) => ({
      id: race.id,
      registrationStatus: race.registrationStatus ?? 'unknown',
      needsReview: race.registrationDataStatus === 'needs-review',
      hasLink: Boolean(race.registrationUrl ?? race.sourceDetailUrl),
      scheduleSignature: scheduleSignature(race),
    })),
  };
}

/** 첫 방문에는 변화를 꾸며내지 않고, 다음 방문부터 확인할 항목만 돌려줍니다. */
export function raceVisitChanges(
  previous: RaceVisitSnapshot | null,
  current: RaceVisitSnapshot,
): RaceVisitChange[] {
  if (!previous || previous.revision === current.revision) return [];
  const previousById = new Map(previous.entries.map((entry) => [entry.id, entry]));
  const changes: RaceVisitChange[] = [];

  for (const entry of current.entries) {
    const before = previousById.get(entry.id);
    if (!before) {
      changes.push({ raceId: entry.id, kind: 'new-race' });
      continue;
    }
    if (
      before.registrationStatus !== 'open' &&
      entry.registrationStatus === 'open' &&
      !entry.needsReview
    ) {
      changes.push({ raceId: entry.id, kind: 'registration-opened' });
      continue;
    }
    if (!before.hasLink && entry.hasLink) {
      changes.push({ raceId: entry.id, kind: 'link-added' });
      continue;
    }
    if (before.scheduleSignature !== entry.scheduleSignature) {
      changes.push({ raceId: entry.id, kind: 'schedule-updated' });
    }
  }

  return changes.sort((left, right) => {
    const priority = changePriority[left.kind] - changePriority[right.kind];
    return priority !== 0 ? priority : left.raceId.localeCompare(right.raceId);
  });
}

export function raceVisitChangeLabel(kind: RaceVisitChangeKind): string {
  switch (kind) {
    case 'registration-opened':
      return '접수 시작';
    case 'new-race':
      return '새 대회';
    case 'link-added':
      return '접수 정보 추가';
    case 'schedule-updated':
      return '일정 변경';
  }
}
