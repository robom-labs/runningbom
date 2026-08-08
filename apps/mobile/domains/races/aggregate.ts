// 같은 대회가 종목(거리)별로 여러 행으로 들어와도 대회 1건으로 집계합니다.
import { isRegistrationClosingSoon, registrationStatusLabel } from '../../src/races';
import type { DistanceFilter, Race, RaceDistance, RegionFilter } from '../../src/types';

const distanceOrder: RaceDistance[] = ['5K', '10K', 'Half', 'Full', 'Trail'];

// 이름을 다듬는 정규식들입니다. 매번 새로 만들지 않도록 한곳에 둡니다.
const bracketPattern = /[([{][^)\]}]*[)\]}]/g;
const roundPattern = /제\s*(\d+)\s*회/g;
const distanceWordPattern = /\d+(?:\.\d+)?\s*(?:k|km|킬로미터|킬로)(?![a-z가-힣])/g;
const eventWordPattern = /하프코스|하프마라톤|하프|풀코스|풀마라톤|단축마라톤|건강달리기/g;
const nonWordPattern = /[^0-9a-z가-힣]+/g;

/**
 * 대회 이름은 목록을 다시 묶을 때마다 똑같이 다시 다듬게 됩니다(183건 × 정규식 4번).
 * 이름이 같으면 결과도 같으므로 기억해 두고 다시 씁니다.
 */
const normalizedNameCache = new Map<string, string>();
const NORMALIZED_NAME_CACHE_LIMIT = 5_000;

