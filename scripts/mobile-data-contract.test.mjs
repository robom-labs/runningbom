// 웹 정본에서 네이티브 번들로 옮길 때 접수 상태와 검증 메타데이터가 사라지지 않는지 검증한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeRace } from './sync-mobile-races.mjs';
import { collapseRaceRows, mergeMarathonGoDiscoveries } from './race-data-core.mjs';

const web = JSON.parse(readFileSync(new URL("../outputs/pushrun-site/races.json", import.meta.url), "utf8"));
const mobile = JSON.parse(readFileSync(new URL("../apps/mobile/src/data/races.json", import.meta.url), "utf8"));
const webRows = collapseRaceRows([
  ...web.featuredRaces.map(race => ({ ...race, __syncPrefix: 'featured' })),
  ...web.scheduleFeed.map(race => ({ ...race, __syncPrefix: 'schedule' })),
]);

function assertRegistrationContract(source, target) {
  assert.ok(target, `웹 정본 대회가 모바일 번들에도 있어야 합니다: ${source.id ?? source.name}`);
  const checks = [source.lastObservedAt, source.dataVerifiedAt]
    .filter(value => typeof value === 'string' && Number.isFinite(Date.parse(value)));
  const sourceCheckedAt = checks.reduce((latest, value) =>
    !latest || Date.parse(value) > Date.parse(latest) ? value : latest, undefined);
  const registrationUrl = source.registrationUrl?.startsWith('https://') ? source.registrationUrl : undefined;
  const sourceDetailUrl = source.sourceDetailUrl?.startsWith('https://') ? source.sourceDetailUrl : undefined;
  assert.equal(target.registrationStatus, source.status ?? 'unknown');
  assert.equal(target.registrationOpensAt, source.registrationOpenAt);
  assert.equal(target.registrationClosesAt, source.registrationCloseAt ?? undefined);
  assert.equal(target.registrationTimeConfirmed, source.registrationOpenTimeConfirmed === true);
  const expectedWindows = source.registrationWindows?.filter(window => window?.opensAt).map((window) =>
    Object.fromEntries(
      Object.entries({
        label: window.label,
        distance: window.distance,
        opensAt: window.opensAt,
        closesAt: window.closesAt ?? undefined,
        timeConfirmed: window.timeConfirmed === true,
      }).filter(([, value]) => value !== undefined),
    ),
  );
  assert.deepEqual(target.registrationWindows, expectedWindows);
  assert.equal(target.verifiedAt, source.registrationTimeVerifiedAt ?? source.linkVerifiedFrom ?? undefined);
  assert.equal(target.sourceCheckedAt, sourceCheckedAt);
  assert.equal(
    target.registrationDataStatus,
    source.registrationDataStatus ?? (sourceCheckedAt ? undefined : "needs-review"),
  );
  assert.equal(target.registrationUrl, registrationUrl);
  assert.equal(target.sourceDetailUrl, sourceDetailUrl);
  assert.equal(target.linkReference, source.linkVerifiedFrom ?? undefined);
  assert.equal(target.externalUrl, registrationUrl ?? sourceDetailUrl);
  assert.equal(target.officialUrl, target.externalUrl, "구버전 원격 피드 호환 별칭을 유지합니다.");
  assert.equal(target.externalLinkKind, target.externalUrl ? (registrationUrl ? 'registration' : 'source') : undefined);
}

// A real multi-window event can expire out of the public feed. Keep that contract
// covered independently of today's catalogue, then verify every current row too.
const registrationFixture = {
  id: 'registration-contract-fixture', name: '종목별 접수 회귀 대회', region: '서울', venue: '공원',
  date: '2026-12-20', distances: ['5K', '10K'], status: 'scheduled',
  registrationOpenAt: '2026-11-01T09:00:00+09:00', registrationCloseAt: '2026-11-30T18:00:00+09:00',
  registrationOpenTimeConfirmed: true,
  registrationWindows: [
    { label: '5K', distance: '5K', opensAt: '2026-11-01T09:00:00+09:00', closesAt: '2026-11-20T18:00:00+09:00', timeConfirmed: true },
    { label: '10K', distance: '10K', opensAt: '2026-11-02T00:00:00+09:00', timeConfirmed: false },
  ],
  dataVerifiedAt: '2026-10-24T00:00:00Z', lastObservedAt: '2026-10-26T00:00:00Z',
  registrationTimeVerifiedAt: '2026-10-23T00:00:00Z', linkVerifiedFrom: '공식 접수 페이지',
  registrationUrl: 'https://fixture.example/register', sourceDetailUrl: 'https://fixture.example/details',
};
const persistedRace = source => JSON.parse(JSON.stringify(normalizeRace(source, 'schedule')));

test("모바일 번들은 웹 정본의 접수 상태·마감·종목 창·검증 시각을 보존한다", () => {
  const source = structuredClone(registrationFixture);
  const target = persistedRace(source);
  assertRegistrationContract(source, target);
  assert.equal(target.registrationWindows.length, 2);
  assert.equal(target.sourceCheckedAt, source.lastObservedAt);
  assert.equal(target.verifiedAt, source.registrationTimeVerifiedAt);
});

