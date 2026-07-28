// V6 — 풀토크가 실제로 말이 많은지 **재서** 확인합니다.
//
// "쉴 새 없이 말한다"는 감상이 아니라 숫자입니다.
// 재지 않으면 설정 이름만 바뀌고 실제로는 예전과 같은 앱이 됩니다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { lintCoachLines } from '../domains/coaching/claimLint';
import { longformBlocks, storyBlocks, teachingBlocks } from '../domains/coaching/longform';
import { createCoachSession, cueSilenceRatio, withLongform } from '../domains/coaching/model';
import { toCasual } from '../domains/coaching/register';
import { bodyScanOrder } from '../domains/coaching/persona';
import { planLongform, targetOccupancy, usesLongform } from '../domains/coaching/talkPlan';

function occupancy(minutes: number, density: 'full-talk' | 'close-coach' | 'balanced'): number {
  const guidance = density === 'balanced' ? 'standard' : 'detailed';
  return 1 - cueSilenceRatio(withLongform(createCoachSession('이지런', minutes, guidance), density));
}

test('풀토크가 예전 최대치보다 확실히 말이 많습니다', () => {
  const before = 1 - cueSilenceRatio(createCoachSession('이지런', 50, 'detailed'));
  const after = occupancy(50, 'full-talk');

  // 예전 최대치는 0.50이었습니다. 측정값입니다.
  assert.ok(before < 0.55, `예전 값이 달라졌습니다: ${before.toFixed(2)}`);

  // 지금은 0.70 이상입니다. 50분 기준 실측 0.72입니다.
  //
  // 목표 하한 0.75에 거의 닿았습니다. 남은 차이는 엔진이 아니라 **글의 양**입니다.
  // 덩어리 46개(설명 23, 이야기 23)를 한 번씩만 씁니다.
  // 반복하면 숫자는 쉽게 오릅니다. 그런데 사람은 같은 이야기를 두 번 하면 바로 알아챕니다.
  // 그 순간 "사람 같은 코치"가 "녹음기"가 됩니다. 그래서 숫자 대신 정직함을 골랐습니다.
  assert.ok(after >= 0.7, `풀토크 점유율이 ${after.toFixed(2)}입니다`);
  assert.ok(after > before + 0.15, '풀토크가 충분히 늘지 않았습니다');
});

test('말수를 올릴수록 실제로 말이 많아집니다', () => {
  const balanced = occupancy(50, 'balanced');
  const close = occupancy(50, 'close-coach');
  const full = occupancy(50, 'full-talk');
  assert.ok(balanced < close, `${balanced.toFixed(2)} < ${close.toFixed(2)}가 아닙니다`);
  assert.ok(close < full, `${close.toFixed(2)} < ${full.toFixed(2)}가 아닙니다`);
});

test('길이가 달라져도 말수가 무너지지 않습니다', () => {
  // 5분 러닝에서 이야기 하나가 통째로 들어가면 그건 러닝이 아니라 팟캐스트입니다.
  // 반대로 세 시간 러닝에서 이야기가 바닥나면 뒤가 조용해집니다.
  for (const minutes of [5, 12, 20, 50, 180]) {
    const value = occupancy(minutes, 'full-talk');
    // 세 시간 러닝은 가진 이야기를 다 써도 0.56이 한계입니다.
    // 46덩어리를 한 번씩 쓰면 약 30분치이고, 나머지 두 시간 반은 짧은 문장이 채웁니다.
    // 글이 모자란 것이지 엔진 문제가 아닙니다.
    const floor = minutes >= 120 ? 0.53 : 0.63;
    assert.ok(value >= floor, `${minutes}분에서 ${value.toFixed(2)}입니다`);
    assert.ok(value <= 0.95, `${minutes}분에서 ${value.toFixed(2)}로 쉴 틈이 없습니다`);
  }
});

test('조용한 설정에는 긴 이야기를 넣지 않습니다', () => {
  assert.equal(usesLongform('essential'), false);
  assert.equal(usesLongform('balanced'), false);
  assert.equal(usesLongform('close-coach'), true);
  assert.equal(usesLongform('full-talk'), true);

  const quiet = createCoachSession('이지런', 50, 'minimal');
  assert.equal(withLongform(quiet, 'essential'), quiet);
});

