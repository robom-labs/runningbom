// 회고 저장 규칙을 검증합니다.
//
// 여기서 보는 것: **저장 값이 깨져도 앱이 죽지 않는가.**
// 회고는 있으면 좋은 것이지 없으면 안 되는 것이 아닙니다.
// 저장 한 줄이 이상해서 앱이 안 열리면, 회고를 안 만드는 편이 나았던 게 됩니다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_RETROSPECTS,
  RETROSPECT_STORE_KEY,
  addRetrospect,
  parseRetrospects,
  type StoredRetrospect,
} from '../domains/activities/retrospectStore';

const entry = (activityId: string, effort: 'easy' | 'right' | 'hard' = 'right'): StoredRetrospect => ({
  effort,
  bodyTagIds: ['fine'],
  activityId,
  savedAt: '2026-07-27T00:00:00.000Z',
});

test('저장 열쇠를 바꾸지 않습니다', () => {
  // 열쇠가 바뀌면 이미 남긴 회고가 통째로 사라집니다.
  assert.equal(RETROSPECT_STORE_KEY, 'runningbom.retrospect.v1');
});

test('배열이 아니면 빈 목록으로 봅니다', () => {
  assert.deepEqual(parseRetrospects(null), []);
  assert.deepEqual(parseRetrospects('이상한값'), []);
  assert.deepEqual(parseRetrospects({ effort: 'right' }), []);
});

test('모르는 값이 섞여 있으면 그 줄만 버립니다', () => {
  // 한 줄이 이상하다고 전부 버리면 멀쩡한 기록까지 날아갑니다.
  const parsed = parseRetrospects([
    { effort: 'right', bodyTagIds: ['fine'], savedAt: 'x' },
    { effort: '없는값', bodyTagIds: [], savedAt: 'x' },
    null,
    { effort: 'hard', bodyTagIds: ['모르는꼬리표', 'knee'], savedAt: 'x' },
  ]);
  assert.equal(parsed.length, 2);
  // 모르는 꼬리표는 걸러 내고 아는 것만 남깁니다.
  assert.deepEqual(parsed[1]?.bodyTagIds, ['knee']);
});

test('새 회고가 앞에 옵니다', () => {
  const list = addRetrospect([entry('a')], entry('b'));
  assert.equal(list[0]?.activityId, 'b');
});

test('같은 회차에 두 번 쓰면 뒤엣것으로 바뀝니다', () => {
  // 잘못 눌렀을 때 고칠 수 있어야 합니다.
  const list = addRetrospect([entry('a', 'easy')], entry('a', 'hard'));
  assert.equal(list.length, 1);
  assert.equal(list[0]?.effort, 'hard');
});

test('회차 없이 남긴 회고는 겹쳐 쓰지 않습니다', () => {
  const first: StoredRetrospect = { effort: 'right', bodyTagIds: [], savedAt: 'x' };
  const second: StoredRetrospect = { effort: 'hard', bodyTagIds: [], savedAt: 'y' };
  assert.equal(addRetrospect([first], second).length, 2);
});

test('최근 것만 남깁니다', () => {
  // 다 쌓아 두면 저장만 늘고 판단은 그대로입니다.
  let list: StoredRetrospect[] = [];
  for (let index = 0; index < MAX_RETROSPECTS + 10; index += 1) {
    list = addRetrospect(list, entry(`a${index}`));
  }
  assert.equal(list.length, MAX_RETROSPECTS);
});

test('읽을 때도 상한을 지킵니다', () => {
  const many = Array.from({ length: MAX_RETROSPECTS + 20 }, () => ({
    effort: 'right',
    bodyTagIds: [],
    savedAt: 'x',
  }));
  assert.equal(parseRetrospects(many).length, MAX_RETROSPECTS);
});
