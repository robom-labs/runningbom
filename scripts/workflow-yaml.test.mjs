// 워크플로 파일이 **실제로 읽히는지** 확인합니다.
//
// 왜 이게 필요한가:
//   YAML이 깨지면 GitHub은 job을 하나도 만들지 않고 실패합니다.
//   로그가 비어 있어서 원인을 찾는 데 시간이 걸립니다. 실제로 그랬습니다 —
//   `run: |` 블록 안에 여러 줄 커밋 메시지를 들여쓰기 없이 넣어서 블록이 끊겼습니다.
//
//   push하기 전에 여기서 걸리면 그 왕복이 사라집니다.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const workflowDir = fileURLToPath(new URL('../.github/workflows', import.meta.url));

/**
 * 아주 작은 YAML 확인입니다. 라이브러리를 새로 넣지 않습니다.
 *
 * 블록 스칼라(`|`, `>`) 안의 줄은 블록보다 더 들여써야 합니다.
 * 덜 들여쓰면 블록이 거기서 끝나고, 그 줄은 새 키로 읽히다가 깨집니다.
 */
function blockScalarProblems(text) {
  const lines = text.split('\n');
  const problems = [];
  let blockIndent;
  let blockStart = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (blockIndent === undefined) {
      const opener = line.match(/^(\s*)[\w".-]+:\s*[|>][+-]?\s*$/);
      if (opener) {
        blockIndent = opener[1].length;
        blockStart = index + 1;
      }
      continue;
    }

    if (line.trim() === '') continue;
    // 주석은 블록 밖에서도 안에서도 나올 수 있습니다. 여기서 끝나는 것은 정상입니다.
    if (/^\s*#/.test(line)) {
      const commentIndent = line.match(/^(\s*)/)?.[1].length ?? 0;
      if (commentIndent <= blockIndent) blockIndent = undefined;
      continue;
    }
    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent > blockIndent) continue;

    // 블록이 끝났습니다. 끝난 자리가 제대로 된 키인지 봅니다.
    const looksLikeKey = /^\s*(-\s+)?[\w".-]+\s*:/.test(line) || /^\s*-\s/.test(line);
    if (!looksLikeKey) {
      problems.push(
        `${blockStart + 1}행에서 시작한 블록이 ${index + 1}행에서 끊깁니다: "${line.slice(0, 40)}"`,
      );
    }
    blockIndent = undefined;
    index -= 1;
  }

  return problems;
}

test('워크플로 YAML의 블록이 중간에 끊기지 않는다', () => {
  const files = readdirSync(workflowDir).filter((name) => /\.ya?ml$/.test(name));
  assert.ok(files.length > 0, '워크플로 파일이 없습니다');

  const failures = [];
  for (const name of files) {
    const text = readFileSync(join(workflowDir, name), 'utf8');
    for (const problem of blockScalarProblems(text)) failures.push(`${name}: ${problem}`);
  }

  assert.deepEqual(failures, []);
});

test('워크플로에 on과 jobs가 있다', () => {
  const files = readdirSync(workflowDir).filter((name) => /\.ya?ml$/.test(name));
  for (const name of files) {
    const text = readFileSync(join(workflowDir, name), 'utf8');
    assert.ok(/^on:/m.test(text), `${name}에 on:이 없습니다`);
    assert.ok(/^jobs:/m.test(text), `${name}에 jobs:가 없습니다`);
  }
});
