// 대회 자동 갱신 감시기가 오래됨·중복·급감·파싱 실패를 차단하는지 검증한다.
import assert from "node:assert/strict";
import test from "node:test";
import { assessRaceDataset, assessRaceRefreshHealth } from "./race-health-core.mjs";

const NOW = Date.parse("2026-08-08T12:00:00.000Z");

function race(index, overrides = {}) {
  return {
    name: `제${index}회 봄빛 마라톤`,
    date: "2026-09-20",
    region: "서울",
    venue: `한강공원 ${index}`,
    distances: ["10K"],
    registrationOpenAt: "2026-08-20T10:00:00+09:00",
    registrationCloseAt: "2026-09-10T18:00:00+09:00",
    registrationOpenTimeConfirmed: true,
    sourceName: "마라톤GO",
    sourceDetailUrl: `https://example.com/races/${index}`,
    ...overrides,
  };
}

function dataset(count = 20, overrides = {}) {
  return {
    version: "2026.08.08-race-data-35",
    lastSuccessfulRefreshAt: "2026-08-08T10:00:00.000Z",
    featuredRaces: [],
    scheduleFeed: Array.from({ length: count }, (_, index) => race(index + 1)),
    ...overrides,
  };
}

test("정상 정본은 한 대회 한 행과 최신성을 함께 통과한다", () => {
  const result = assessRaceDataset({ data: dataset(), now: NOW });
  assert.equal(result.ok, true);
  assert.equal(result.metrics.total, 20);
  assert.equal(result.metrics.uniqueEvents, 20);
  assert.equal(result.metrics.upcomingRegistrations, 20);
});

test("거리별 중복 행·오래된 수집·HTTP 링크를 동시에 탐지한다", () => {
  const first = race(1, { name: "봄빛 마라톤 5K", distances: ["5K"] });
  const second = race(2, {
    name: "봄빛 마라톤 10K",
    venue: first.venue,
    distances: ["10K"],
    sourceDetailUrl: "http://example.com/insecure",
  });
  const result = assessRaceDataset({
    data: dataset(20, {
      lastSuccessfulRefreshAt: "2026-08-06T00:00:00.000Z",
      scheduleFeed: [first, second, ...Array.from({ length: 18 }, (_, index) => race(index + 10))],
    }),
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("거리별 여러 행")));
  assert.ok(result.errors.some((error) => error.includes("성공하지")));
  assert.ok(result.errors.some((error) => error.includes("HTTPS")));
});

test("수집 파싱 성공률이 70% 아래면 기존 정상본을 지키도록 실패한다", () => {
  const result = assessRaceRefreshHealth({
    previousData: dataset(40),
    nextData: dataset(40),
    catalogueCount: 100,
    parsedCount: 60,
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("70%")));
});

test("갱신 결과가 이전 미래 대회의 60% 아래로 급감하면 배포하지 않는다", () => {
  const result = assessRaceRefreshHealth({
    previousData: dataset(50),
    nextData: dataset(20),
    catalogueCount: 100,
    parsedCount: 90,
    now: NOW,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("60% 미만")));
});

test("400일 뒤에도 과거 대회 정본을 최신 자료로 오인하지 않는다", () => {
  const result = assessRaceDataset({
    data: dataset(),
    now: Date.parse("2027-09-12T12:00:00.000Z"),
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("지난 대회")));
  assert.ok(result.errors.some((error) => error.includes("성공하지")));
});

test("400일 시간 이동 후 새 연도 대회 정본은 정상 통과한다", () => {
  const future = dataset(20, {
    version: "2027.09.12-race-data-36",
    lastSuccessfulRefreshAt: "2027-09-12T10:00:00.000Z",
    scheduleFeed: Array.from({ length: 20 }, (_, index) => race(index + 1, {
      date: "2027-10-20",
      registrationOpenAt: "2027-09-15T10:00:00+09:00",
      registrationCloseAt: "2027-10-10T18:00:00+09:00",
    })),
  });
  const result = assessRaceDataset({
    data: future,
    now: Date.parse("2027-09-12T12:00:00.000Z"),
  });
  assert.equal(result.ok, true);
  assert.equal(result.metrics.uniqueEvents, 20);
  assert.equal(result.metrics.upcomingRegistrations, 20);
});
