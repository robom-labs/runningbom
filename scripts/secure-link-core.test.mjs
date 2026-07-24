// HTTPS 링크 정리 규칙이 검증되지 않은 HTTP 주소를 재노출하지 않게 검사한다.
import assert from "node:assert/strict";
import test from "node:test";
import { applyHttpsAudit } from "./secure-link-core.mjs";

test("검증된 HTTPS 최종 주소만 기존 HTTP 주소를 교체한다", () => {
  const input = {
    featuredRaces: [{ name: "A", registrationUrl: "http://old.example/apply" }],
    scheduleFeed: [],
  };
  const { data, summary } = applyHttpsAudit(input, [{
    raw: "http://old.example/apply",
    usable: true,
    finalUrl: "https://new.example/apply",
  }]);
  assert.equal(data.featuredRaces[0].registrationUrl, "https://new.example/apply");
  assert.equal(summary.upgraded, 1);
});

test("TLS 확인에 실패한 HTTP 주소는 대회 데이터는 남기고 링크만 제거한다", () => {
  const input = {
    featuredRaces: [],
    scheduleFeed: [{ name: "B", date: "2026-08-01", registrationUrl: "http://legacy.example/apply", sourceDetailUrl: "https://safe.example/detail" }],
  };
  const { data, summary } = applyHttpsAudit(input, [{ raw: "http://legacy.example/apply", usable: false }]);
  assert.equal(data.scheduleFeed[0].registrationUrl, undefined);
  assert.equal(data.scheduleFeed[0].sourceDetailUrl, "https://safe.example/detail");
  assert.equal(summary.removed, 1);
});

test("이미 HTTPS인 주소와 감사 결과가 없는 일반 데이터는 변경하지 않는다", () => {
  const input = {
    featuredRaces: [{ name: "C", registrationUrl: "https://safe.example/apply" }],
    scheduleFeed: [],
  };
  const { data, summary } = applyHttpsAudit(input, []);
  assert.equal(data.featuredRaces[0].registrationUrl, "https://safe.example/apply");
  assert.equal(summary.upgraded, 0);
  assert.equal(summary.removed, 0);
});
