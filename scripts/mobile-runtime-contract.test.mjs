// 네이티브 데이터 갱신과 접수 알림 수명주기의 재발을 막는다.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../apps/mobile/App.tsx", import.meta.url), "utf8");

test("앱 시작 데이터 갱신은 AbortController와 한 번의 effect로 제한한다", () => {
  assert.match(appSource, /const controller = new AbortController\(\);/);
  assert.match(appSource, /fetchLatestRaces\(controller\.signal\)/);
  assert.match(appSource, /return \(\) => controller\.abort\(\);\n  }, \[\]\);/);
  assert.match(appSource, /shouldReplaceRaceFeed\(current, latest\) \? latest : current/);
});

test("접수 상태 검색과 예약 알림 취소 흐름을 제공한다", () => {
  assert.match(appSource, /registrationFilter/);
  assert.match(appSource, /const \[query, setQuery\]/);
  assert.match(appSource, /cancelRegistrationNotification/);
  assert.match(appSource, /reconcileRegistrationNotifications/);
});
