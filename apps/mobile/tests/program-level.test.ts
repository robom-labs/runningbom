// 수준 판정이 안전한 쪽으로 기울어지는지 검사합니다.
// 이 규칙이 무너지면 초보에게 하프·마라톤 계획이 추천됩니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ActivityRecord } from '../domains/activities/types';
import {
  capabilityFromActivities,
  decideLevel,
  isAtLeast,
  levelFromCapability,
  levelLabels,
  levelOrder,
  levelRank,
  selfPickLevels,
} from '../domains/programs/level';

const NOW = new Date('2026-07-27T09:00:00+09:00');

function activity(
  daysAgo: number,
  durationMinutes: number,
  distanceKm?: number,
  kind: ActivityRecord['kind'] = 'run',
): ActivityRecord {
  const at = new Date(NOW.getTime() - daysAgo * 86_400_000);
  return {
    id: `a-${daysAgo}-${durationMinutes}`,
    localUuid: `u-${daysAgo}-${durationMinutes}`,
    kind,
    durationMinutes,
    ...(distanceKm === undefined ? {} : { distanceKm }),
    source: 'COACH_COMPLETED',
    completedAt: at.toISOString(),
    timezoneId: 'Asia/Seoul',
  };
}

describe('수준 목록', () => {
  it('열 단계가 낮은 순서로 정렬돼 있다', () => {
    assert.equal(levelOrder.length, 10);
    assert.equal(levelRank('L0_MOVE'), 0);
    assert.equal(levelRank('L9_ADVANCED'), 9);
    assert.ok(levelRank('L4_5K') < levelRank('L5_10K'));
  });

  it('모든 단계에 쉬운 한국어 설명이 있다', () => {
    for (const level of levelOrder) {
      assert.ok(levelLabels[level] && levelLabels[level].length > 0);
      // 화면에 코드가 새어 나가면 안 됩니다.
      assert.ok(!levelLabels[level].includes('L'));
    }
  });

  it('사용자가 직접 고르는 항목은 열 개를 다 보여 주지 않는다', () => {
    assert.ok(selfPickLevels.length <= 6);
    for (const level of selfPickLevels) assert.ok(levelOrder.includes(level));
  });
});

describe('기록에서 재료 뽑기', () => {
  it('기록이 없으면 0이 아니라 모름으로 둔다', () => {
    const capability = capabilityFromActivities([], NOW);
    assert.equal(capability.longestRecentMinutes, undefined);
    assert.equal(capability.recentWeeklyKm, undefined);
    // 0으로 채우면 "0km 달린 사람"과 "기록이 없는 사람"을 구분할 수 없습니다.
  });

  it('28일보다 오래된 기록은 최근으로 세지 않는다', () => {
    const capability = capabilityFromActivities([activity(60, 45, 8)], NOW);
    assert.equal(capability.longestRecentMinutes, undefined);
    // 마지막으로 달린 시점은 알 수 있어야 합니다.
    assert.ok((capability.weeksSinceLastRun ?? 0) > 8);
  });

  it('걷기 기록을 "이어서 달린 시간"으로 세지 않는다', () => {
    const capability = capabilityFromActivities([activity(3, 60, 5, 'walk')], NOW);
    assert.equal(capability.longestRecentMinutes, undefined);
  });

  it('최근 기록에서 가장 긴 시간·거리를 찾는다', () => {
    const capability = capabilityFromActivities(
      [activity(3, 20, 3), activity(10, 45, 8), activity(20, 30, 5)],
      NOW,
    );
    assert.equal(capability.longestRecentMinutes, 45);
    assert.equal(capability.longestRecentKm, 8);
  });
});

describe('기록으로 수준 판단', () => {
  it('재료가 전혀 없으면 판단하지 않는다', () => {
    assert.equal(levelFromCapability({}), undefined);
  });

  it('10분 달린 사람은 10분 단계다', () => {
    assert.equal(levelFromCapability({ longestRecentMinutes: 12 }), 'L2_RUN_10');
  });

  it('5km를 달렸으면 5K 단계다', () => {
    assert.equal(levelFromCapability({ longestRecentKm: 5.2 }), 'L4_5K');
  });

  it('한 번 길게 달렸다고 하프 단계를 열지 않는다', () => {
    // 20km를 한 번 달렸지만 주간 거리와 횟수가 없으면 하프로 보지 않습니다.
    const level = levelFromCapability({ longestRecentKm: 20 });
    assert.notEqual(level, 'L6_HALF');
    assert.equal(level, 'L5_10K');
  });

  it('꾸준한 주간 거리까지 있어야 하프 단계를 연다', () => {
    assert.equal(
      levelFromCapability({ longestRecentKm: 20, recentWeeklyKm: 35, recentRunsPerWeek: 3 }),
      'L6_HALF',
    );
  });
});

describe('최종 수준 결정', () => {
  it('기록도 선택도 없으면 가장 편한 단계부터 안내한다', () => {
    const decision = decideLevel(undefined, {});
    assert.equal(decision.level, 'L0_MOVE');
    assert.equal(decision.loweredForSafety, false);
  });

  it('스스로 높게 골라도 기록이 낮으면 낮은 쪽을 쓴다', () => {
    // 이게 이 파일에서 가장 중요한 규칙입니다.
    // 4km / 28분은 아직 5K 완주가 아닙니다. 엔진은 그보다 아래로 봅니다.
    const decision = decideLevel('L6_HALF', { longestRecentKm: 4, longestRecentMinutes: 28 });
    assert.equal(decision.level, 'L3_RUN_30');
    assert.equal(decision.loweredForSafety, true);
    assert.ok(decision.reason.includes('무리하지 않게'));
  });

  it('겸손하게 낮게 고르면 그 선택을 존중한다', () => {
    // 기록은 10K인데 본인이 5K라고 골랐다면 밀어붙이지 않습니다.
    const decision = decideLevel('L4_5K', {
      longestRecentKm: 12,
      recentWeeklyKm: 25,
      recentRunsPerWeek: 3,
    });
    assert.equal(decision.level, 'L4_5K');
    assert.equal(decision.loweredForSafety, false);
  });

  it('기록만 있으면 기록을 따른다', () => {
    const decision = decideLevel(undefined, { longestRecentMinutes: 25 });
    assert.equal(decision.level, 'L3_RUN_30');
  });

  it('기록이 없으면 하프 이상을 스스로 열 수 없다', () => {
    // 다치는 쪽은 되돌릴 수 없고, 며칠 기다리는 쪽은 되돌릴 수 있습니다.
    for (const pick of selfPickLevels) {
      const decision = decideLevel(pick, {});
      assert.ok(!isAtLeast(decision.level, 'L6_HALF'), `${pick} -> ${decision.level}`);
    }
    const performance = decideLevel('L8_PERFORMANCE', {});
    assert.equal(performance.level, 'L5_10K');
    assert.equal(performance.loweredForSafety, true);
    assert.ok(performance.reason.includes('바로 올라가요'));
  });

  it('기록이 쌓이면 높은 단계가 실제로 열린다', () => {
    // 위 제한이 "영원히 막는다"가 되면 안 됩니다.
    const decision = decideLevel('L8_PERFORMANCE', {
      longestRecentKm: 20,
      recentWeeklyKm: 35,
      recentRunsPerWeek: 3,
    });
    assert.equal(decision.level, 'L6_HALF');
  });
});
