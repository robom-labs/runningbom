// 네이티브 데이터 갱신과 접수 알림 수명주기의 재발을 막는다.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const raceStateSource = await readFile(
  new URL("../apps/mobile/app/state/RaceStateProvider.tsx", import.meta.url),
  "utf8",
);
const raceScreenSource = await readFile(
  new URL("../apps/mobile/domains/races/RaceScreen.tsx", import.meta.url),
  "utf8",
);
const pagesWorkflowSource = await readFile(
  new URL("../.github/workflows/pages.yml", import.meta.url),
  "utf8",
);
const refreshWorkflowSource = await readFile(
  new URL("../.github/workflows/refresh-race-data.yml", import.meta.url),
  "utf8",
);

test("앱 시작 데이터 갱신은 AbortController와 한 번의 effect로 제한한다", () => {
  assert.match(raceStateSource, /const controller = new AbortController\(\);/);
  assert.match(raceStateSource, /void loadLatest\(controller\.signal\);/);
  assert.match(raceStateSource, /return \(\) => controller\.abort\(\);/);
  assert.match(raceStateSource, /const loadLatest = useCallback\(async \(signal\?: AbortSignal\)/);
  assert.match(raceStateSource, /loadRunningbomStaticData/);
  assert.match(raceStateSource, /raceFeedFromRecords/);
  assert.match(raceStateSource, /shouldReplaceRaceFeed\(current, latest\) \? latest : current/);
});

test("접수 상태 검색과 예약 알림 취소 흐름을 제공한다", () => {
  assert.match(raceScreenSource, /registrationFilter/);
  assert.match(raceScreenSource, /const \[query, setQuery\]/);
  // 변수 이름이 아니라 "같은 대회를 켜고 끈다"는 규칙을 검사합니다.
  // 카드가 여러 종목을 묶게 되면서 race -> primary로 이름만 바뀌었는데,
  // 기능은 멀쩡한데 이 검사만 깨져서 CI 전체가 막혀 있었습니다.
  assert.match(raceScreenSource, /scheduled \? cancelAlert\((\w+)\) : scheduleAlert\(\1\)/);
  assert.match(raceStateSource, /cancelRegistrationNotification/);
  assert.match(raceStateSource, /reconcileRegistrationNotifications/);
});

test("검증된 sidecar를 Pages에 배포하고 자동 갱신 commit에 포함한다", () => {
  assert.match(pagesWorkflowSource, /cp -a data\/\. \.pages-release\/data\//);
  assert.match(refreshWorkflowSource, /apps\/mobile\/data\/fallback/);
  assert.match(refreshWorkflowSource, /git add[\s\S]*data/);
});
