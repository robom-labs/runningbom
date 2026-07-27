// 목표 대회 훈련 계획 생성기가 조사로 확인된 규칙을 지키는지 검증합니다.
// 규칙 하나에 테스트 하나씩 붙여 두어, 규칙을 고치면 어떤 테스트가 깨지는지 바로 보이게 했습니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BEGINNER_GROWTH_RATE,
  CUTBACK_RATE,
  EASY_SHARE_TARGET,
  GROWTH_RATE,
  LONG_RUN_CAP_RATE,
  buildTrainingPlan,
  guessRaceDistance,
  racePlanDistances,
  racePlanGuides,
  taperCutRate,
  weekRunKinds,
  type PlanWeek,
  type RacePlanDistance,
  type RacePlanInput,
} from '../domains/programs/racePlan';
import { recentRunning, recentRunningNote } from '../domains/programs/recent';
import type { ActivityRecord } from '../domains/activities/types';

const base: RacePlanInput = {
  distance: 'half',
  weeksLeft: 14,
  weeklyKm: 24,
  runsPerWeek: 4,
  longestRecentKm: 9,
};

function plan(overrides: Partial<RacePlanInput> = {}) {
  return buildTrainingPlan({ ...base, ...overrides });
}

function warningIds(input: Partial<RacePlanInput> = {}): string[] {
  return plan(input).warnings.map((warning) => warning.id);
}

describe('규칙 1 - 권장 준비 기간', () => {
  it('거리마다 권장 기간을 갖는다', () => {
    assert.equal(racePlanGuides['5k'].minWeeks, 8);
    assert.equal(racePlanGuides['5k'].maxWeeks, 9);
    assert.equal(racePlanGuides['10k'].minWeeks, 8);
    assert.equal(racePlanGuides['10k'].maxWeeks, 10);
    assert.equal(racePlanGuides.half.minWeeks, 12);
    assert.equal(racePlanGuides.half.maxWeeks, 16);
    assert.equal(racePlanGuides.full.minWeeks, 18);
    assert.equal(racePlanGuides.full.maxWeeks, 20);
  });

  it('남은 주가 짧으면 경고를 주되 계획은 그대로 만든다', () => {
    const short = plan({ weeksLeft: 6 });
    assert.ok(short.warnings.some((warning) => warning.id === 'short-prep'));
    assert.equal(short.weeks.length, 6);
    // 막지 않습니다. 마지막 주는 언제나 대회 주간입니다.
    assert.equal(short.weeks[short.weeks.length - 1]?.phase, 'raceWeek');
  });

  it('기간이 넉넉하면 짧다는 경고를 주지 않는다', () => {
    assert.equal(warningIds({ weeksLeft: 14 }).includes('short-prep'), false);
  });

  it('모든 거리에서 1주만 남아도 계획이 만들어진다', () => {
    for (const distance of racePlanDistances) {
      const tight = plan({ distance, weeksLeft: 1 });
      assert.equal(tight.weeks.length, 1);
      assert.equal(tight.weeks[0]?.phase, 'raceWeek');
      assert.ok(tight.warnings.length > 0);
    }
  });
});

describe('규칙 2 - 주당 러닝 구성', () => {
  it('주 3회는 길게 달리기 1회 + 편한 러닝 1회 + 조금 빠르게 1회다', () => {
    assert.deepEqual(weekRunKinds(3, false), ['long', 'easy', 'fast']);
  });

  it('주 4회면 편한 러닝이 1회 늘어난다', () => {
    assert.deepEqual(weekRunKinds(4, false), ['long', 'easy', 'easy', 'fast']);
  });

  it('이제 막 시작한 사람은 주 3회 전부 편한 러닝이어도 된다', () => {
    assert.deepEqual(weekRunKinds(3, true), ['long', 'easy', 'easy']);
    const beginner = plan({ beginner: true, runsPerWeek: 3 });
    const first = beginner.weeks[0] as PlanWeek;
    assert.equal(
      first.runs.every((run) => run.easy),
      true,
    );
  });

  it('달리는 날 수가 주마다 같다', () => {
    const made = plan({ runsPerWeek: 4 });
    for (const week of made.weeks) {
      assert.equal(week.runs.length, 4, `${week.week}주차 회차 수`);
    }
  });
});

