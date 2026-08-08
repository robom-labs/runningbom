// 러닝봄 데이터 감시가 새 장애에서만 수집과 Pages 배포를 자동 재시도하는지 검증한다.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL("../.github/workflows/data-watchdog.yml", import.meta.url);

test("데이터 감시는 중복 실행을 막고 수집·배포를 한 번씩 복구한다", async () => {
  const source = await readFile(workflowUrl, "utf8");
  assert.match(source, /actions: write/);
  assert.match(source, /open_issue=.*\[자동 감시\] 러닝봄 운영 데이터 이상/);
  assert.match(source, /refresh_active=.*queued.*in_progress/);
  assert.match(source, /gh workflow run refresh-race-data\.yml --ref main/);
  assert.match(source, /deploy_active=.*queued.*in_progress/);
  assert.match(source, /gh workflow run pages\.yml --ref main/);
  assert.ok(source.indexOf("새 장애에서만 수집·배포 자동 복구 시도") < source.indexOf("장애 이슈를 한 번만 생성 또는 재개"));
});
