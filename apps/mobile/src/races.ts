// 번들 대회를 검증 가능한 필터와 한국 시간 표시 값으로 변환합니다.
import bundledData from './data/races.json';
import type { DistanceFilter, Race, RegionFilter } from './types';

const registrationFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

const raceDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});

export const bundledRevision = bundledData.revision;
const REMOTE_RACES_URL =
  process.env.EXPO_PUBLIC_RACE_DATA_URL ??
  'https://raw.githubusercontent.com/robom-labs/runningbom/main/apps/mobile/src/data/races.json';

// 포매터를 만드는 일은 아주 비쌉니다. 예전에는 대회 한 건마다 새로 만들어(183번) 앱을 켤 때
// 그만큼 시간을 썼습니다. 하나만 만들어 두고 계속 씁니다. 돌려주는 값은 그대로입니다.
const kstDayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });

function todayKst(now = Date.now()): string {
  return kstDayFormatter.format(new Date(now));
}

function calendarDaysBetween(target: number, now: number): number | null {
  if (!Number.isFinite(target) || !Number.isFinite(now)) return null;
  const targetDay = Date.parse(`${kstDayFormatter.format(new Date(target))}T00:00:00Z`);
  const today = Date.parse(`${kstDayFormatter.format(new Date(now))}T00:00:00Z`);
  if (!Number.isFinite(targetDay) || !Number.isFinite(today)) return null;
  return Math.round((targetDay - today) / 86_400_000);
}

function isRace(value: unknown): value is Race {
  if (!value || typeof value !== 'object') return false;
  const race = value as Partial<Race>;
  return (
    typeof race.id === 'string' &&
    typeof race.name === 'string' &&
    typeof race.region === 'string' &&
    typeof race.venue === 'string' &&
    typeof race.raceDate === 'string' &&
    Array.isArray(race.distances) &&
    typeof race.registrationOpensAt === 'string' &&
    typeof race.registrationTimeConfirmed === 'boolean' &&
    (race.registrationDataStatus === undefined || race.registrationDataStatus === 'needs-review') &&
    (race.registrationDataIssue === undefined || typeof race.registrationDataIssue === 'string') &&
    (race.sourceCheckedAt === undefined || (typeof race.sourceCheckedAt === 'string' && Number.isFinite(Date.parse(race.sourceCheckedAt)))) &&
    (race.externalUrl === undefined || (typeof race.externalUrl === 'string' && race.externalUrl.startsWith('https://'))) &&
    (race.officialUrl === undefined || (typeof race.officialUrl === 'string' && race.officialUrl.startsWith('https://'))) &&
    (race.externalLinkKind === undefined || ['registration', 'source', 'official'].includes(race.externalLinkKind)) &&
    typeof race.sourceName === 'string'
  );
}

/** 목록에서 감추는 접수 상태입니다. 매번 배열을 새로 만들지 않도록 한곳에 둡니다. */
const hiddenRegistrationStatuses = new Set(['cancelled', 'postponed', 'sold_out', 'closed']);

function isVisibleRace(race: Race, now = Date.now(), today = todayKst(now)): boolean {
  const status = race.registrationStatus ?? '';
  const closesAt = race.registrationClosesAt ? new Date(race.registrationClosesAt).getTime() : Number.NaN;
  return (
    race.raceDate >= today &&
    !hiddenRegistrationStatuses.has(status) &&
    (!Number.isFinite(closesAt) || closesAt >= now)
  );
}

function visibleRaces(values: Race[], now = Date.now()): Race[] {
  // '오늘'은 목록 전체에 대해 한 번만 구하면 됩니다(예전에는 대회 한 건마다 다시 구했습니다).
  const today = todayKst(now);
  const seen = new Set<string>();
  return values.filter((race) => {
    if (!isRace(race) || seen.has(race.id) || !isVisibleRace(race, now, today)) return false;
    seen.add(race.id);
    return true;
  });
}

export const races = visibleRaces(bundledData.races as Race[]);
export function regionsFor(values: Race[]): RegionFilter[] {
  return ['전체', ...new Set(values.map((race) => race.region))];
}
export const distances: DistanceFilter[] = ['전체', '5K', '10K', 'Half', 'Full', 'Trail'];

export function filterRaces(region: RegionFilter, distance: DistanceFilter, values = races): Race[] {
  return values.filter((race) => {
    const regionMatches = region === '전체' || race.region === region;
    const distanceMatches = distance === '전체' || race.distances.includes(distance);
    return regionMatches && distanceMatches;
  });
}

export type RaceFeed = {
  revision: string;
  races: Race[];
};

