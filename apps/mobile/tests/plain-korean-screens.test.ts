// 회장이 직접 지적한 낱말("스트릭", "RPE")이 화면 어디에도 다시 나타나지 않게 지킵니다.
// 홈 화면에는 이미 걸러 내는 장치가 있었지만, 다른 화면에는 없어서 그대로 보이고 있었습니다.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const screensDir = fileURLToPath(new URL('../app/screens', import.meta.url));

/** 회장이 "모른다"고 콕 집어 말한 낱말입니다. */
const bannedWords = ['스트릭', 'RPE'] as const;

/**
 * 화면에 보이지 않는 자리라 그대로 두는 곳입니다.
 * - knowledge.ts: 검색어 목록입니다. 사용자가 그 말로 검색할 수 있어야 하니 남깁니다.
 * - home/model.ts: 이런 낱말을 걸러 내는 장치 자체라, 여기에는 낱말이 적혀 있어야 합니다.
 */
const allowedFiles = new Set(['guide/knowledge.ts', 'home/model.ts']);

function collect(dir: string, prefix = ''): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    if (statSync(full).isDirectory()) {
      found.push(...collect(full, relative));
    } else if (/\.tsx?$/.test(name)) {
      found.push(relative);
    }
  }
  return found;
}

/**
 * 설명용 주석은 검사에서 뺍니다. 주석은 사용자에게 보이지 않습니다.
 * 줄 번호를 그대로 알려 줘야 하므로, 줄을 지우지 않고 내용만 비웁니다.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('화면에 쓰는 말', () => {
  for (const word of bannedWords) {
    it(`'${word}'를 화면 문구로 쓰지 않는다`, () => {
      const offenders: string[] = [];

      for (const relative of collect(screensDir)) {
        if (allowedFiles.has(relative)) continue;
        const source = withoutComments(readFileSync(join(screensDir, relative), 'utf8'));
        source.split('\n').forEach((line, index) => {
          if (line.includes(word)) offenders.push(`app/screens/${relative}:${index + 1}`);
        });
      }

      assert.deepEqual(
        offenders,
        [],
        `쉬운 말로 바꿔 주세요. '${word}'가 남아 있는 곳:\n${offenders.join('\n')}`,
      );
    });
  }
});
