// 회고와 그 값이 오늘 제안을 실제로 바꾸는지 검증합니다.
//
// 회고에서 가장 중요한 건 "예쁘게 물어보는가"가 아니라
// **물어본 값으로 실제로 무언가가 달라지는가**입니다.
// 달라지지 않으면 그건 회고가 아니라 설문이고, 설문은 아무도 두 번 채우지 않습니다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adjustFromRetrospects,
  adjustReasons,
  bodyTags,
  effortChoices,
  hasCaution,
  toggleBodyTag,
  type Retrospect,
} from '../domains/activities/retrospect';
import { suggestToday } from '../domains/today/suggest';

const now = new Date('2026-07-27T09:00:00+09:00');

test('고를 것이 셋뿐입니다', () => {
  // 이모지 다섯 개는 사람마다 다르게 읽힙니다. 셋이고 말이면 뜻이 하나입니다.
  assert.equal(effortChoices.length, 3);
  for (const choice of effortChoices) {
    assert.ok(choice.label.length > 0);
    assert.ok(choice.hint.length > 0);
  }
});

test('이모지를 쓰지 않습니다', () => {
  // 회장 지시입니다. 그리고 이모지는 화면 낭독기에서도 제대로 안 읽힙니다.
  const blob = effortChoices.map((c) => `${c.label}${c.hint}`).join('');
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(blob));
});

test('괜찮았어요를 고르면 나머지 꼬리표가 지워집니다', () => {
  // "괜찮았는데 무릎이 시큰"은 뜻이 안 맞습니다.
  assert.deepEqual(toggleBodyTag(['knee', 'tired'], 'fine'), ['fine']);
});

test('아픈 곳을 고르면 괜찮았어요가 빠집니다', () => {
  assert.deepEqual(toggleBodyTag(['fine'], 'knee'), ['knee']);
});

test('같은 꼬리표를 다시 누르면 빠집니다', () => {
  assert.deepEqual(toggleBodyTag(['knee', 'tired'], 'knee'), ['tired']);
});

test('아픈 신호와 그냥 힘든 신호를 구분합니다', () => {
  // 숨이 찬 건 훈련의 일부입니다. 무릎이 시큰한 건 다릅니다.
  assert.equal(hasCaution(['knee']), true);
  assert.equal(hasCaution(['breath', 'tired']), false);
  assert.equal(hasCaution(['fine']), false);
});

test('꼬리표마다 쉬라는 신호인지 정해져 있습니다', () => {
  for (const tag of bodyTags) {
    assert.equal(typeof tag.caution, 'boolean');
  }
});

const caution = (): Retrospect => ({ effort: 'right', bodyTagIds: ['knee'] });
const hard = (): Retrospect => ({ effort: 'hard', bodyTagIds: ['tired'] });
const easy = (): Retrospect => ({ effort: 'easy', bodyTagIds: ['fine'] });

test('아픈 신호가 두 번 이어지면 쉬라고 합니다', () => {
  // 참고 뛰면 오래 못 뜁니다.
  assert.equal(adjustFromRetrospects({ recent: [caution(), caution()] }), 'rest');
});

test('아픈 신호가 한 번이면 가볍게 갑니다', () => {
  assert.equal(adjustFromRetrospects({ recent: [caution(), easy()] }), 'easier');
});

test('힘들었다가 두 번 이어지면 가볍게 갑니다', () => {
  assert.equal(adjustFromRetrospects({ recent: [hard(), hard()] }), 'easier');
});

test('가벼웠다가 두 번 이어지면 준비된 것으로 봅니다', () => {
  assert.equal(adjustFromRetrospects({ recent: [easy(), easy()] }), 'ready');
});

test('회고가 없으면 예전과 똑같이 동작합니다', () => {
  assert.equal(adjustFromRetrospects({ recent: [] }), 'same');
});

test('조정마다 왜 그런지가 있습니다', () => {
  // 근거 없는 조정은 신뢰를 잃습니다.
  for (const key of ['rest', 'easier', 'same', 'ready'] as const) {
    assert.ok(adjustReasons[key].length >= 10);
  }
});

// ── 여기부터가 핵심: 값이 실제로 제안을 바꾸는가 ──────────────────────────

test('아픈 신호가 이어지면 오늘 제안이 쉬기로 바뀝니다', () => {
  // 회고를 안 넣으면 계획 회차가 나오는 상황입니다.
  const withoutRetrospect = suggestToday({
    activities: [],
    now,
    hasPlanSessionLeft: true,
  });
  assert.notEqual(withoutRetrospect.kind, 'rest');

  const withRetrospect = suggestToday({
    activities: [],
    now,
    hasPlanSessionLeft: true,
    adjust: 'rest',
  });
  assert.equal(withRetrospect.kind, 'rest');
  assert.equal(withRetrospect.reason, adjustReasons.rest);
});

test('힘들었다가 이어지면 계획 회차 대신 가벼운 훈련이 나옵니다', () => {
  // 계획을 계속 밀어붙이면 계획을 그만두게 됩니다.
  const shown = suggestToday({
    activities: [],
    now,
    hasPlanSessionLeft: true,
    adjust: 'easier',
  });
  assert.equal(shown.kind, 'workout');
  assert.equal(shown.workoutId, 'recovery-20m');
});

test('가벼웠다가 이어져도 회차를 늘리지는 않습니다', () => {
  // 준비됐다고 해서 더 하라고 밀어붙이지 않습니다. 말만 바뀝니다.
  const shown = suggestToday({
    activities: [],
    now,
    hasPlanSessionLeft: true,
    adjust: 'ready',
  });
  assert.equal(shown.kind, 'planSession');
  assert.equal(shown.reason, adjustReasons.ready);
});

test('회고를 안 넣으면 예전 동작 그대로입니다', () => {
  // 기존 사용자에게 갑자기 다른 제안이 뜨면 안 됩니다.
  const before = suggestToday({ activities: [], now, hasPlanSessionLeft: true });
  const after = suggestToday({ activities: [], now, hasPlanSessionLeft: true, adjust: 'same' });
  assert.deepEqual(before, after);
});