// 대회명에서 종목(거리) 표기를 걷어내 같은 대회의 다른 종목 행을 식별합니다.
export function normalizeRaceName(name: string): string {
  const cached = normalizedNameCache.get(name);
  if (cached !== undefined) return cached;
  const stripped = name
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(bracketPattern, ' ')
    .replace(roundPattern, '제$1회')
    .replace(distanceWordPattern, ' ')
    .replace(eventWordPattern, ' ')
    .replace(nonWordPattern, ' ')
    .trim();
  const result = stripped || name.normalize('NFKC').trim().toLocaleLowerCase('ko-KR');
  if (normalizedNameCache.size >= NORMALIZED_NAME_CACHE_LIMIT) normalizedNameCache.clear();
  normalizedNameCache.set(name, result);
  return result;
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
  registrationTarget: Race;
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

const registrationStatusPriority = [
  '접수 중',
  '접수 예정',
  '확인 필요',
  '접수 마감',
  '매진',
  '취소',
] as const;

// 종목별 접수 상태가 다르면 지금 행동할 수 있는 종목을 대표 접수 대상으로 고릅니다.
export function registrationTargetEntry(entries: Race[], now = Date.now()): Race {
  const sorted = [...entries].sort((left, right) => {
    const leftStatus = registrationStatusLabel(left, now);
    const rightStatus = registrationStatusLabel(right, now);
    const leftPriority = registrationStatusPriority.indexOf(leftStatus as typeof registrationStatusPriority[number]);
    const rightPriority = registrationStatusPriority.indexOf(rightStatus as typeof registrationStatusPriority[number]);
    const statusDiff = (leftPriority < 0 ? registrationStatusPriority.length : leftPriority)
      - (rightPriority < 0 ? registrationStatusPriority.length : rightPriority);
    if (statusDiff !== 0) return statusDiff;
    if (leftStatus === '접수 예정' && left.registrationTimeConfirmed !== right.registrationTimeConfirmed) {
      return left.registrationTimeConfirmed ? -1 : 1;
    }
    const linkDiff = Number(!left.officialUrl) - Number(!right.officialUrl);
    if (linkDiff !== 0) return linkDiff;
    const leftOpens = Date.parse(left.registrationOpensAt);
    const rightOpens = Date.parse(right.registrationOpensAt);
    if (Number.isFinite(leftOpens) && Number.isFinite(rightOpens) && leftOpens !== rightOpens) {
      return leftOpens - rightOpens;
    }
    return left.id.localeCompare(right.id);
  });
  return sorted[0] as Race;
}

export function groupRaces(values: Race[], now = Date.now()): RaceGroup[] {
  const buckets = new Map<string, Race[]>();
  const seenIds = new Set<string>();
  for (const race of values) {
    if (seenIds.has(race.id)) continue;
    seenIds.add(race.id);
    const key = raceGroupKey(race);
    // 예전에는 같은 묶음에 한 건 넣을 때마다 배열을 통째로 새로 만들었습니다(같은 대회가
    // 여러 종목이면 제곱으로 늘어나는 일). 이제 있는 배열에 그대로 덧붙입니다. 순서는 그대로입니다.
    const bucket = buckets.get(key);
    if (bucket) bucket.push(race);
    else buckets.set(key, [race]);
  }

  const groups = [...buckets.entries()].map(([key, entries]) => {
    const primary = primaryEntry(entries);
    const registrationTarget = registrationTargetEntry(entries, now);
    return {
      id: primary.id,
      key,
      raceIds: entries.map((entry) => entry.id),
      primary,
      registrationTarget,
      entries,
      name: primary.name,
      region: primary.region,
      venue: primary.venue,
      raceDate: primary.raceDate,
      distances: sortedDistances(entries.flatMap((entry) => entry.distances)),
      status: registrationStatusLabel(registrationTarget, now),
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

export function isRaceGroupInterested(
  group: RaceGroup,
  groupKeys: readonly string[],
  legacyRaceIds: readonly string[],
): boolean {
  return groupKeys.includes(group.key)
    || group.raceIds.some((raceId) => legacyRaceIds.includes(raceId));
}

/** 0.19.1 이하의 대표 종목 ID를 데이터 갱신에도 안정적인 대회 묶음 키로 옮깁니다. */
export function migrateRaceInterests(
  groups: readonly RaceGroup[],
  legacyRaceIds: readonly string[],
  groupKeys: readonly string[],
): { groupKeys: string[]; legacyRaceIds: string[] } {
  const nextGroupKeys = new Set(groupKeys.filter(Boolean));
  const unresolvedRaceIds: string[] = [];
  for (const raceId of new Set(legacyRaceIds.filter(Boolean))) {
    const group = groups.find((candidate) => candidate.raceIds.includes(raceId));
    if (group) nextGroupKeys.add(group.key);
    else unresolvedRaceIds.push(raceId);
  }
  return { groupKeys: [...nextGroupKeys], legacyRaceIds: unresolvedRaceIds };
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

/**
 * 검색용 문자열은 묶음마다 늘 같은 값이라, 글자를 칠 때마다 183건을 다시 이어 붙이고 소문자로
 * 바꿀 이유가 없습니다. 묶음 하나당 한 번만 만들어 두고 다시 씁니다(만드는 규칙은 그대로).
 */
const raceSearchTextCache = new WeakMap<RaceGroup, string>();

function raceSearchText(group: RaceGroup): string {
  const cached = raceSearchTextCache.get(group);
  if (cached !== undefined) return cached;
  const text = `${group.name} ${group.region} ${group.venue} ${group.distances.join(' ')}`.toLocaleLowerCase(
    'ko-KR',
  );
  raceSearchTextCache.set(group, text);
  return text;
}

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
    return raceSearchText(group).includes(normalizedQuery);
  });
}

// ── 빠른 칩 · 정렬 · 달력 뷰 ──────────────────────────────────────────────
// 대회 수가 많아도 원하는 것을 빨리 찾도록 돕는 순수 규칙입니다.

export type RaceQuickFilter = '접수 중만' | '마감 임박' | '이번 주말' | '내 지역' | '관심만';
export const raceQuickFilters: RaceQuickFilter[] = ['접수 중만', '마감 임박', '이번 주말', '내 지역', '관심만'];

/** 이번 주 토·일의 날짜 키입니다. 토요일이 지났으면 그 주의 일요일까지만 남습니다. */
export function weekendRange(now = Date.now()): { start: string; end: string } {
  const today = kstDateFormatter.format(new Date(now));
  const date = new Date(`${today}T00:00:00Z`);
  const weekday = date.getUTCDay(); // 0=일 … 6=토
  const daysUntilSaturday = weekday === 0 ? 6 : 6 - weekday;
  const saturday = new Date(date);
  saturday.setUTCDate(saturday.getUTCDate() + daysUntilSaturday);
  const sunday = new Date(saturday);
  sunday.setUTCDate(sunday.getUTCDate() + 1);
  return { start: saturday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

export function applyQuickFilters(
  groups: RaceGroup[],
  active: RaceQuickFilter[],
  options: {
    myRegion?: string;
    interestedGroupKeys?: readonly string[];
    legacyInterestedRaceIds?: readonly string[];
  } = {},
  now = Date.now(),
): RaceGroup[] {
  if (active.length === 0) return groups;
  const weekend = weekendRange(now);
  const myRegion = options.myRegion?.trim();
  return groups.filter((group) => {
    if (active.includes('접수 중만') && group.status !== '접수 중') return false;
    if (active.includes('마감 임박') && !isRegistrationClosingSoon(group.registrationTarget, now)) {
      return false;
    }
    if (active.includes('이번 주말')) {
      if (group.raceDate < weekend.start || group.raceDate > weekend.end) return false;
    }
    if (active.includes('내 지역')) {
      if (!myRegion || group.region !== myRegion) return false;
    }
    if (active.includes('관심만') && !isRaceGroupInterested(
      group,
      options.interestedGroupKeys ?? [],
      options.legacyInterestedRaceIds ?? [],
    )) return false;
    return true;
  });
}

const revisionPattern = /^(\d{4})\.(\d{2})\.(\d{2})-race-data-(\d+)$/u;
const verifiedAtFormatter = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Seoul',
});

export function formatRaceFeedRevision(revision: string): string {
  const match = revisionPattern.exec(revision.trim());
  if (!match) return `데이터 버전 ${revision}`;
  return `대회 자료 ${Number(match[2])}월 ${Number(match[3])}일판 · 데이터 ${Number(match[4])}`;
}

export function formatRaceVerification(value?: string): string {
  const text = value?.trim();
  if (!text) return '검증 시각 없음';
  const parsed = Date.parse(text);
  if (/^\d{4}-\d{2}-\d{2}T/u.test(text) && Number.isFinite(parsed)) {
    return `확인 ${verifiedAtFormatter.format(new Date(parsed))}`;
  }
  if (/마라톤온라인/u.test(text)) return '검증 근거 마라톤온라인 공개 일정';
  if (/마라톤GO/u.test(text)) return '검증 근거 마라톤GO 공개 일정';
  return `검증 근거 ${text}`;
}

export type RaceSort = '가까운 날짜순' | '거리순' | '지역순';
export const raceSorts: RaceSort[] = ['가까운 날짜순', '거리순', '지역순'];

/** 짧은 종목이 먼저 오도록 대표 거리 순번을 구합니다. */
function shortestDistanceRank(group: RaceGroup): number {
  const ranks = group.distances.map((value) => {
    const index = distanceOrder.indexOf(value);
    return index === -1 ? distanceOrder.length : index;
  });
  return ranks.length > 0 ? Math.min(...ranks) : distanceOrder.length;
}

export function sortRaceGroups(groups: RaceGroup[], sort: RaceSort): RaceGroup[] {
  const byDateThenName = (left: RaceGroup, right: RaceGroup) => {
    if (left.raceDate !== right.raceDate) return left.raceDate.localeCompare(right.raceDate);
    return left.name.localeCompare(right.name, 'ko-KR');
  };
  const values = [...groups];
  if (sort === '거리순') {
    return values.sort((left, right) => {
      const diff = shortestDistanceRank(left) - shortestDistanceRank(right);
      return diff !== 0 ? diff : byDateThenName(left, right);
    });
  }
  if (sort === '지역순') {
    return values.sort((left, right) => {
      const diff = left.region.localeCompare(right.region, 'ko-KR');
      return diff !== 0 ? diff : byDateThenName(left, right);
    });
  }
  return values.sort(byDateThenName);
}

export type RaceMonthBucket = {
  /** 'YYYY-MM' 형식입니다. */
  month: string;
  label: string;
  count: number;
  groups: RaceGroup[];
};

const monthPattern = /^\d{4}-\d{2}$/;

/** 달력 뷰용으로 대회를 월별로 묶습니다. 대회가 없는 달은 만들지 않습니다. */
export function raceMonthBuckets(groups: RaceGroup[]): RaceMonthBucket[] {
  const buckets = new Map<string, RaceGroup[]>();
  for (const group of groups) {
    const month = group.raceDate.slice(0, 7);
    if (!monthPattern.test(month)) continue;
    const bucket = buckets.get(month);
    if (bucket) bucket.push(group);
    else buckets.set(month, [group]);
  }
  return [...buckets.entries()]
    .map(([month, values]) => ({
      month,
      label: `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`,
      count: values.length,
      groups: sortRaceGroups(values, '가까운 날짜순'),
    }))
    .sort((left, right) => left.month.localeCompare(right.month));
}

/** 특정 달의 날짜별 대회 수입니다. 달력 격자 표시에 씁니다. */
export function raceCountsByDay(groups: RaceGroup[], month: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const group of groups) {
    if (!group.raceDate.startsWith(month)) continue;
    counts[group.raceDate] = (counts[group.raceDate] ?? 0) + 1;
  }
  return counts;
}

export type RaceCalendarCell = {
  key: string;
  day: number;
  inMonth: boolean;
  today: boolean;
  groupCount: number;
};

export type RaceCalendarMonth = {
  month: string;
  label: string;
  cells: RaceCalendarCell[];
};

const pad = (value: number) => String(value).padStart(2, '0');

/** 한 대회를 거리별 행이 아닌 대회 묶음 1건으로 세는 7열 월간 달력 모델입니다. */
export function buildRaceCalendarMonth(
  groups: RaceGroup[],
  month: string,
  now = Date.now(),
): RaceCalendarMonth | null {
  if (!monthPattern.test(month)) return null;
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const today = kstDateFormatter.format(new Date(now));
  const counts = raceCountsByDay(groups, month);
  const cells: RaceCalendarCell[] = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ key: '', day: 0, inMonth: false, today: false, groupCount: 0 });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${month}-${pad(day)}`;
    cells.push({
      key,
      day,
      inMonth: true,
      today: key === today,
      groupCount: counts[key] ?? 0,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: '', day: 0, inMonth: false, today: false, groupCount: 0 });
  }

  return {
    month,
    label: `${year}년 ${monthNumber}월`,
    cells,
  };
}

export function raceGroupsForDate(groups: RaceGroup[], dateKey: string): RaceGroup[] {
  return sortRaceGroups(
    groups.filter((group) => group.raceDate === dateKey),
    '가까운 날짜순',
  );
}
