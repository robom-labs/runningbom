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
