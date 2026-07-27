// 온보딩이 끝날 때 어떤 계획이 깔리는지 검증합니다.
//
// 여기서 보는 것 하나가 가장 중요합니다:
//   **스스로 밝힌 수준보다 위쪽 계획이 깔리지 않는가.**
// 다치는 쪽은 되돌릴 수 없습니다. 나머지는 다 고칠 수 있어도 이건 못 고칩니다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { programFamilies } from '../domains/programs/catalog';
import {
  onboardingPlanId,
  onboardingPlanNote,
  startingPoint,
  startingPoints,
} from '../domains/programs/onboardingPlan';
import { emptyProgramStore, seedPlan, switchPlan } from '../domains/programs/store';

test('고를 것이 네 개뿐입니다', () => {
  // 다섯 개가 넘으면 자기가 어디에 속하는지 고민이 길어집니다.
  assert.equal(startingPoints.length, 4);
});

test('고르는 말이 잘하고 못하고를 가르지 않습니다', () => {
  const banned = ['초보', '초급', '못', '실력', '수준 낮'];
  for (const point of startingPoints) {
    const blob = `${point.label} ${point.description}`;
    for (const word of banned) {
      assert.ok(!blob.includes(word), `"${blob}"에 "${word}"가 들어 있습니다`);
    }
  }
});

test('고른 계획이 전부 실제로 있는 계획입니다', () => {
  // 없는 계획을 가리키면 온보딩 끝에 아무것도 안 깔립니다.
  for (const point of startingPoints) {
    const found = programFamilies.find((plan) => plan.id === point.planId);
    assert.ok(found, `${point.id}가 가리키는 ${point.planId}가 카탈로그에 없습니다`);
  }
});

test('모르는 값이면 가장 낮은 계획으로 떨어집니다', () => {
  // 못 찾았을 때 위쪽으로 떨어지면 처음 온 사람이 다칩니다.
  assert.equal(onboardingPlanId('없는값' as never), 'move-14d');
});

test('거의 안 뛰는 사람에게 5K 계획을 깔지 않습니다', () => {
  const planId = onboardingPlanId('walking');
  assert.equal(planId, 'move-14d');
  assert.notEqual(planId, 'first-5k');
});

test('자격 조건이 걸린 계획은 온보딩에서 고르지 않습니다', () => {
  // 하프·마라톤·부상 복귀는 사람이 검수한 뒤에만 엽니다.
  const gated = new Set(['return-after-injury']);
  for (const point of startingPoints) {
    assert.ok(!gated.has(point.planId), `${point.id}가 검수 대상 계획을 가리킵니다`);
  }
});

test('고르기 전에 무엇이 준비되는지 미리 보여 줍니다', () => {
  // 모르는 채로 고르게 하지 않습니다.
  for (const point of startingPoints) {
    const note = onboardingPlanNote(point.id);
    assert.ok(note.includes('"'), `${point.id}의 안내에 계획 이름이 없습니다`);
  }
});

test('알 수 없는 id를 넘겨도 첫 항목으로 돌아옵니다', () => {
  assert.equal(startingPoint('없는값' as never).id, 'walking');
});

test('이미 하던 계획이 있으면 덮어쓰지 않습니다', () => {
  // 진행 중인 사람의 이력을 지우는 것은 되돌릴 수 없습니다.
  const started = switchPlan(emptyProgramStore, 'first-10k');
  const after = seedPlan(started, 'move-14d');
  assert.equal(after.activePlanId, 'first-10k');
  // 바뀐 게 없으면 같은 객체를 그대로 돌려줘 저장도 건너뜁니다.
  assert.equal(after, started);
});

test('처음 시작하는 사람에게는 계획을 깔아 둡니다', () => {
  const after = seedPlan(emptyProgramStore, 'move-14d');
  assert.equal(after.activePlanId, 'move-14d');
});

test('깔아 두면서 지난 기록을 지우지 않습니다', () => {
  const withHistory = { ...emptyProgramStore, completedSessionIds: ['start9-w1-d1'] };
  const after = seedPlan(withHistory, 'move-14d');
  assert.deepEqual(after.completedSessionIds, ['start9-w1-d1']);
});
