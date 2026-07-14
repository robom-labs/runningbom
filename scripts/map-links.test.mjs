// 카드 상세 "출발 장소" 네이버지도 순수 함수 검증.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const core = require(join(dirname(fileURLToPath(import.meta.url)), "..", "outputs", "pushrun-site", "race-calendar-core.js"));
const { compactMapText, raceLocationSearchCandidates, naverMapSearchUrl, raceMapLink } = core;

test("compactMapText: 공백을 하나로 접고 양끝을 자른다", () => {
  assert.equal(compactMapText("  강원   평창  기념관 "), "강원 평창 기념관");
  assert.equal(compactMapText(null), "");
  assert.equal(compactMapText(undefined), "");
});

test("raceLocationSearchCandidates: 지역·도시·장소 우선, 중복 제거", () => {
  const race = { region: "강원", city: "평창", venue: "평창동계올림픽기념공원", name: "GO대관령 트레일런" };
  const candidates = raceLocationSearchCandidates(race);
  assert.equal(candidates[0], "강원 평창 평창동계올림픽기념공원");
  assert.equal(candidates[1], "GO대관령 트레일런 평창동계올림픽기념공원");
  assert.equal(candidates[2], "GO대관령 트레일런 출발 장소");
  assert.equal(new Set(candidates).size, candidates.length);
});

test("raceLocationSearchCandidates: startVenue가 venue보다 우선", () => {
  const race = { region: "서울", city: "여의도", venue: "구주소", startVenue: "여의도 한강공원 물빛광장" };
  const candidates = raceLocationSearchCandidates(race);
  assert.equal(candidates[0], "서울 여의도 여의도 한강공원 물빛광장");
});

test("raceLocationSearchCandidates: 장소가 없어도 이름 기반 후보는 생성", () => {
  const candidates = raceLocationSearchCandidates({ name: "춘천마라톤", region: "강원" });
  assert.ok(candidates.includes("강원"));
  assert.ok(candidates.includes("춘천마라톤"));
  assert.ok(candidates.includes("춘천마라톤 출발 장소"));
});

test("naverMapSearchUrl: https 스킴과 URL 인코딩", () => {
  const url = naverMapSearchUrl("강원 평창 기념관");
  assert.ok(url.startsWith("https://map.naver.com/p/search/"));
  assert.equal(url, "https://map.naver.com/p/search/" + encodeURIComponent("강원 평창 기념관"));
  assert.ok(!url.includes(" "));
});

test("raceMapLink: venue 있으면 첫 후보로 링크, 없으면 null", () => {
  const link = raceMapLink({ region: "인천", city: "강화", venue: "강화함상공원" });
  assert.equal(link, naverMapSearchUrl("인천 강화 강화함상공원"));
  assert.equal(raceMapLink({ region: "서울", name: "이름만 있는 대회" }), null);
  assert.equal(raceMapLink({}), null);
});