describe('규칙 3 - 긴 거리는 주당 5~10%만 늘린다', () => {
  it('늘리는 주의 증가폭이 10%를 넘지 않는다', () => {
    const made = plan({ weeksLeft: 16 });
    let previous = base.longestRecentKm as number;
    for (const week of made.weeks) {
      if (week.phase !== 'build' && week.phase !== 'peak') continue;
      assert.ok(
        week.longKm <= previous * 1.1 + 0.05,
        `${week.week}주차 ${previous} → ${week.longKm}`,
      );
      previous = week.longKm;
    }
  });

  it('처음 달리는 사람은 더 천천히 늘린다', () => {
    assert.ok(BEGINNER_GROWTH_RATE < GROWTH_RATE);
    assert.ok(GROWTH_RATE <= 0.1 && GROWTH_RATE >= 0.05);
    assert.ok(BEGINNER_GROWTH_RATE >= 0.05);
  });
});

describe('규칙 4 - 3주 올리면 1주 줄이기', () => {
  it('4주마다 회복 주가 온다', () => {
    const made = plan({ weeksLeft: 16, beginner: false });
    const recovery = made.weeks.filter((week) => week.phase === 'recovery').map((w) => w.week);
    assert.deepEqual(recovery, [4, 8, 12]);
  });

  it('처음 달리는 사람은 2주 올리고 1주 줄인다', () => {
    const made = plan({ weeksLeft: 16, beginner: true });
    const recovery = made.weeks.filter((week) => week.phase === 'recovery').map((w) => w.week);
    assert.deepEqual(recovery, [3, 6, 9, 12]);
  });

  it('회복 주에는 20%를 줄인다', () => {
    const made = plan({ weeksLeft: 16, beginner: false });
    const before = made.weeks[2] as PlanWeek;
    const recovery = made.weeks[3] as PlanWeek;
    assert.equal(recovery.phase, 'recovery');
    const drop = 1 - recovery.longKm / before.longKm;
    assert.ok(Math.abs(drop - CUTBACK_RATE) < 0.02, `줄인 비율 ${drop}`);
  });

  it('회복 주 다음에는 다시 늘린다', () => {
    const made = plan({ weeksLeft: 16, beginner: false });
    const before = made.weeks[2] as PlanWeek;
    const after = made.weeks[4] as PlanWeek;
    assert.ok(after.longKm > before.longKm);
  });
});

describe('규칙 5 - 긴 거리는 최근 4주 최장의 110%를 넘지 않는다', () => {
  it('어떤 입력에도 상한을 지킨다', () => {
    assert.equal(LONG_RUN_CAP_RATE, 1.1);
    const cases: Array<Partial<RacePlanInput>> = [
      { distance: 'full', weeksLeft: 20, weeklyKm: 30, longestRecentKm: 8 },
      { distance: 'half', weeksLeft: 12, weeklyKm: 10, longestRecentKm: 3 },
      { distance: '10k', weeksLeft: 9, weeklyKm: 5, longestRecentKm: 2 },
      { distance: '5k', weeksLeft: 8, weeklyKm: 40, longestRecentKm: 12 },
    ];
    for (const input of cases) {
      const made = plan(input);
      const history = [input.longestRecentKm as number];
      for (const week of made.weeks) {
        if (week.phase === 'raceWeek') continue;
        const cap = Math.max(...history.slice(-4)) * LONG_RUN_CAP_RATE;
        assert.ok(
          week.longKm <= cap + 0.05,
          `${input.distance} ${week.week}주차 ${week.longKm} > 상한 ${cap}`,
        );
        history.push(week.longKm);
      }
    }
  });

  it('최근 4주 최장을 모르면 주간 거리에서 조심스럽게 어림잡는다', () => {
    const made = plan({ longestRecentKm: undefined, weeklyKm: 20 });
    const first = made.weeks[0] as PlanWeek;
    assert.ok(first.longKm <= 20 * 0.35 * LONG_RUN_CAP_RATE + 0.05);
  });
});

