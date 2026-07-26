// 기록·통계의 월별 추이, 활동 필터, 평균 페이스, 오늘의 추천 규칙을 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  averagePaceMinutesPerKm,
  defaultActivityListFilter,
  filterActivities,
  formatPace,
  monthlyTrend,
  suggestTodayRun,
  trendMetricLabels,
} from '../domains/activities/trend';
import type { ActivityRecord } from '../domains/activities/types';

const NOW = Date.parse('2026-07-26T03:00:00Z'); // KST 2026-07-26 12:00

function activity(completedAt: string, overrides: Partial<ActivityRecord> = {}): ActivityRecord {
  return {
    id: completedAt,
    localUuid: 'local-test',
    kind: 'run',
    durationMinutes: 30,
    source: 'COACH_COMPLETED',
    completedAt,
    timezoneId: 'Asia/Seoul',
    ...overrides,
  };
}

describe('월별 추이', () => {
  const activities = [
    activity('2026-07-20T09:00:00+09:00', { durationMinutes: 40, distanceKm: 8 }),
    activity('2026-07-05T09:00:00+09:00', { durationMinutes: 20, distanceKm: 4 }),
    activity('2026-06-10T09:00:00+09:00', { durationMinutes: 30, distanceKm: 6 }),
  ];

  it('이번 달을 포함해 요청한 개월 수만큼 자리를 만든다', () => {
    const points = monthlyTrend(activities, 'sessions', 6, NOW);
    assert.equal(points.length, 6);
    assert.deepEqual(
      points.map((point) => point.month),
      ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'],
    );
    assert.equal(points.at(-1)?.isCurrent, true);
    assert.equal(points[0]?.isCurrent, false);
    assert.equal(points.at(-1)?.label, '7월');
  });

  it('막대 비율은 최댓값 기준 0~1이고 기록 없는 달은 0이다', () => {
    const points = monthlyTrend(activities, 'sessions', 6, NOW);
    assert.equal(points.at(-1)?.value, 2); // 7월 2회
    assert.equal(points.at(-2)?.value, 1); // 6월 1회
    assert.equal(points.at(-1)?.ratio, 1);
    assert.equal(points.at(-2)?.ratio, 0.5);
    assert.equal(points[0]?.ratio, 0);
    for (const point of points) {
      assert.ok(point.ratio >= 0 && point.ratio <= 1);
    }
  });

  it('기록이 전혀 없어도 0으로 안전하게 그린다', () => {
    const points = monthlyTrend([], 'distance', 6, NOW);
    assert.equal(points.length, 6);
    assert.ok(points.every((point) => point.value === 0 && point.ratio === 0));
  });

  it('지표를 바꾸면 값이 달라진다', () => {
    assert.equal(monthlyTrend(activities, 'minutes', 3, NOW).at(-1)?.value, 60);
    assert.equal(monthlyTrend(activities, 'distance', 3, NOW).at(-1)?.value, 12);
    assert.equal(Object.keys(trendMetricLabels).length, 3);
  });

  it('연도를 넘어가도 월이 이어진다', () => {
    const points = monthlyTrend([], 'sessions', 3, Date.parse('2026-01-15T03:00:00Z'));
    assert.deepEqual(
      points.map((point) => point.month),
      ['2025-11', '2025-12', '2026-01'],
    );
  });
});

describe('활동 목록 필터', () => {
  const activities = [
    activity('2026-07-25T09:00:00+09:00', { kind: 'run' }),
    activity('2026-07-10T09:00:00+09:00', { kind: 'walk' }),
    activity('2026-06-20T09:00:00+09:00', { kind: 'recovery' }),
  ];

  it('기본값은 전체·전체다', () => {
    assert.deepEqual(defaultActivityListFilter, { kind: '전체', period: '전체' });
    assert.equal(filterActivities(activities, defaultActivityListFilter, NOW).length, 3);
  });

  it('유형으로 거른다', () => {
    assert.equal(filterActivities(activities, { kind: 'run', period: '전체' }, NOW).length, 1);
    assert.equal(filterActivities(activities, { kind: 'walk', period: '전체' }, NOW).length, 1);
  });

  it('기간으로 거른다', () => {
    assert.equal(filterActivities(activities, { kind: '전체', period: '최근 7일' }, NOW).length, 1);
    assert.equal(filterActivities(activities, { kind: '전체', period: '최근 30일' }, NOW).length, 2);
    assert.equal(filterActivities(activities, { kind: '전체', period: '이번 달' }, NOW).length, 2);
  });

  it('유형과 기간을 함께 적용한다', () => {
    assert.equal(filterActivities(activities, { kind: 'walk', period: '최근 7일' }, NOW).length, 0);
    assert.equal(filterActivities(activities, { kind: 'walk', period: '이번 달' }, NOW).length, 1);
  });
});

