// 계획을 바꿔도 기존 사용자의 기록이 사라지지 않는지 검사합니다.
// 이 규칙이 깨지면 9주 프로그램을 진행 중이던 분들의 이력이 날아갑니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PROGRAM_ID as START9_ID } from '../domains/programs/beginnerProgram';
import {
  emptyProgramStore,
  parseProgramStore,
  saveAttempt,
  switchPlan,
  type ProgramStore,
} from '../domains/programs/store';

const attempt = {
  sessionId: `${START9_ID}-w1d1`,
  completedSeconds: 1800,
  totalSeconds: 1800,
  finishedAt: '2026-07-20T10:00:00.000Z',
};

describe('예전 저장 값 읽기', () => {
  it('계획 ID가 없던 예전 값도 그대로 읽는다', () => {
    // 이 앱을 이미 쓰고 있던 분들의 저장 값에는 activePlanId가 없습니다.
    const old = {
      completedSessionIds: [`${START9_ID}-w1d1`, `${START9_ID}-w1d2`],
      attempts: [attempt],
      startedAt: '2026-07-01T00:00:00.000Z',
    };
    const parsed = parseProgramStore(old);
    assert.deepEqual(parsed.completedSessionIds, old.completedSessionIds);
    assert.equal(parsed.attempts.length, 1);
    assert.equal(parsed.startedAt, old.startedAt);
    // 없으면 없는 대로 둡니다. 화면이 9주 프로그램으로 해석합니다.
    assert.equal(parsed.activePlanId, undefined);
  });

  it('빈 문자열은 계획 ID로 인정하지 않는다', () => {
    const parsed = parseProgramStore({ ...emptyProgramStore, activePlanId: '' });
    assert.equal(parsed.activePlanId, undefined);
  });

  it('저장 값이 깨져 있어도 멈추지 않는다', () => {
    assert.deepEqual(parseProgramStore(null), emptyProgramStore);
    assert.deepEqual(parseProgramStore('망가진 값'), emptyProgramStore);
  });
});

describe('계획 바꾸기', () => {
  it('계획을 바꿔도 완료한 회차와 기록이 남는다', () => {
    // 가장 중요한 규칙입니다. 다른 계획을 구경했다고 이력이 사라지면 안 됩니다.
    let store: ProgramStore = saveAttempt(emptyProgramStore, attempt, true);
    assert.equal(store.completedSessionIds.length, 1);

    store = switchPlan(store, 'first-5k');

    assert.equal(store.activePlanId, 'first-5k');
    assert.deepEqual(store.completedSessionIds, [`${START9_ID}-w1d1`]);
    assert.equal(store.attempts.length, 1);
    assert.equal(store.startedAt, attempt.finishedAt);
  });

  it('돌아와도 예전 계획의 완료 기록이 그대로다', () => {
    let store = saveAttempt(emptyProgramStore, attempt, true);
    store = switchPlan(store, 'first-5k');
    store = switchPlan(store, START9_ID);

    assert.equal(store.activePlanId, START9_ID);
    assert.deepEqual(store.completedSessionIds, [`${START9_ID}-w1d1`]);
  });

  it('같은 계획을 다시 고르면 아무것도 바꾸지 않는다', () => {
    const store = switchPlan({ ...emptyProgramStore, activePlanId: 'first-5k' }, 'first-5k');
    assert.equal(store.activePlanId, 'first-5k');
  });

  it('빈 ID로는 바꾸지 않는다', () => {
    const before: ProgramStore = { ...emptyProgramStore, activePlanId: 'first-5k' };
    assert.equal(switchPlan(before, '').activePlanId, 'first-5k');
  });
});

describe('회차 기록 저장', () => {
  it('회차를 마쳐도 지금 하는 계획이 바뀌지 않는다', () => {
    const before: ProgramStore = { ...emptyProgramStore, activePlanId: 'first-5k' };
    const after = saveAttempt(before, attempt, true);
    assert.equal(after.activePlanId, 'first-5k');
  });
});