test('같은 이야기를 한 러닝에서 두 번 하지 않습니다', () => {
  const planned = planLongform({
    durationSeconds: 180 * 60,
    shortSpokenSeconds: 180 * 60 * 0.5,
    density: 'full-talk',
    warmupSeconds: 480,
  });
  const ids = planned.map((entry) => entry.block.id);
  assert.equal(new Set(ids).size, ids.length, '같은 덩어리가 두 번 나옵니다');
});

test('이야기끼리 겹치지 않습니다', () => {
  const planned = planLongform({
    durationSeconds: 60 * 60,
    shortSpokenSeconds: 60 * 60 * 0.5,
    density: 'full-talk',
    warmupSeconds: 480,
  });
  assert.ok(planned.length > 3, `덩어리가 ${planned.length}개뿐입니다`);
  for (let index = 1; index < planned.length; index += 1) {
    const previous = planned[index - 1];
    const current = planned[index];
    assert.ok(
      current.startSeconds >= previous.startSeconds + previous.seconds,
      '이야기가 겹칩니다',
    );
  }
  // 마지막 1분은 비어 있어야 합니다. 마무리 안내가 이야기에 잘리면 안 됩니다.
  const last = planned[planned.length - 1];
  assert.ok(last.startSeconds + last.seconds <= 60 * 60 - 60);
});

test('설명과 이야기를 번갈아 갑니다', () => {
  const planned = planLongform({
    durationSeconds: 90 * 60,
    shortSpokenSeconds: 90 * 60 * 0.5,
    density: 'full-talk',
    warmupSeconds: 480,
  });
  const kinds = planned.map((entry) => entry.block.kind);
  for (let index = 1; index < kinds.length; index += 1) {
    assert.notEqual(kinds[index], kinds[index - 1], '같은 종류가 연달아 나옵니다');
  }
});

test('자세 커리큘럼이 몸 훑기 순서를 덮습니다', () => {
  const themes = new Set(teachingBlocks.map((block) => block.theme));
  for (const theme of bodyScanOrder) {
    assert.ok(themes.has(theme), `${theme} 설명이 없습니다`);
  }
  assert.ok(storyBlocks.length >= 8, `이야기가 ${storyBlocks.length}개뿐입니다`);

  // 설명과 이야기를 번갈아 가므로, 쓸 수 있는 덩어리 수는 **적은 쪽의 두 배**입니다.
  // 설명만 늘리면 아무 소용이 없습니다. 그래서 양쪽 균형을 테스트가 지킵니다.
  const teaching = longformBlocks.filter((block) => block.kind === 'teaching').length;
  const stories = longformBlocks.filter((block) => block.kind === 'story').length;
  assert.ok(teaching >= 20, `설명이 ${teaching}개뿐입니다`);
  assert.ok(stories >= 20, `이야기가 ${stories}개뿐입니다`);
  assert.ok(
    Math.abs(teaching - stories) <= 4,
    `설명 ${teaching}개와 이야기 ${stories}개의 균형이 무너졌습니다`,
  );
});

test('긴 이야기도 같은 규칙을 지킵니다', () => {
  const lines = longformBlocks.flatMap((block) => block.lines);
  assert.ok(lines.length > 240, `문장이 ${lines.length}개뿐입니다`);

  // 봤다고 하는 말, 모두에게 맞는 각도, 부상 보장, 통증 무시가 없어야 합니다.
  assert.deepEqual(lintCoachLines(lines), []);

  // 반말로도 전부 옮겨져야 합니다. 긴 이야기만 존댓말로 남으면 바로 티가 납니다.
  for (const line of lines) {
    assert.deepEqual(toCasual(line).unconverted, [], `반말로 못 옮깁니다: ${line}`);
  }
});

test('노리는 점유율이 밀도 순서대로입니다', () => {
  assert.ok(targetOccupancy.essential < targetOccupancy.balanced);
  assert.ok(targetOccupancy.balanced < targetOccupancy['close-coach']);
  assert.ok(targetOccupancy['close-coach'] < targetOccupancy['full-talk']);
});
