// 개인 최고 기록(PB) 추정과 개인 기록 산출 규칙을 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatClockFromMinutes,
  personalBestDefinitions,
  personalBestSummary,
  personalBests,
  personalRecords,
} from '../domains/activities/personalBests';
import type { ActivityRecord } from '../domains/activities/types';

function activity(
  id: string,
  completedAt: string,
  overrides: Partial<ActivityRecord> = {},
): ActivityRecord {
  return {
    id,
    localUuid: 'local-test',
    kind: 'run',
    durationMinutes: 30,
    source: 'COACH_COMPLETED',
    completedAt,
    timezoneId: 'Asia/Seoul',
    ...overrides,
  };
}

describe('구간 최고 기록 추정', () => {
  it('허용 오차 범위가 목표 거리를 감싸고 구간끼리 겹치지 않는다', () => {
    for (const definition of personalBestDefinitions) {
      assert.ok(definition.minKm < definition.targetKm);
      assert.ok(definition.maxKm > definition.targetKm);
    }
    assert.deepEqual(
      personalBestDefinitions.map((definition) => definition.key),
      ['5K', '10K', 'half', 'full'],
    );
    for (let index = 1; index < personalBestDefinitions.length; index += 1) {
      const previous = personalBestDefinitions[index - 1]!;
      const current = personalBestDefinitions[index]!;
      assert.ok(previous.maxKm < current.minKm, `${previous.key}와 ${current.key} 범위 겹침`);
    }
  });

  it('허용 오차 범위 밖의 거리는 후보로 쓰지 않는다', () => {
    const values = personalBests([
      activity('too-short', '2026-07-01T00:00:00.000Z', {
        distanceKm: 4.5,
        durationMinutes: 20,
      }),
      activity('too-long', '2026-07-02T00:00:00.000Z', {
        distanceKm: 5.8,
        durationMinutes: 26,
      }),
    ]);
    assert.equal(values.length, 0);
  });

  it('범위 안 활동은 페이스로 환산하고 추정임을 라벨로 밝힌다', () => {
    const values = personalBests([
      activity('near-5k', '2026-07-03T00:00:00.000Z', {
        distanceKm: 5.2,
        durationMinutes: 26,
      }),
    ]);
    const best = values[0]!;
    assert.equal(best.key, '5K');
    assert.equal(best.exact, false);
    // 5.2km / 26분 = 5분/km → 5K 환산 25분
    assert.equal(best.estimatedMinutes, 25);
    assert.equal(best.timeLabel, '25:00');
    assert.ok(best.accuracyLabel.includes('추정값'));
    assert.ok(best.rangeLabel.includes('4.7~5.5km'));
  });

  it('거리가 목표와 거의 같으면 실측에 가깝다고 표시한다', () => {
    const best = personalBests([
      activity('exact-10k', '2026-07-04T00:00:00.000Z', {
        distanceKm: 10,
        durationMinutes: 50,
      }),
    ])[0]!;
    assert.equal(best.key, '10K');
    assert.equal(best.exact, true);
    assert.equal(best.timeLabel, '50:00');
    assert.ok(!best.accuracyLabel.includes('추정값'));
  });

  it('같은 구간에서는 가장 빠른 페이스를 고른다', () => {
    const best = personalBests([
      activity('slow', '2026-07-05T00:00:00.000Z', { distanceKm: 5, durationMinutes: 30 }),
      activity('fast', '2026-07-06T00:00:00.000Z', { distanceKm: 5, durationMinutes: 24 }),
    ])[0]!;
    assert.equal(best.activityId, 'fast');
    assert.equal(best.timeLabel, '24:00');
  });

  it('걷기나 거리 없는 기록은 구간 추정에 쓰지 않는다', () => {
    assert.equal(
      personalBests([
        activity('walk', '2026-07-07T00:00:00.000Z', {
          kind: 'walk',
          distanceKm: 5,
          durationMinutes: 40,
        }),
        activity('no-distance', '2026-07-08T00:00:00.000Z', { durationMinutes: 40 }),
      ]).length,
      0,
    );
  });

  it('하프·풀은 시간 표기를 시:분:초로 낸다', () => {
    const values = personalBests([
      activity('half', '2026-07-09T00:00:00.000Z', { distanceKm: 21, durationMinutes: 105 }),
      activity('full', '2026-07-10T00:00:00.000Z', { distanceKm: 42, durationMinutes: 240 }),
    ]);
    assert.equal(values.length, 2);
    assert.ok(values[0]?.timeLabel.includes(':'));
    assert.equal(formatClockFromMinutes(125), '2:05:00');
    assert.equal(formatClockFromMinutes(0), '기록 부족');
  });
});

describe('개인 기록', () => {
  const records = [
    activity('a', '2026-07-13T12:00:00.000Z', { distanceKm: 12, durationMinutes: 70 }),
    activity('b', '2026-07-14T12:00:00.000Z', { distanceKm: 5, durationMinutes: 30 }),
    activity('c', '2026-07-15T12:00:00.000Z', { distanceKm: 8, durationMinutes: 100 }),
    activity('d', '2026-07-22T12:00:00.000Z', { distanceKm: 6, durationMinutes: 35 }),
  ];

  it('최장 거리·최장 시간·주간 최다 횟수를 낸다', () => {
    const values = personalRecords(records);
    const byKey = new Map(values.map((value) => [value.key, value]));
    assert.equal(byKey.get('longestDistance')?.valueLabel, '12.0km');
    assert.equal(byKey.get('longestDuration')?.valueLabel, '100분');
    assert.equal(byKey.get('busiestWeek')?.valueLabel, '3회');
    assert.equal(byKey.get('busiestWeek')?.detail, '2026-07-13 주간');
  });

  it('기록이 없으면 빈 목록과 hasAny=false를 준다', () => {
    const summary = personalBestSummary([]);
    assert.deepEqual(summary.bests, []);
    assert.deepEqual(summary.records, []);
    assert.equal(summary.paceSampleCount, 0);
    assert.equal(summary.hasAny, false);
  });

  it('구간 후보가 없어도 개인 기록만으로 카드를 채울 수 있다', () => {
    const summary = personalBestSummary([
      activity('only-walk', '2026-07-20T12:00:00.000Z', {
        kind: 'walk',
        durationMinutes: 45,
      }),
    ]);
    assert.equal(summary.bests.length, 0);
    assert.equal(summary.records.length, 2);
    assert.equal(summary.hasAny, true);
  });
});
