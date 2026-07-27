// 대회 훈련 계획이 "보기 전용"에서 "실제로 실행되는 것"으로 바뀌었는지 검사합니다.
//
// V3가 실패로 규정한 상태: "계획은 보이지만 시작 버튼이 실행 엔진과 연결되지 않음".
// 대회 계획이 정확히 그 상태였습니다. 이 파일은 그 상태로 돌아가면 실패합니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { programCoachCues } from '../domains/programs/coachSession';
import { buildTrainingPlan, type PlanRun } from '../domains/programs/racePlan';
import {
  DEFAULT_PACE_SECONDS_PER_KM,
  MAX_PACE_SECONDS_PER_KM,
  MAX_PLAN_SESSION_SECONDS,
  MIN_PACE_SECONDS_PER_KM,
  planPaceSecondsPerKm,
  planRunToSession,
} from '../domains/programs/racePlanSession';

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

const cardSource = read('../app/screens/programs/TrainingPlanCard.tsx');
const screenSource = read('../app/screens/programs/ProgramsScreen.tsx');

function run(kind: PlanRun['kind'], km: number): PlanRun {
  return {
    id: `w1-${kind}`,
    kind,
    label: kind === 'long' ? '길게 달리기' : '편하게 달리기',
    km,
    note: '숨이 편한 속도로 가요.',
    easy: kind !== 'fast',
  };
}

describe('거리를 시간으로 바꾼다', () => {
  it('기록이 없으면 넉넉한 기본 속도를 쓰고, 추정임을 밝힌다', () => {
    const pace = planPaceSecondsPerKm(0, 0);
    assert.equal(pace.paceSecondsPerKm, DEFAULT_PACE_SECONDS_PER_KM);
    assert.equal(pace.fromRecords, false);

    const result = planRunToSession(run('easy', 5), pace.paceSecondsPerKm, pace.fromRecords);
    assert.ok(result.ok);
    if (result.ok) {
      // 추정값을 사실처럼 보여 주면 안 됩니다.
      assert.ok(result.paceNote.includes('기록이 없어'), result.paceNote);
    }
  });

  it('기록이 있으면 그 속도를 쓴다', () => {
    // 10km를 60분에 달렸으면 1km에 360초입니다.
    const pace = planPaceSecondsPerKm(10, 60);
    assert.equal(pace.paceSecondsPerKm, 360);
    assert.equal(pace.fromRecords, true);
  });

  it('말도 안 되는 속도는 사람이 낼 수 있는 범위로 자른다', () => {
    // 1km를 10초에 달렸다는 기록이 들어와도 그대로 믿지 않습니다.
    assert.equal(planPaceSecondsPerKm(10, 1).paceSecondsPerKm, MIN_PACE_SECONDS_PER_KM);
    // 반대로 지나치게 느린 값도 자릅니다.
    assert.equal(planPaceSecondsPerKm(1, 100).paceSecondsPerKm, MAX_PACE_SECONDS_PER_KM);
  });

  it('거리와 속도를 곱해 시간을 만든다', () => {
    const result = planRunToSession(run('easy', 5), 360, true);
    assert.ok(result.ok);
    if (!result.ok) return;
    // 5km × 360초 = 1800초, 앞뒤 걷기 각 300초.
    assert.equal(result.session.runSeconds, 1800);
    assert.equal(result.session.totalSeconds, 2400);
  });
});

describe('만들 수 없을 때는 이유를 말한다', () => {
  it('대회 당일 회차는 앱이 세지 않는다', () => {
    const result = planRunToSession(run('race', 10), 360, true);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.reason.includes('대회'));
  });

  it('너무 긴 회차는 억지로 잘라 만들지 않는다', () => {
    // 계획에 20km라고 적혀 있는데 앱이 100분만 세고 끝내면
    // 사용자는 계획을 지켰다고 착각하게 됩니다. 그건 기록을 거짓말로 만듭니다.
    const result = planRunToSession(run('long', 25), 450, true);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.reason.includes('직접 나가서'), result.reason);
  });

  it('거리가 없는 회차는 만들지 않는다', () => {
    assert.equal(planRunToSession(run('easy', 0), 360, true).ok, false);
  });

  it('만들어진 회차는 언제나 상한 안이다', () => {
    for (const km of [1, 3, 5, 8, 10, 12, 15, 20, 30]) {
      const result = planRunToSession(run('easy', km), 450, true);
      if (!result.ok) continue;
      assert.ok(
        result.session.totalSeconds <= MAX_PLAN_SESSION_SECONDS,
        `${km}km가 상한을 넘었습니다`,
      );
    }
  });
});

describe('만들어진 회차가 실행 엔진에서 그대로 돈다', () => {
  it('준비·마무리 걷기가 붙는다', () => {
    const result = planRunToSession(run('easy', 5), 360, true);
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.equal(result.session.segments[0]?.role, 'warmup');
    assert.equal(result.session.segments.at(-1)?.role, 'cooldown');
  });

  it('음성까지 끝까지 이어진다', () => {
    const result = planRunToSession(run('long', 8), 400, true);
    assert.ok(result.ok);
    if (!result.ok) return;
    const cues = programCoachCues(result.session);
    assert.ok(cues.length > 0);
    assert.ok(cues.some((cue) => cue.kind === 'phase'));
    assert.ok(cues.some((cue) => cue.kind === 'completion'));
  });

  it('실제로 만들어진 계획의 이번 주 회차가 실행된다', () => {
    // 손으로 만든 가짜 값이 아니라, 계획 생성기가 뱉은 값으로 확인합니다.
    const plan = buildTrainingPlan({
      distance: '10k',
      weeksLeft: 8,
      weeklyKm: 20,
      runsPerWeek: 3,
      longestRecentKm: 8,
    });
    const thisWeek = plan.weeks[0];
    assert.ok(thisWeek);
    const runnable = thisWeek.runs
      .map((item) => planRunToSession(item, 400, true))
      .filter((item) => item.ok);
    assert.ok(runnable.length > 0, '이번 주에 시작할 수 있는 회차가 하나도 없습니다');
  });

  it('같은 값이면 언제나 같은 결과가 나온다', () => {
    assert.deepEqual(
      planRunToSession(run('easy', 6), 400, true),
      planRunToSession(run('easy', 6), 400, true),
    );
  });
});

describe('대회 계획이 화면에서 실행으로 이어진다', () => {
  it('계획 카드에 시작 버튼이 있다', () => {
    assert.ok(cardSource.includes('onStartRun'), '시작 버튼 연결이 없습니다');
    assert.ok(cardSource.includes('planRunToSession'), '실행 가능한지 판단하지 않습니다');
  });

  it('시작할 수 없을 때도 이유를 보여 준다', () => {
    // 버튼만 사라지면 사용자는 고장으로 봅니다.
    assert.ok(cardSource.includes('runnable.reason'));
  });

  it('추정한 속도임을 화면에 밝힌다', () => {
    assert.ok(cardSource.includes('runnable.paceNote'));
  });

  it('프로그램 화면이 실제로 회차를 실행한다', () => {
    assert.ok(screenSource.includes('setRunning(built.session)'), '계획이 실행되지 않습니다');
  });

  it('대회 계획 회차를 9주 프로그램 진도로 세지 않는다', () => {
    // 대회 계획을 한 번 했다고 9주 프로그램이 진행되면 안 됩니다.
    const startBlock = screenSource.slice(screenSource.indexOf('onStartRun'));
    assert.ok(startBlock.includes('setRunningIsWorkout(true)'));
  });
});
