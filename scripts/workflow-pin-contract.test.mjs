// GitHub Actions 외부 의존성이 변경 가능한 태그가 아닌 커밋 SHA로 고정됐는지 검사한다.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const workflowsDir = path.resolve(".github/workflows");
const shaRef = /^[0-9a-f]{40}$/;

test("모든 외부 GitHub Action은 40자리 커밋 SHA로 고정한다", async () => {
  const files = (await readdir(workflowsDir)).filter((file) => /\.ya?ml$/.test(file));
  const violations = [];

  for (const file of files) {
    const source = await readFile(path.join(workflowsDir, file), "utf8");
    for (const [index, line] of source.split("\n").entries()) {
      const match = line.match(/\buses:\s*([^@\s]+)@([^\s#]+)/);
      if (!match || match[1].startsWith("./")) {
        continue;
      }
      if (!shaRef.test(match[2])) {
        violations.push(`${file}:${index + 1} ${match[1]}@${match[2]}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

// TypeScript 정본을 읽는 스크립트는 apps/mobile/node_modules/tsx 로더에 기댄다.
// 설치 단계 없이 그 스크립트를 돌리면 워크플로가 통째로 실패한다.
// 실제로 대회 일정 자동 갱신이 이 한 줄이 빠진 채 6시간마다 계속 실패하고 있었다.
const NEEDS_MOBILE_MODULES = [
  "apps/mobile/node_modules/tsx",
  "npm run mobile:sync",
  "npm run static-data:generate",
  "npm run static-data:check",
  // 위 두 스크립트를 안에서 부르는 상위 명령이다.
  "npm test",
  "npm run build",
];
const INSTALL_STEP = "npm --prefix apps/mobile ci";

test("TypeScript 정본을 읽는 워크플로는 모바일 의존성을 먼저 설치한다", async () => {
  const files = (await readdir(workflowsDir)).filter((file) => /\.ya?ml$/.test(file));
  const violations = [];

  for (const file of files) {
    const source = await readFile(path.join(workflowsDir, file), "utf8");
    // 직접 실행하든 AI에게 시키든, 그 명령이 도는 곳은 같은 러너다.
    const needle = NEEDS_MOBILE_MODULES.find((token) => source.includes(token));
    if (!needle) continue;
    if (source.includes(INSTALL_STEP)) continue;
    violations.push(`${file}: "${needle}"를 쓰면서 "${INSTALL_STEP}"가 없습니다`);
  }

  assert.deepEqual(violations, []);
});