describe('규칙 6 - 대회 3주 전에 가장 길게 달린다', () => {
  it('가장 긴 주가 대회 3주 전이다', () => {
    for (const distance of racePlanDistances) {
      const made = plan({ distance, weeksLeft: 16, weeklyKm: 30, longestRecentKm: 10 });
      assert.equal(made.summary.peakWeek, 13, `${distance} 가장 긴 주`);
      const peak = made.weeks.find((week) => week.phase === 'peak') as PlanWeek;
      assert.equal(peak.weeksToRace, 3);
    }
  });

  it('가장 긴 주 뒤로는 긴 거리가 다시 늘지 않는다', () => {
    const made = plan({ weeksLeft: 16 });
    const peak = made.weeks.find((week) => week.phase === 'peak') as PlanWeek;
    for (const week of made.weeks.filter((week) => week.week > peak.week)) {
      if (week.phase === 'raceWeek') continue;
      assert.ok(week.longKm <= peak.longKm, `${week.week}주차가 가장 긴 주보다 깁니다`);
    }
  });
});

describe('규칙 7 - 대회 전 줄이기', () => {
  it('거리마다 줄이는 기간이 다르다', () => {
    const expected: Record<RacePlanDistance, number> = { '5k': 1, '10k': 2, half: 2, full: 3 };
    for (const distance of racePlanDistances) {
      const made = plan({ distance, weeksLeft: 16 });
      assert.equal(made.summary.taperWeeks, expected[distance], distance);
    }
  });

  it('줄이는 폭이 40~60% 사이다', () => {
    assert.equal(taperCutRate(0, 1), 0.5);
    assert.equal(taperCutRate(0, 2), 0.4);
    assert.equal(taperCutRate(1, 2), 0.6);
    assert.equal(taperCutRate(0, 3), 0.4);
    assert.equal(taperCutRate(2, 3), 0.6);
    for (let taper = 1; taper <= 3; taper += 1) {
      for (let index = 0; index < taper; index += 1) {
        const rate = taperCutRate(index, taper);
        assert.ok(rate >= 0.4 && rate <= 0.6, `${taper}주 중 ${index}번째 ${rate}`);
      }
    }
  });

  it('줄이는 주의 거리가 가장 긴 주보다 40~60% 적다', () => {
    const made = plan({ distance: 'full', weeksLeft: 18, weeklyKm: 40, longestRecentKm: 16 });
    const peak = made.weeks.find((week) => week.phase === 'peak') as PlanWeek;
    const cutbacks = made.weeks.filter((week) => week.phase === 'cutback');
    assert.ok(cutbacks.length > 0);
    for (const week of cutbacks) {
      const cut = 1 - week.totalKm / peak.totalKm;
      assert.ok(cut >= 0.35 && cut <= 0.65, `${week.week}주차 ${cut}`);
    }
  });

  it('줄이는 동안에도 달리는 날 수와 조금 빠르게가 그대로 남는다', () => {
    const made = plan({ distance: 'half', weeksLeft: 14, runsPerWeek: 4 });
    for (const week of made.weeks) {
      assert.equal(week.runs.length, 4, `${week.week}주차 달리는 날 수`);
      assert.ok(
        week.runs.some((run) => run.kind === 'fast'),
        `${week.week}주차에 조금 빠르게가 없습니다`,
      );
    }
  });

  it('대회 주간에는 대회가 들어가고 나머지는 짧다', () => {
    const made = plan({ distance: 'half', weeksLeft: 14 });
    const last = made.weeks[made.weeks.length - 1] as PlanWeek;
    assert.equal(last.phase, 'raceWeek');
    const race = last.runs.find((run) => run.kind === 'race');
    assert.equal(race?.km, 21.1);
    for (const run of last.runs.filter((item) => item.kind !== 'race')) {
      assert.ok(run.km <= 4, `대회 주간 연습이 깁니다 ${run.km}`);
    }
  });
});

describe('규칙 8 - 80%는 편한 강도', () => {
  it('여러 조건에서도 편한 강도가 80% 이상이다', () => {
    const cases: Array<Partial<RacePlanInput>> = [
      { distance: '5k', weeksLeft: 9, weeklyKm: 12, runsPerWeek: 3 },
      { distance: '10k', weeksLeft: 10, weeklyKm: 20, runsPerWeek: 4 },
      { distance: 'half', weeksLeft: 14, weeklyKm: 30, runsPerWeek: 5 },
      { distance: 'full', weeksLeft: 20, weeklyKm: 45, runsPerWeek: 6, longestRecentKm: 18 },
    ];
    for (const input of cases) {
      const made = plan(input);
      assert.ok(
        made.summary.easyShare >= EASY_SHARE_TARGET,
        `${input.distance} 편한 비율 ${made.summary.easyShare}`,
      );
    }
  });
});