test('마지막 관측·검증 시각은 유효한 최신 값을 고르고 없으면 확인 필요를 유지한다', () => {
  for (const [lastObservedAt, dataVerifiedAt, expected] of [
    ['2026-10-26T00:00:00Z', '2026-10-24T00:00:00Z', '2026-10-26T00:00:00Z'],
    ['2026-10-24T00:00:00Z', '2026-10-26T00:00:00Z', '2026-10-26T00:00:00Z'],
    ['invalid', '2026-10-24T00:00:00Z', '2026-10-24T00:00:00Z'],
    ['2026-10-24T00:00:00Z', undefined, '2026-10-24T00:00:00Z'],
    [undefined, 'invalid', undefined],
  ]) {
    const source = { ...registrationFixture, lastObservedAt, dataVerifiedAt };
    const target = persistedRace(source);
    assertRegistrationContract(source, target);
    assert.equal(target.sourceCheckedAt, expected);
    assert.equal(target.registrationDataStatus, expected ? undefined : 'needs-review');
  }
});

test('종목별 접수창이 없는 대회와 보안상 차단된 링크도 계약을 지킨다', () => {
  const source = { ...registrationFixture, registrationWindows: undefined, registrationUrl: 'http://fixture.example/register' };
  const target = persistedRace(source);
  assertRegistrationContract(source, target);
  assert.equal(target.registrationWindows, undefined);
  assert.equal(target.registrationUrl, undefined);
  assert.equal(target.externalUrl, source.sourceDetailUrl);
  assert.equal(target.externalLinkKind, 'source');
});

test('유일한 종목별 접수 대회가 종료되어도 남은 일정의 계약 검증은 계속된다', () => {
  const expired = { ...registrationFixture, id: 'expired-window-race', date: '2026-10-25', time: '09:00' };
  const current = { ...registrationFixture, id: 'current-no-window-race', name: '남은 대회', time: '09:00', registrationWindows: undefined };
  const { data } = mergeMarathonGoDiscoveries({ featuredRaces: [], scheduleFeed: [expired, current] }, [], {
    now: Date.parse('2026-10-26T00:00:00+09:00'), checkedAt: '2026-10-25T15:00:00Z',
  });
  assert.equal(data.scheduleFeed.length, 1);
  assert.equal(data.scheduleFeed[0].id, current.id);
  assert.equal(data.scheduleFeed[0].registrationWindows, undefined);
  assertRegistrationContract(data.scheduleFeed[0], persistedRace(data.scheduleFeed[0]));
});

test('현재 정본 전체는 종목별 접수창 유무와 관계없이 모바일 번들에 보존된다', () => {
  const rows = webRows.filter(race => race.name && race.region && race.venue
    && (race.raceDate ?? race.date) && race.registrationOpenAt);
  assert.ok(rows.length > 0, '현재 정본이 비어서는 안 됩니다.');
  assert.equal(mobile.races.length, rows.length, '누락 또는 중복 모바일 대회가 없어야 합니다.');
  const matched = new Set();
  for (const source of rows) {
    const targets = mobile.races.filter(race => race.name === source.name && race.region === source.region
      && race.venue === source.venue && race.raceDate === String(source.raceDate ?? source.date).slice(0, 10));
    assert.equal(targets.length, 1, `웹 대회와 모바일 대회가 일대일이어야 합니다: ${source.name}`);
    assertRegistrationContract(source, targets[0]);
    if (source.id) assert.equal(targets[0].id, source.id);
    assert.ok(!matched.has(targets[0].id), '서로 다른 대회가 같은 모바일 ID를 사용하면 안 됩니다.');
    matched.add(targets[0].id);
  }
});

test("접수 페이지와 대회 정보 출처가 함께 있으면 둘 다 보존한다", () => {
  const source = structuredClone(registrationFixture);
  const target = persistedRace(source);
  assert.equal(target.registrationUrl, source.registrationUrl);
  assert.equal(target.sourceDetailUrl, source.sourceDetailUrl);
  assert.equal(target.externalUrl, source.registrationUrl, "기존 버전 호환용 기본 링크는 접수 페이지를 우선합니다.");
});

test("마지막 데이터 확인 시각이 없는 원본 행은 삭제하지 않고 확인 필요로 격리한다", () => {
  // Successful collection can eliminate this defect from the current live feed.
  // Keep the regression's quarantine expectations, not a requirement to publish bad rows.
  const source = {id:'missing-check-fixture',name:'확인 시각 없는 원본',region:'서울',venue:'공원',date:'2026-12-20',registrationOpenAt:'2026-11-01T09:00:00+09:00',status:'open',distances:['10K'],sourceName:'회귀 테스트'};
  const target = normalizeRace(source,'schedule');
  assert.equal(target.id,source.id,'원본 행을 보존합니다.');
  assert.equal(target.sourceCheckedAt, undefined);
  assert.equal(target.registrationDataStatus, "needs-review");
  assert.match(target.registrationDataIssue ?? "", /마지막 데이터 확인 시각/);
});
