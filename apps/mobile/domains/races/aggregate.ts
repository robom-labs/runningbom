// 같은 대회가 종목(거리)별로 여러 행으로 들어와도 대회 1건으로 집계합니다.
import { registrationStatusLabel } from '../../src/races';
import type { DistanceFilter, Race, RaceDistance, RegionFilter } from '../../src/types';

const distanceOrder: RaceDistance[] = ['5K', '10K', 'Half', 'Full', 'Trail'];

// 대회명에서 종목(거리) 표기를 걷어내 같은 대회의 다른 종목 행을 식별합니다.
export function normalizeRaceName(name: string): string {
  const stripped = name
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/[([{][^)\]}]*[)\]}]/g, ' ')
    .replace(/\d+(?:\.\d+)?\s*(?:k|km|킬로미터|킬로)(?![a-z가-힣])/g, ' ')
    .replace(/하프코스|하프마라톤|하프|풀코스|풀마라톤|단축마라톤|건강달리기/g, ' ')
    .replace(/[^0-9a-z가-힣]+/g, ' ')
    .trim();
  return stripped || name.normalize('NFKC').trim().toLocaleLowerCase('ko-KR');
}

// 대회 고유 식별자입니다. 이름·날짜·지역이 같으면 종목이 달라도 같은 대회로 봅니다.
export function raceGroupKey(race: Race): string {
  return `${normalizeRaceName(race.name)}|${race.raceDate}|${race.region.trim()}`;
}

export type RaceGroup = {
  id: string;
  key: string;
  raceIds: string[];
  primary: Race;
  entries: Race[];
  name: string;
  region: string;
  venue: string;
  raceDate: string;
  distances: RaceDistance[];
  status: string;
  sourceNames: string[];
};

function sortedDistances(values: RaceDistance[]): RaceDistance[] {
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return unique.sort((left, right) => {
    const leftIndex = distanceOrder.indexOf(left);
    const rightIndex = distanceOrder.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right, 'ko-KR');
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}

// 공식 링크가 있고 접수가 먼저 열리는 행을 대표 행으로 삼습니다.
function primaryEntry(entries: Race[]): Race {
  return [...entries].sort((left, right) => {
    const leftLink = left.officialUrl ? 0 : 1;
    const rightLink = right.officialUrl ? 0 : 1;
    if (leftLink !== rightLink) return leftLink - rightLink;
    const leftOpens = Date.parse(left.registrationOpensAt);
    const rightOpens = Date.parse(right.registrationOpensAt);
    if (Number.isFinite(leftOpens) && Number.isFinite(rightOpens) && leftOpens !== rightOpens) {
      return leftOpens - rightOpens;
    }
    return left.id.localeCompare(right.id);
  })[0] as Race;
}

export function groupRaces(values: Race[], now = Date.now()): RaceGroup[] {
  const buckets = new Map<string, Race[]>();
  const seenIds = new Set<string>();
  for (const race of values) {
    if (seenIds.has(race.id)) continue;
    seenIds.add(race.id);
    const key = raceGroupKey(race);
    buckets.set(key, [...(buckets.get(key) ?? []), race]);
  }

  const groups = [...buckets.entries()].map(([key, entries]) => {
    const primary = primaryEntry(entries);
    return {
      id: primary.id,
      key,
      raceIds: entries.map((entry) => entry.id),
      primary,
      entries,
      name: primary.name,
      region: primary.region,
      venue: primary.venue,
      raceDate: primary.raceDate,
      distances: sortedDistances(entries.flatMap((entry) => entry.distances)),
      status: registrationStatusLabel(primary, now),
      sourceNames: [...new Set(entries.map((entry) => entry.sourceName))],
    } satisfies RaceGroup;
  });

  return groups.sort((left, right) => {
    if (left.raceDate !== right.raceDate) return left.raceDate.localeCompare(right.raceDate);
    return left.name.localeCompare(right.name, 'ko-KR');
  });
}

// 목록 개수는 항상 대회 기준입니다. 같은 대회의 5K·10K는 1건입니다.
export function countRaces(values: Race[], now = Date.now()): number {
  return groupRaces(values, now).length;
}

export function findGroupByRaceId(
  groups: RaceGroup[],
  raceId?: string,
): RaceGroup | undefined {
  if (!raceId) return undefined;
  return groups.find((group) => group.raceIds.includes(raceId));
}

const kstDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });

export function daysUntilRace(raceDate: string, now = Date.now()): number {
  const today = kstDateFormatter.format(new Date(now));
  const target = Date.parse(`${raceDate}T00:00:00Z`);
  const base = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(target) || !Number.isFinite(base)) return 0;
  return Math.round((target - base) / 86_400_000);
}

export function formatDDay(raceDate: string, now = Date.now()): string {
  const days = daysUntilRace(raceDate, now);
  if (days === 0) return 'D-DAY';
  if (days < 0) return `D+${Math.abs(days)}`;
  return `D-${days}`;
}

export type RacePeriodFilter = '전체' | '이번 달' | '3개월' | '6개월';
export const racePeriodFilters: RacePeriodFilter[] = ['전체', '이번 달', '3개월', '6개월'];

function periodLimit(period: RacePeriodFilter, now: number): string | undefined {
  if (period === '전체') return undefined;
  const today = new Date(`${kstDateFormatter.format(new Date(now))}T00:00:00Z`);
  if (period === '이번 달') {
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
    return end.toISOString().slice(0, 10);
  }
  const months = period === '3개월' ? 3 : 6;
  const end = new Date(today);
  end.setUTCMonth(end.getUTCMonth() + months);
  return end.toISOString().slice(0, 10);
}

export type RaceGroupFilter = {
  region: RegionFilter;
  distance: DistanceFilter;
  registration: string;
  period: RacePeriodFilter;
  query: string;
};

export function filterRaceGroups(
  groups: RaceGroup[],
  filter: RaceGroupFilter,
  now = Date.now(),
): RaceGroup[] {
  const normalizedQuery = filter.query.trim().toLocaleLowerCase('ko-KR');
  const limit = periodLimit(filter.period, now);
  return groups.filter((group) => {
    if (filter.region !== '전체' && group.region !== filter.region) return false;
    if (filter.distance !== '전체' && !group.distances.includes(filter.distance)) return false;
    if (filter.registration !== '전체' && group.status !== filter.registration) return false;
    if (limit && group.raceDate > limit) return false;
    if (!normalizedQuery) return true;
    return `${group.name} ${group.region} ${group.venue} ${group.distances.join(' ')}`
      .toLocaleLowerCase('ko-KR')
      .includes(normalizedQuery);
  });
}