describe('경고', () => {
  it('주 3회보다 적으면 알려 준다', () => {
    assert.ok(warningIds({ runsPerWeek: 2 }).includes('few-runs'));
    assert.equal(warningIds({ runsPerWeek: 4 }).includes('few-runs'), false);
  });

  it('주 5회를 넘으면 다칠 수 있다고 알려 준다', () => {
    assert.ok(warningIds({ runsPerWeek: 6 }).includes('many-runs'));
  });

  it('기록이 없으면 계획이 대충 잡힌다고 알려 준다', () => {
    assert.ok(warningIds({ weeklyKm: 0, longestRecentKm: undefined }).includes('no-history'));
  });

  it('대회 거리에 비해 너무 짧게 끝나면 알려 준다', () => {
    const ids = warningIds({ distance: 'full', weeksLeft: 6, weeklyKm: 10, longestRecentKm: 5 });
    assert.ok(ids.includes('short-peak'));
  });

  it('처음 달리는 사람이 풀코스를 고르면 짧은 대회를 먼저 권한다', () => {
    const ids = warningIds({ distance: 'full', beginner: true });
    assert.ok(ids.includes('beginner-full'));
  });

  it('경고가 있어도 계획은 언제나 만들어진다', () => {
    const made = plan({ distance: 'full', weeksLeft: 3, weeklyKm: 0, runsPerWeek: 1 });
    assert.ok(made.warnings.length >= 3);
    assert.equal(made.weeks.length, 3);
  });
});

describe('쉬운 말 규칙', () => {
  it('계획 문구에 어려운 말을 쓰지 않는다', () => {
    const forbidden = ['스트릭', 'RPE', '인터벌', '템포런', '테이퍼링', '볼륨', '세션', '컷백', '롱런'];
    const made = plan({ distance: 'full', weeksLeft: 20, runsPerWeek: 6, weeklyKm: 5 });
    const texts = [
      made.distanceLabel,
      made.summary.taperLabel,
      ...made.warnings.map((warning) => warning.text),
      ...made.weeks.flatMap((week) => [
        week.phaseLabel,
        week.note,
        ...week.runs.flatMap((run) => [run.label, run.note]),
      ]),
    ];
    for (const text of texts) {
      for (const word of forbidden) {
        assert.equal(text.includes(word), false, `"${word}"가 "${text}"에 있습니다`);
      }
    }
  });
});

describe('대회 이름에서 거리 짐작하기', () => {
  it('이름에 들어 있는 종목을 읽는다', () => {
    assert.equal(guessRaceDistance('서울 하프마라톤'), 'half');
    assert.equal(guessRaceDistance('춘천 풀코스 대회'), 'full');
    assert.equal(guessRaceDistance('한강 10K 런'), '10k');
    assert.equal(guessRaceDistance('벚꽃 5km 달리기'), '5k');
  });

  it('알 수 없으면 10킬로미터로 둔다(화면에서 바꿀 수 있음)', () => {
    assert.equal(guessRaceDistance('봄맞이 건강달리기'), '10k');
  });
});

describe('최근 4주 기록으로 입력값 만들기', () => {
  const now = Date.parse('2026-07-26T00:00:00Z');

  function activity(daysAgo: number, km: number): ActivityRecord {
    return {
      id: `a${daysAgo}`,
      localUuid: `u${daysAgo}`,
      kind: 'run',
      durationMinutes: Math.round(km * 6),
      distanceKm: km,
      source: 'SELF_LOGGED',
      completedAt: new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
      timezoneId: 'Asia/Seoul',
    };
  }

  it('최근 4주만 세어 주간 거리·횟수·최장 거리를 낸다', () => {
    const summary = recentRunning(
      [activity(1, 5), activity(8, 7), activity(15, 4), activity(40, 20)],
      now,
    );
    assert.equal(summary.longestKm, 7);
    assert.equal(summary.weeklyKm, 4);
    assert.equal(summary.runsPerWeek, 1);
    assert.equal(summary.countedRuns, 3);
    assert.equal(summary.hasData, true);
  });

  it('기록이 없으면 근거가 없다고 알린다', () => {
    const summary = recentRunning([], now);
    assert.equal(summary.hasData, false);
    assert.match(recentRunningNote(summary), /기록이 없어서/);
  });
});
