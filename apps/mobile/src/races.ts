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

const defaultRemoteRacesUrl =
  'https://raw.githubusercontent.com/robom-labs/runningbom/main/apps/mobile/src/data/races.json';

function isPrivateIpv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b !== undefined && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPublicHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !normalized ||
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    isPrivateIpv4(normalized)
  ) {
    return false;
  }
  return normalized.includes('.');
}

/** 외부에서 받은 주소를 열기 전에 적용하는 최소 공통 안전 규칙입니다. */
export function safeHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim();
  if (!raw || raw.length > 2_048 || /[\u0000-\u001f\u007f]/u.test(raw)) return undefined;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !isPublicHostname(url.hostname)
    ) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

/**
 * 앱이 읽을 수 있는 원격 대회 피드 위치를 로봄이 관리하는 두 공개 경로로 제한합니다.
 * 잘못된 환경변수나 탈취된 빌드 설정은 마지막 검증 기본값으로 되돌립니다.
 */
export function resolveRaceFeedUrl(value?: string): string {
  const safe = safeHttpsUrl(value);
  if (!safe) return defaultRemoteRacesUrl;
  const url = new URL(safe);
  const trusted =
    (url.hostname === 'raw.githubusercontent.com' &&
      url.pathname.startsWith('/robom-labs/runningbom/')) ||
    (url.hostname === 'robom-labs.github.io' && url.pathname.startsWith('/runningbom/'));
  return trusted ? url.toString() : defaultRemoteRacesUrl;
}

const REMOTE_RACES_URL = resolveRaceFeedUrl(process.env.EXPO_PUBLIC_RACE_DATA_URL);

// 포매터를 만드는 일은 아주 비쌉니다. 예전에는 대회 한 건마다 새로 만들어 앱을 켤 때
// 그만큼 시간을 썼습니다. 하나만 만들어 두고 계속 씁니다. 돌려주는 값은 그대로입니다.
const kstDayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });

function todayKst(now = Date.now()): string {
  return kstDayFormatter.format(new Date(now));
}

type BundledRaceReference = { id?: unknown; officialUrl?: unknown };
const bundledRaceReferences = (bundledData.races as BundledRaceReference[]).filter(
  (race) => typeof race.id === 'string',
);
const bundledOfficialUrlByRaceId = new Map<string, string>();
const bundledOfficialHosts = new Set<string>();
for (const race of bundledRaceReferences) {
  const safe = safeHttpsUrl(race.officialUrl);
  if (typeof race.id !== 'string' || !safe) continue;
  bundledOfficialUrlByRaceId.set(race.id, safe);
  bundledOfficialHosts.add(new URL(safe).hostname.toLowerCase());
}

/**
 * 원격 피드가 임의 피싱 도메인을 앱의 "공식 페이지"로 바꾸지 못하게 합니다.
 * 기존 대회는 번들에 검증된 동일 도메인만, 새 대회는 이미 검증된 운영 도메인만 허용합니다.
 */
export function isTrustedRaceOfficialUrl(raceId: string, value: unknown): boolean {
  if (value === undefined) return true;
  const safe = safeHttpsUrl(value);
  if (!safe) return false;
  const hostname = new URL(safe).hostname.toLowerCase();
  const expected = bundledOfficialUrlByRaceId.get(raceId);
  if (expected) return new URL(expected).hostname.toLowerCase() === hostname;
  return bundledOfficialHosts.has(hostname);
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
    isTrustedRaceOfficialUrl(race.id, race.officialUrl) &&
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

// 운영 저장소의 검증된 JSON을 읽되 실패하면 번들 데이터를 그대로 사용합니다.
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
  if (race.registrationPeriodLabel) {
    return race.registrationPeriodLabel;
  }
  if (!race.registrationTimeConfirmed) {
    return `${race.registrationOpensAt.slice(0, 10)} · 시작 시각 확인 전`;
  }

  return registrationFormatter.format(new Date(race.registrationOpensAt));
}

export function registrationStatusLabel(race: Race, now = Date.now()): string {
  const status = race.registrationStatus;
  const closesAt = race.registrationClosesAt ? new Date(race.registrationClosesAt).getTime() : Number.NaN;
  const opensAt = new Date(race.registrationOpensAt).getTime();
  if (status === 'cancelled') return '취소';
  if (status === 'sold_out') return '매진';
  if (status === 'closed' || (Number.isFinite(closesAt) && closesAt < now)) return '접수 마감';
  if (Number.isFinite(opensAt) && opensAt <= now) return '접수 중';
  return '접수 예정';
}

export function canScheduleRegistrationAlert(race: Race, now = Date.now()): boolean {
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
