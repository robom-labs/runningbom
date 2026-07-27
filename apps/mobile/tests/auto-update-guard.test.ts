// 새 내용을 "언제 적용해도 되는지"를 지킵니다.
// 적용은 앱을 다시 시작하는 일이라, 달리는 도중에 하면 그날 기록이 통째로 사라집니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, it } from 'node:test';

import {
  isRunInProgress,
  resetRunInProgress,
  setRunInProgress,
  subscribeRunInProgress,
} from '../services/updates/runInProgress';

const updaterSource = readFileSync(
  fileURLToPath(new URL('../services/updates/AutoUpdater.tsx', import.meta.url)),
  'utf8',
);
const startScreenSource = readFileSync(
  fileURLToPath(new URL('../app/screens/start/StartScreen.tsx', import.meta.url)),
  'utf8',
);
const appSource = readFileSync(fileURLToPath(new URL('../App.tsx', import.meta.url)), 'utf8');

describe('달리는 중 표시등', () => {
  beforeEach(() => resetRunInProgress());

  it('처음에는 꺼져 있다', () => {
    assert.equal(isRunInProgress(), false);
  });

  it('켜고 끄면 그대로 따라간다', () => {
    setRunInProgress(true);
    assert.equal(isRunInProgress(), true);
    setRunInProgress(false);
    assert.equal(isRunInProgress(), false);
  });

  it('값이 바뀔 때만 알려 준다', () => {
    const seen: boolean[] = [];
    subscribeRunInProgress((next) => seen.push(next));

    setRunInProgress(true);
    setRunInProgress(true); // 같은 값이라 알리지 않아야 합니다.
    setRunInProgress(false);

    assert.deepEqual(seen, [true, false]);
  });

  it('등록을 풀면 더 이상 알리지 않는다', () => {
    const seen: boolean[] = [];
    const stop = subscribeRunInProgress((next) => seen.push(next));
    stop();

    setRunInProgress(true);

    assert.deepEqual(seen, []);
  });
});

describe('자동 업데이트', () => {
  it('달리는 중이면 적용하지 않는다', () => {
    // 이 한 줄이 빠지면 달리다가 기록이 날아갑니다.
    assert.ok(
      /if \(isRunInProgress\(\)\) return;/.test(updaterSource),
      'AutoUpdater가 달리는 중인지 확인하지 않습니다.',
    );
  });

  it('적용(reloadAsync)은 안전 확인을 거친 곳에서만 부른다', () => {
    const applyLines = updaterSource
      .split('\n')
      .filter((line) => line.includes('reloadAsync') && !line.trimStart().startsWith('//'));

    assert.equal(applyLines.length, 1, `reloadAsync 호출이 ${applyLines.length}곳입니다(1곳이어야 함).`);
  });

  it('러닝 화면이 달리는 중임을 알려 준다', () => {
    // 화면이 알려 주지 않으면 표시등은 영원히 꺼진 채로 남습니다.
    assert.ok(startScreenSource.includes('setRunInProgress(active)'));
  });

  it('앱에 실제로 붙어 있다', () => {
    assert.ok(appSource.includes('<AutoUpdater />'));
  });

  it('누르라고 요구하지 않는다(스스로 적용)', () => {
    // 예전에는 "지금 적용" 버튼을 눌러야 했습니다. 이제 누를 것이 없어야 합니다.
    assert.ok(!updaterSource.includes('Pressable'), '아직 눌러야 하는 버튼이 남아 있습니다.');
  });
});
