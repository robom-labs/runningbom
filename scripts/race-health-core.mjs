// 러닝 대회 정본의 최신성·한 대회 한 행·날짜·출처 무결성을 독립적으로 판정한다.
import { raceIdentity, registrationPeriodNeedsReview } from "./race-data-core.mjs";

const DEFAULT_MAX_AGE_MS = 36 * 60 * 60 * 1000;
const MINIMUM_RACES = 20;

function kstDate(value) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(value));
}

export function raceRows(data) {
  return [
    ...(Array.isArray(data?.featuredRaces) ? data.featuredRaces : []),
    ...(Array.isArray(data?.scheduleFeed) ? data.scheduleFeed : []),
  ];
}

function validDateKey(value) {
  const text = String(value ?? "").slice(0, 10);
  return /^20\d{2}-\d{2}-\d{2}$/u.test(text)
    && !Number.isNaN(Date.parse(`${text}T00:00:00+09:00`))
    ? text
    : null;
}

function secureUrl(value) {
  if (value === undefined || value === null || value === "") return true;
  try {
    return new URL(String(value)).protocol === "https:";
  } catch {
    return false;
  }
}

export function assessRaceDataset({
  data,
  now = Date.now(),
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  minimumRaces = MINIMUM_RACES,
} = {}) {
  const errors = [];
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    errors.push("대회 데이터가 객체가 아닙니다.");
  }
  if (!Array.isArray(data?.featuredRaces)) errors.push("featuredRaces가 배열이 아닙니다.");
  if (!Array.isArray(data?.scheduleFeed)) errors.push("scheduleFeed가 배열이 아닙니다.");

  const rows = raceRows(data);
  if (rows.length < minimumRaces) {
    errors.push(`게시 대회가 ${rows.length}건으로 최소 ${minimumRaces}건보다 적습니다.`);
  }
  if (!/^20\d{2}\.\d{2}\.\d{2}-race-data-\d+$/u.test(String(data?.version ?? ""))) {
    errors.push("대회 데이터 version 형식이 올바르지 않습니다.");
  }

  const refreshedMs = Date.parse(data?.lastSuccessfulRefreshAt ?? "");
  if (!Number.isFinite(refreshedMs)) {
    errors.push("마지막 자동 수집 성공 시각이 없습니다.");
  } else {
    const age = now - refreshedMs;
    if (age < -5 * 60 * 1000) errors.push("마지막 자동 수집 성공 시각이 현재보다 5분 이상 미래입니다.");
    if (age > maxAgeMs) errors.push(`대회 자동 수집이 ${Math.round(age / 3_600_000)}시간 동안 성공하지 않았습니다.`);
  }

  const today = kstDate(now);
  const identities = new Map();
  let upcomingRegistrations = 0;
  let needsReview = 0;
  for (const [index, race] of rows.entries()) {
    const label = String(race?.name ?? "").trim() || `${index + 1}번째 대회`;
    if (!race || typeof race !== "object" || Array.isArray(race)) {
      errors.push(`${label} 데이터가 객체가 아닙니다.`);
      continue;
    }
    if (!String(race.name ?? "").trim()) errors.push(`${index + 1}번째 대회명이 없습니다.`);
    if (!String(race.region ?? "").trim()) errors.push(`${label} 지역이 없습니다.`);
    if (!String(race.venue ?? "").trim()) errors.push(`${label} 장소가 없습니다.`);
    if (!Array.isArray(race.distances) || race.distances.length === 0) errors.push(`${label} 거리 종목이 없습니다.`);

    const raceDate = validDateKey(race.raceDate ?? race.date);
    if (!raceDate) errors.push(`${label} 대회일 형식이 올바르지 않습니다.`);
    else if (raceDate < today) errors.push(`${label} 지난 대회가 운영 피드에 남아 있습니다.`);

    const identity = raceIdentity(race);
    if (identities.has(identity)) {
      errors.push(`한 대회가 거리별 여러 행으로 중복됐습니다: ${label}`);
    } else {
      identities.set(identity, label);
    }

    const opens = Date.parse(race.registrationOpenAt ?? "");
    const closes = Date.parse(race.registrationCloseAt ?? "");
    if (Number.isFinite(opens) && Number.isFinite(closes) && opens > closes) {
      errors.push(`${label} 접수 시작 시각이 마감 시각보다 늦습니다.`);
    }
    if (registrationPeriodNeedsReview(race)) {
      if (race.registrationDataStatus !== "needs-review") {
        errors.push(`${label} 대회일 이후 접수 기간이 검토 상태로 격리되지 않았습니다.`);
      } else {
        needsReview += 1;
      }
    }
    if (Number.isFinite(opens) && opens > now) upcomingRegistrations += 1;

    for (const field of ["registrationUrl", "sourceDetailUrl", "officialUrl"]) {
      if (!secureUrl(race[field])) errors.push(`${label} ${field}가 HTTPS 주소가 아닙니다.`);
    }
    if (!String(race.sourceName ?? "").trim()) errors.push(`${label} 출처 이름이 없습니다.`);
  }

  return {
    ok: errors.length === 0,
    errors,
    metrics: {
      version: data?.version ?? null,
      total: rows.length,
      uniqueEvents: identities.size,
      featured: Array.isArray(data?.featuredRaces) ? data.featuredRaces.length : 0,
      schedule: Array.isArray(data?.scheduleFeed) ? data.scheduleFeed.length : 0,
      upcomingRegistrations,
      needsReview,
      lastSuccessfulRefreshAt: data?.lastSuccessfulRefreshAt ?? null,
    },
  };
}

export function assessRaceRefreshHealth({
  previousData,
  nextData,
  catalogueCount,
  parsedCount,
  now = Date.now(),
} = {}) {
  const dataset = assessRaceDataset({ data: nextData, now });
  const errors = [...dataset.errors];
  const catalogue = Number(catalogueCount);
  const parsed = Number(parsedCount);
  const parseRatio = catalogue > 0 ? parsed / catalogue : 0;
  if (!Number.isFinite(catalogue) || catalogue < MINIMUM_RACES) {
    errors.push(`공개 일정 카탈로그가 ${catalogueCount ?? "미확인"}건으로 비정상적으로 적습니다.`);
  }
  if (!Number.isFinite(parsed) || parsed < MINIMUM_RACES || parseRatio < 0.7) {
    errors.push(`공개 일정 해석 성공률이 ${Math.round(parseRatio * 100)}%(${parsed}/${catalogue})로 기준 70%보다 낮습니다.`);
  }

  const today = kstDate(now);
  const previousFuture = raceRows(previousData).filter((race) => {
    const date = validDateKey(race?.raceDate ?? race?.date);
    return date && date >= today;
  }).length;
  const minimumRetained = Math.max(MINIMUM_RACES, Math.ceil(previousFuture * 0.6));
  if (dataset.metrics.total < minimumRetained) {
    errors.push(`갱신 뒤 대회가 ${dataset.metrics.total}건으로 이전 미래 대회 ${previousFuture}건의 60% 미만입니다.`);
  }

  return {
    ok: errors.length === 0,
    errors,
    metrics: {
      ...dataset.metrics,
      catalogueCount: catalogue,
      parsedCount: parsed,
      parseRatio,
      previousFuture,
      minimumRetained,
    },
  };
}
