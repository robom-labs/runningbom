// 지난 방문의 대회 피드와 최신 피드를 비교해 다시 확인할 일정만 고릅니다.
import type { RaceFeed } from '../../src/races';

export const RACE_VISIT_SNAPSHOT_VERSION = 2;

export type RaceVisitChangeKind = 'new-race' | 'registration-opened' | 'link-added' | 'schedule-updated';

export type RaceVisitScheduleDetail = {
  label: string;
  previousValue: string;
  currentValue: string;
  isDate: boolean;
};

export type RaceVisitChange = {
  raceId: string;
  kind: RaceVisitChangeKind;
  detail?: string;
  schedule?: RaceVisitScheduleDetail;
};

type RaceVisitEntry = {
  id: string;
  registrationStatus: string;
  needsReview: boolean;
  hasLink: boolean;
  raceDate: string;
  region: string;
  venue: string;
  registrationClosesAt: string;
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

function isRaceVisitEntry(value: unknown): value is RaceVisitEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<RaceVisitEntry>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.registrationStatus === 'string' &&
    typeof entry.needsReview === 'boolean' &&
    typeof entry.hasLink === 'boolean' &&
    typeof entry.raceDate === 'string' &&
    typeof entry.region === 'string' &&
    typeof entry.venue === 'string' &&
    typeof entry.registrationClosesAt === 'string'
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
      raceDate: race.raceDate,
      region: race.region,
      venue: race.venue,
      registrationClosesAt: race.registrationClosesAt ?? '',
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
    const schedule = scheduleChangeDetail(before, entry);
    if (schedule) {
      changes.push({
        raceId: entry.id,
        kind: 'schedule-updated',
        detail: formatScheduleChangeDetail(schedule),
        schedule,
      });
    }
  }

  return changes.sort((left, right) => {
    const priority = changePriority[left.kind] - changePriority[right.kind];
    return priority !== 0 ? priority : left.raceId.localeCompare(right.raceId);
  });
}

/** 읽지 않은 변화는 종류별로 한 건만 남겨 같은 대회가 목록을 채우지 않게 합니다. */
export function mergeRaceVisitChanges(
  pending: RaceVisitChange[],
  incoming: RaceVisitChange[],
): RaceVisitChange[] {
  const merged = new Map<string, RaceVisitChange>();
  for (const change of [...pending, ...incoming]) {
    const key = `${change.raceId}\u0001${change.kind}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, change);
      continue;
    }
    merged.set(key, mergeRaceVisitChange(existing, change));
  }
  return [...merged.values()].sort((left, right) => {
    const priority = changePriority[left.kind] - changePriority[right.kind];
    return priority !== 0 ? priority : left.raceId.localeCompare(right.raceId);
  });
}

function mergeRaceVisitChange(existing: RaceVisitChange, incoming: RaceVisitChange): RaceVisitChange {
  if (existing.kind !== 'schedule-updated' || incoming.kind !== 'schedule-updated') return existing;
  if (!existing.schedule || !incoming.schedule || existing.schedule.label !== incoming.schedule.label) {
    return incoming;
  }
  const schedule = {
    ...existing.schedule,
    currentValue: incoming.schedule.currentValue,
  };
  return {
    ...existing,
    detail: formatScheduleChangeDetail(schedule),
    schedule,
  };
}

function scheduleChangeDetail(before: RaceVisitEntry, entry: RaceVisitEntry): RaceVisitScheduleDetail | undefined {
  const fields: Array<[string, string, string, boolean]> = [
    ['대회일', before.raceDate, entry.raceDate, true],
    ['지역', before.region, entry.region, false],
    ['장소', before.venue, entry.venue, false],
    ['접수 마감', before.registrationClosesAt, entry.registrationClosesAt, true],
  ];
  const changed = fields.find(([, previous, current]) => previous !== current);
  if (!changed) return undefined;
  const [label, previous, current, isDate] = changed;
  return { label, previousValue: previous, currentValue: current, isDate };
}

function formatScheduleChangeDetail(schedule: RaceVisitScheduleDetail): string {
  return `${schedule.label} ${formatChangeValue(schedule.previousValue, schedule.isDate)} → ${formatChangeValue(schedule.currentValue, schedule.isDate)}`;
}

function formatChangeValue(value: string, isDate: boolean): string {
  if (!value) return '미정';
  return isDate ? value.slice(0, 16).replace('T', ' ').replaceAll('-', '.') : value;
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
