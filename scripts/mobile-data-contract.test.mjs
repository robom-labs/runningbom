// 웹 정본에서 네이티브 번들로 옮길 때 접수 상태와 검증 메타데이터가 사라지지 않는지 검증한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeRace } from './sync-mobile-races.mjs';

const web = JSON.parse(readFileSync(new URL("../outputs/pushrun-site/races.json", import.meta.url), "utf8"));
const mobile = JSON.parse(readFileSync(new URL("../apps/mobile/src/data/races.json", import.meta.url), "utf8"));
const webRows = [...web.featuredRaces, ...web.scheduleFeed];

test("모바일 번들은 웹 정본의 접수 상태·마감·종목 창·검증 시각을 보존한다", () => {
  const source = webRows.find((race) => race.registrationWindows?.length && race.registrationCloseAt && race.status);
  assert.ok(source, "계약 검증용 웹 대회가 필요합니다.");
  const sourceRaceDate = String(source.raceDate ?? source.date).slice(0, 10);
  const target = mobile.races.find(
    (race) =>
      race.name === source.name &&
      race.region === source.region &&
      race.venue === source.venue &&
      race.raceDate === sourceRaceDate,
  );
  assert.ok(target, "웹 정본 대회가 모바일 번들에도 있어야 합니다.");
  const sourceCheckedAt = source.dataVerifiedAt ?? undefined;
  assert.equal(target.registrationStatus, source.status);
  assert.equal(target.registrationClosesAt, source.registrationCloseAt);
  const expectedWindows = source.registrationWindows.map((window) =>
    Object.fromEntries(
      Object.entries({
        label: window.label,
        distance: window.distance,
        opensAt: window.opensAt,
        closesAt: window.closesAt,
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
  assert.equal(target.registrationUrl, source.registrationUrl ?? undefined);
  assert.equal(target.sourceDetailUrl, source.sourceDetailUrl ?? undefined);
  assert.equal(target.linkReference, source.linkVerifiedFrom ?? undefined);
  assert.equal(target.externalUrl, source.registrationUrl ?? source.sourceDetailUrl ?? undefined);
  assert.equal(target.officialUrl, target.externalUrl, "구버전 원격 피드 호환 별칭을 유지합니다.");
  assert.equal(target.externalLinkKind, source.registrationUrl ? "registration" : "source");
});

test("접수 페이지와 대회 정보 출처가 함께 있으면 둘 다 보존한다", () => {
  const source = webRows.find((race) =>
    typeof race.registrationUrl === "string"
    && typeof race.sourceDetailUrl === "string"
    && race.registrationUrl !== race.sourceDetailUrl,
  );
  assert.ok(source, "서로 다른 접수·출처 주소를 가진 웹 대회가 필요합니다.");
  const target = mobile.races.find((race) => race.id === source.id);
  assert.ok(target, "웹 정본 대회가 모바일 번들에도 있어야 합니다.");
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