export function raceFeedFromRecords(
  revision: unknown,
  values: unknown,
  now = Date.now(),
): RaceFeed {
  if (typeof revision !== 'string' || !revision || !Array.isArray(values)) {
    throw new Error('race feed schema invalid');
  }
  const next = visibleRaces(values.filter(isRace), now);
  if (next.length === 0) throw new Error('race feed has no active races');
  return { revision, races: next };
}

export type RegistrationFilter = '전체' | '접수 예정' | '접수 중';
export const registrationFilters: RegistrationFilter[] = ['전체', '접수 예정', '접수 중'];

export function filterByRegistrationStatus(
  statusFilter: RegistrationFilter,
  values: Race[],
  now = Date.now(),
): Race[] {
  if (statusFilter === '전체') return values;
  return values.filter((race) => registrationStatusLabel(race, now) === statusFilter);
}

export function shouldReplaceRaceFeed(current: RaceFeed, next: RaceFeed): boolean {
  return current.revision !== next.revision;
}

// 운영 Pages의 검증된 JSON을 읽되 실패하면 번들 데이터를 그대로 사용합니다.
export async function fetchLatestRaces(signal?: AbortSignal): Promise<RaceFeed> {
  const response = await fetch(REMOTE_RACES_URL, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`race feed HTTP ${response.status}`);
  const payload = (await response.json()) as { revision?: unknown; races?: unknown };
  return raceFeedFromRecords(payload.revision, payload.races);
}

export function formatRegistrationTime(race: Race): string {
  if (race.registrationDataStatus === 'needs-review') {
    return '공식 접수 기간 재확인 중';
  }
  if (race.registrationPeriodLabel) {
    return race.registrationPeriodLabel;
  }
  if (!race.registrationTimeConfirmed) {
    return `${race.registrationOpensAt.slice(0, 10)} · 시작 시각 확인 전`;
  }

  return registrationFormatter.format(new Date(race.registrationOpensAt));
}

export function registrationStatusLabel(race: Race, now = Date.now()): string {
  if (race.registrationDataStatus === 'needs-review') return '확인 필요';
  const status = race.registrationStatus;
  const closesAt = race.registrationClosesAt ? new Date(race.registrationClosesAt).getTime() : Number.NaN;
  const opensAt = new Date(race.registrationOpensAt).getTime();
  if (status === 'cancelled') return '취소';
  if (status === 'sold_out') return '매진';
  if (status === 'closed' || (Number.isFinite(closesAt) && closesAt < now)) return '접수 마감';
  if (Number.isFinite(opensAt) && opensAt <= now) return '접수 중';
  return '접수 예정';
}

/** 확인된 접수 시작·마감 시각을 KST 달력 날짜 기준 D-day 문구로 바꿉니다. */
export function registrationCountdownLabel(race: Race, now = Date.now()): string {
  const status = registrationStatusLabel(race, now);
  if (status === '확인 필요') return '접수 일정 확인 필요';
  if (status === '취소' || status === '매진' || status === '접수 마감') return status;
  if (status === '접수 중') {
    const closesAt = Date.parse(race.registrationClosesAt ?? '');
    const days = calendarDaysBetween(closesAt, now);
    if (days == null) return '접수 중 · 마감일 확인 필요';
    return days === 0 ? '오늘 접수 마감' : `접수 마감 D-${days}`;
  }
  const opensAt = Date.parse(race.registrationOpensAt);
  const days = calendarDaysBetween(opensAt, now);
  if (days == null) return '접수 예정';
  return days === 0 ? '오늘 접수 시작' : `접수 시작 D-${days}`;
}

/** 현재 접수 중이며 공식 마감일이 지정 일수 안에 오는 대회만 고릅니다. */
export function isRegistrationClosingSoon(
  race: Race,
  now = Date.now(),
  withinDays = 7,
): boolean {
  if (registrationStatusLabel(race, now) !== '접수 중') return false;
  const closesAt = Date.parse(race.registrationClosesAt ?? '');
  const days = calendarDaysBetween(closesAt, now);
  return days != null && days >= 0 && days <= withinDays;
}

export function canScheduleRegistrationAlert(race: Race, now = Date.now()): boolean {
  if (race.registrationDataStatus === 'needs-review') return false;
  const status = registrationStatusLabel(race, now);
  return status === '접수 예정' && race.registrationTimeConfirmed;
}

export function formatRaceDate(race: Race): string {
  return raceDateFormatter.format(new Date(`${race.raceDate}T00:00:00+09:00`));
}

export function raceIdFromDeepLink(url: string): string | null {
  const match = url.match(/(?:^|\/)race\/([^/?#]+)/i);
  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}
