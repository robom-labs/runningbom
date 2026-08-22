// 접수 링크가 없는 대회에 비활성 이동 버튼을 만들지 않는 PWA 계약을 검사한다.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../outputs/pushrun-site/app.js", import.meta.url), "utf8");

test("접수 링크가 없으면 버튼 대신 안내문을 렌더링한다", () => {
  assert.match(app, /class="registration-note" role="note"/);
  assert.match(app, /class="race-action-note" role="note"/);
  assert.doesNotMatch(app, /aria-disabled="true">정보 확인 중<\/button>/);
});