describe('평균 페이스', () => {
  it('거리와 시간이 모두 있는 기록만 쓴다', () => {
    const pace = averagePaceMinutesPerKm([
      activity('2026-07-25T09:00:00+09:00', { durationMinutes: 30, distanceKm: 6 }),
      activity('2026-07-24T09:00:00+09:00', { durationMinutes: 30 }), // 거리 없음 → 제외
    ]);
    assert.equal(pace, 5);
    assert.equal(formatPace(pace), "5'00\"/km");
  });

  it('거리 기록이 없으면 지어내지 않는다', () => {
    assert.equal(averagePaceMinutesPerKm([activity('2026-07-25T09:00:00+09:00')]), undefined);
    assert.equal(averagePaceMinutesPerKm([]), undefined);
    assert.equal(formatPace(undefined), '기록 부족');
    assert.equal(formatPace(0), '기록 부족');
  });

  it('초 단위를 두 자리로 맞춘다', () => {
    assert.equal(formatPace(5.5), "5'30\"/km");
    assert.equal(formatPace(6.1), "6'06\"/km");
  });
});

describe('오늘의 추천 러닝', () => {
  it('오늘 이미 기록이 있으면 더 밀어붙이지 않는다', () => {
    const suggestion = suggestTodayRun([activity('2026-07-26T08:00:00+09:00')], 30, NOW);
    assert.equal(suggestion.tone, 'rest');
  });

  it('최근 7일 중 5일 이상 움직였으면 휴식을 제안한다', () => {
    const busy = ['21', '22', '23', '24', '25'].map((day) =>
      activity(`2026-07-${day}T09:00:00+09:00`),
    );
    const suggestion = suggestTodayRun(busy, 40, NOW);
    assert.equal(suggestion.tone, 'rest');
    assert.ok(suggestion.minutes < 40);
  });

  it('어제 달렸으면 더 짧고 편한 러닝을 제안한다', () => {
    const suggestion = suggestTodayRun([activity('2026-07-25T09:00:00+09:00')], 40, NOW);
    assert.equal(suggestion.tone, 'easy');
    assert.ok(suggestion.minutes < 40);
  });

  it('최근 기록이 없으면 짧게 다시 시작하도록 제안한다', () => {
    const suggestion = suggestTodayRun([], 40, NOW);
    assert.equal(suggestion.tone, 'easy');
    assert.ok(suggestion.minutes < 40);
  });

  it('추천 시간은 언제나 10~120분 사이의 안전한 범위다', () => {
    const cases: ActivityRecord[][] = [
      [],
      [activity('2026-07-25T09:00:00+09:00')],
      [activity('2026-07-22T09:00:00+09:00'), activity('2026-07-23T09:00:00+09:00')],
      ['21', '22', '23', '24', '25'].map((day) => activity(`2026-07-${day}T09:00:00+09:00`)),
    ];
    for (const fallback of [1, 30, 600]) {
      for (const activities of cases) {
        const suggestion = suggestTodayRun(activities, fallback, NOW);
        assert.ok(
          suggestion.minutes >= 10 && suggestion.minutes <= 120,
          `추천 ${suggestion.minutes}분이 범위를 벗어났습니다`,
        );
        assert.ok(suggestion.title.trim().length > 0);
        assert.ok(suggestion.body.trim().length > 0);
      }
    }
  });
});
