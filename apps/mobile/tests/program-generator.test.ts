// 계획 생성기가 "안전한 계획만" 만들어 내는지 검사합니다.
//
// 이 검사가 무너지면 부담이 갑자기 뛰는 계획이 사용자에게 나갑니다.
// 실제로 처음 만든 생성기는 1주 12분 -> 2주 32분(167% 증가)짜리 계획을 만들었고,
// 아래 규칙들이 그것을 잡아냈습니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COOLDOWN_SECONDS,
  WARMUP_SECONDS,
  generatePlan,
  isCutbackWeek,
  validatePlan,
  type PlanRecipe,
} from '../domains/programs/generator';

function recipe(overrides: Partial<PlanRecipe> = {}): PlanRecipe {
  return {
    id: 'test-plan',
    name: '테스트 계획',
    subtitle: '검사용',
    description: '검사용 계획입니다.',
    startRunSeconds: 120,
    endRunSeconds: 1200,
    startTotalRunSeconds: 720,
    endTotalRunSeconds: 1200,
    walkRatio: 1,
    weeks: 6,
    daysPerWeek: 3,
    ...overrides,
  };
}

describe('계획 생성', () => {
  it('요청한 주차와 주당 횟수를 그대로 지킨다', () => {
    const plan = generatePlan(recipe({ weeks: 6, daysPerWeek: 3 }));
    assert.equal(plan.weeks.length, 6);
    assert.equal(plan.sessions.length, 18);
    assert.equal(plan.runsPerWeek, 3);
    for (const week of plan.weeks) assert.equal(week.sessions.length, 3);
  });

  it('모든 회차에 준비 걷기와 마무리 걷기가 붙는다', () => {
    const plan = generatePlan(recipe());
    for (const session of plan.sessions) {
      assert.equal(session.segments[0].role, 'warmup');
      assert.equal(session.segments[0].seconds, WARMUP_SECONDS);
      assert.equal(session.segments.at(-1)?.role, 'cooldown');
      assert.equal(session.segments.at(-1)?.seconds, COOLDOWN_SECONDS);
    }
  });

  it('0초·음수·NaN 구간을 만들지 않는다', () => {
    // 극단적인 입력에서도 깨지면 안 됩니다.
    for (const weeks of [1, 2, 4, 12, 26]) {
      for (const days of [2, 3, 5]) {
        const plan = generatePlan(recipe({ weeks, daysPerWeek: days }));
        for (const session of plan.sessions) {
          for (const item of session.segments) {
            assert.ok(Number.isFinite(item.seconds), `${item.id} 길이가 숫자가 아닙니다`);
            assert.ok(item.seconds > 0, `${item.id} 길이가 ${item.seconds}초입니다`);
          }
        }
      }
    }
  });

  it('회차 ID가 겹치지 않는다', () => {
    const plan = generatePlan(recipe({ weeks: 12, daysPerWeek: 5 }));
    const ids = new Set(plan.sessions.map((session) => session.id));
    assert.equal(ids.size, plan.sessions.length);
  });

  it('같은 입력이면 언제나 같은 결과가 나온다', () => {
    // 결정적이어야 시뮬레이션과 스냅샷 검증이 성립합니다.
    const first = generatePlan(recipe());
    const second = generatePlan(recipe());
    assert.deepEqual(first, second);
  });

  it('4주가 넘으면 가볍게 가는 주가 들어간다', () => {
    const plan = generatePlan(recipe({ weeks: 8 }));
    assert.ok(isCutbackWeek(4, 8));
    // 회복 주는 직전 주보다 더 뛰지 않아야 합니다.
    const third = plan.weeks[2].sessions[0].runSeconds;
    const fourth = plan.weeks[3].sessions[0].runSeconds;
    assert.ok(fourth <= third, `4주차(${fourth}초)가 3주차(${third}초)보다 많습니다`);
  });

  it('마지막 주를 회복 주로 착각하지 않는다', () => {
    // 마지막 주는 목표에 도달하는 주입니다. 여기서 물러서면 계획이 목표를 못 채웁니다.
    const plan = generatePlan(recipe({ weeks: 8 }));
    assert.equal(isCutbackWeek(8, 8), false);
    const last = plan.weeks.at(-1)?.sessions[0].runSeconds ?? 0;
    const first = plan.weeks[0].sessions[0].runSeconds;
    assert.ok(last > first);
  });
});

describe('안전 검증', () => {
  it('안전한 계획은 문제를 보고하지 않는다', () => {
    const plan = generatePlan(
      recipe({ weeks: 6, startRunSeconds: 120, endRunSeconds: 1200 }),
    );
    assert.deepEqual(validatePlan(plan), []);
  });

  it('부담이 한 번에 크게 뛰는 계획을 잡아낸다', () => {
    // 이 규칙이 없으면 1주 12분 -> 2주 32분짜리 계획이 그대로 나갑니다.
    const plan = generatePlan(
      recipe({ weeks: 3, startTotalRunSeconds: 600, endTotalRunSeconds: 2400 }),
    );
    const problems = validatePlan(plan);
    assert.ok(
      problems.some((problem) => problem.includes('너무 많이 늘어납니다')),
      `무리한 증가를 잡지 못했습니다: ${JSON.stringify(problems)}`,
    );
  });

  it('짧은 계획에서 퍼센트만으로 억울하게 막지 않는다', () => {
    // 8분 -> 10분은 25%지만 2분 차이입니다. 이런 건 통과해야 합니다.
    const plan = generatePlan(
      recipe({ weeks: 4, startRunSeconds: 60, endRunSeconds: 600, startTotalRunSeconds: 480, endTotalRunSeconds: 600 }),
    );
    assert.deepEqual(validatePlan(plan), []);
  });

  it('한 회차가 지나치게 긴 계획을 잡아낸다', () => {
    const plan = generatePlan(
      recipe({ weeks: 2, startTotalRunSeconds: 5400, endTotalRunSeconds: 6000, walkRatio: 2 }),
    );
    const problems = validatePlan(plan);
    assert.ok(problems.some((problem) => problem.includes('너무 깁니다')));
  });

  it('뛰는 시간이 매주 줄기만 하는 계획을 잡아낸다', () => {
    const plan = generatePlan(
      recipe({ weeks: 4, startTotalRunSeconds: 1200, endTotalRunSeconds: 300 }),
    );
    assert.ok(validatePlan(plan).some((problem) => problem.includes('적게 뜁니다')));
  });
});
