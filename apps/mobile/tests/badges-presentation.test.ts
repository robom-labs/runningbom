import assert from 'node:assert/strict';
import test from 'node:test';

import {
  badgeCategoryLabels,
  badgeCategoryOrder,
  badgeDefinitions,
  badgeProgressList,
  badgeTierLabels,
  badgeTierOrder,
  calculateStreak,
} from '../domains/badges/rules';
import {
  badgeSections,
  badgeTally,
  earnedDates,
  formatMetricValue,
  hintLabelFor,
  mostRecentEarned,
  nearestBadge,
  newlyEarnedBadges,
  progressLabelFor,
  sortBadgeViews,
  toBadgeView,
} from '../domains/badges/presentation';
import type { ActivityRecord } from '../domains/activities/types';

/**
 * 배지 id는 기기에 저장된 값(AsyncStorage·SQLite badge_progress.badge_id)의 키입니다.
 * 이름·설명·엠블럼을 바꾸더라도 이 목록은 한 글자도 달라지면 안 됩니다.
 * 아래는 이름 개편 이전에 배포되어 있던 48개 id를 그대로 옮겨 적은 것입니다.
 */
const frozenBadgeIds = [
  'first-coach', 'first-run', 'first-interval', 'distance-3k', 'distance-5k', 'distance-10k',
  'first-race-goal', 'first-crew', 'first-post', 'first-cheer',
  'streak-3', 'streak-7', 'streak-14', 'streak-30', 'streak-60', 'streak-100', 'streak-200', 'streak-365',
  'weekly-1', 'weekly-4', 'weekly-12', 'weekly-26', 'weekly-52',
  'run-10', 'run-50', 'run-100', 'ten-k-ten-times',
  'total-distance-10', 'total-distance-50', 'total-distance-100', 'total-distance-250',
  'total-distance-500', 'total-distance-1000',
  'total-minutes-300', 'total-minutes-600', 'total-minutes-1800', 'total-minutes-3600',
  'morning-run-1', 'morning-run-10', 'morning-run-30',
  'night-run-1', 'night-run-10', 'night-run-30',
  'recovery-1', 'recovery-5', 'recovery-20',
  'race-interest-1', 'race-interest-5',
];

/** 이름 개편 이전의 임계값입니다. 이미 받은 사람의 배지가 풀리면 안 되므로 함께 고정합니다. */
const frozenThresholds: Record<string, number> = {
  'first-coach': 1, 'first-run': 1, 'first-interval': 1,
  'distance-3k': 3, 'distance-5k': 5, 'distance-10k': 10,
  'first-race-goal': 1, 'first-crew': 1, 'first-post': 1, 'first-cheer': 1,
  'streak-3': 3, 'streak-7': 7, 'streak-14': 14, 'streak-30': 30,
  'streak-60': 60, 'streak-100': 100, 'streak-200': 200, 'streak-365': 365,
  'weekly-1': 1, 'weekly-4': 4, 'weekly-12': 12, 'weekly-26': 26, 'weekly-52': 52,
  'run-10': 10, 'run-50': 50, 'run-100': 100, 'ten-k-ten-times': 10,
  'total-distance-10': 10, 'total-distance-50': 50, 'total-distance-100': 100,
  'total-distance-250': 250, 'total-distance-500': 500, 'total-distance-1000': 1000,
  'total-minutes-300': 300, 'total-minutes-600': 600,
  'total-minutes-1800': 1800, 'total-minutes-3600': 3600,
  'morning-run-1': 1, 'morning-run-10': 10, 'morning-run-30': 30,
  'night-run-1': 1, 'night-run-10': 10, 'night-run-30': 30,
  'recovery-1': 1, 'recovery-5': 5, 'recovery-20': 20,
  'race-interest-1': 1, 'race-interest-5': 5,
};

function activity(
  index: number,
  overrides: Partial<ActivityRecord> = {},
): ActivityRecord {
  return {
    id: `run-${index}`,
    localUuid: `uuid-${index}`,
    kind: 'run',
    durationMinutes: 30,
    distanceKm: 5,
    source: 'COACH_COMPLETED',
    completedAt: `2026-03-${String(index).padStart(2, '0')}T10:00:00.000Z`,
    timezoneId: 'Asia/Seoul',
    ...overrides,
  };
}

test('배지 id와 임계값은 이름 개편 뒤에도 그대로입니다', () => {
  assert.deepEqual(badgeDefinitions.map((badge) => badge.id), frozenBadgeIds);
  assert.equal(badgeDefinitions.length, 48);
  for (const badge of badgeDefinitions) {
    assert.equal(badge.threshold, frozenThresholds[badge.id], `${badge.id} 임계값이 바뀌었습니다`);
  }
  assert.equal(new Set(frozenBadgeIds).size, frozenBadgeIds.length, 'id가 중복되었습니다');
});

test('모든 배지에 등급과 사람이 읽는 이름·설명이 있습니다', () => {
  for (const badge of badgeDefinitions) {
    assert.ok(badgeTierOrder.includes(badge.tier), `${badge.id} 등급 누락`);
    assert.ok(badge.title.length > 0 && badge.title.length <= 12, `${badge.id} 이름 길이`);
    assert.ok(badge.description.length > badge.title.length, `${badge.id} 설명이 이름보다 짧습니다`);
    assert.notEqual(badge.title, badge.description, `${badge.id} 이름과 설명이 같습니다`);
  }
  // 이름이 서로 겹치면 어느 배지를 받았는지 알 수 없습니다.
  const titles = badgeDefinitions.map((badge) => badge.title);
  assert.equal(new Set(titles).size, titles.length, '배지 이름이 중복되었습니다');
});

test('배지 영역에는 "스트릭" 같은 외래어를 쓰지 않습니다', () => {
  const banned = ['스트릭', '루틴 스트릭', 'K회'];
  const surfaces = [
    ...badgeDefinitions.flatMap((badge) => [badge.title, badge.description]),
    ...Object.values(badgeCategoryLabels),
    ...Object.values(badgeTierLabels),
  ];
  for (const text of surfaces) {
    for (const word of banned) {
      assert.ok(!text.includes(word), `"${text}"에 금지어 ${word}가 있습니다`);
    }
    // 배지 문구는 한글·숫자로만 씁니다. 누구나 읽는 단위 km만 예외로 둡니다.
    // (5K·10K 같은 영문 약어와 "인터벌" 같은 말은 모두 한글 설명으로 풀었습니다.)
    assert.ok(!/[A-Za-z]/.test(text.replaceAll('km', '')), `"${text}"에 영문이 남아 있습니다`);
  }
  assert.equal(badgeCategoryLabels.streak, '연속 기록');
});

test('등급 이름은 동·은·금이 아니라 러닝봄만의 네 단계입니다', () => {
  assert.deepEqual(
    badgeTierOrder.map((tier) => badgeTierLabels[tier]),
    ['씨앗', '새싹', '봉오리', '만개'],
  );
  for (const label of Object.values(badgeTierLabels)) {
    assert.ok(!['동', '은', '금', '브론즈', '실버', '골드'].includes(label));
  }
});

test('진행률 문구는 목표와 현재값을 단위와 함께 보여 줍니다', () => {
  assert.equal(formatMetricValue('total_distance', 6.42), '6.4km');
  assert.equal(formatMetricValue('total_minutes', 45), '45분');
  assert.equal(formatMetricValue('total_minutes', 300), '5시간');
  assert.equal(formatMetricValue('movement_streak', 12), '12일');
  assert.equal(formatMetricValue('weekly_run_weeks', 3), '3주');
  assert.equal(formatMetricValue('run_count', 7), '7회');

  const entry = {
    badge: badgeDefinitions.find((badge) => badge.id === 'distance-10k')!,
    unlocked: false,
    value: 6.4,
    target: 10,
    ratio: 0.64,
  };
  assert.equal(progressLabelFor(entry), '10km 중 6.4km');
  assert.equal(hintLabelFor(entry), '3.6km 더 하면 받아요');

  const serverEntry = {
    badge: badgeDefinitions.find((badge) => badge.id === 'first-post')!,
    unlocked: false,
    value: 0,
    target: 1,
    ratio: 0,
  };
  assert.equal(progressLabelFor(serverEntry), '서버와 연결하면 확인할 수 있어요');
});

test('받은 것 → 진행 중 → 잠긴 것 순으로 정렬합니다', () => {
  const records = [activity(1), activity(2), activity(3, { distanceKm: 11 })];
  const streak = calculateStreak(records);
  const views = badgeProgressList(records, streak).map((entry) => toBadgeView(entry));
  const sorted = sortBadgeViews(views);
  const rank = { earned: 0, progress: 1, locked: 2 } as const;
  for (let index = 1; index < sorted.length; index += 1) {
    assert.ok(
      rank[sorted[index - 1].state] <= rank[sorted[index].state],
      '상태 정렬이 깨졌습니다',
    );
  }
  // 잠긴 배지도 목록에서 사라지지 않아야 다음 목표가 보입니다.
  assert.ok(sorted.some((view) => view.state !== 'earned'));
  assert.equal(sorted.length, badgeDefinitions.length);
});

test('분류 묶음은 전체 배지를 빠짐없이 담습니다', () => {
  const records = [activity(1)];
  const streak = calculateStreak(records);
  const views = badgeProgressList(records, streak).map((entry) => toBadgeView(entry));
  const sections = badgeSections(views);
  assert.equal(
    sections.reduce((total, section) => total + section.views.length, 0),
    badgeDefinitions.length,
  );
  for (const section of sections) {
    assert.ok(badgeCategoryOrder.includes(section.category));
    assert.equal(section.label, badgeCategoryLabels[section.category]);
  }
});

test('아직 하나도 못 받았으면 가장 가까운 배지를 다음 목표로 제안합니다', () => {
  const views = badgeProgressList([], calculateStreak([])).map((entry) => toBadgeView(entry));
  const tally = badgeTally(views);
  assert.equal(tally.earned, 0);
  assert.equal(tally.total, badgeDefinitions.length);
  const next = nearestBadge(views);
  assert.ok(next);
  assert.equal(next?.badge.authority, 'local');
  assert.notEqual(next?.state, 'earned');
});

test('받은 날짜를 기록에서 되짚고 가장 최근 배지를 고릅니다', () => {
  const records = [
    activity(1, { distanceKm: 3.2 }),
    activity(2, { distanceKm: 3.2 }),
    activity(5, { distanceKm: 11 }),
  ];
  const dates = earnedDates(records);
  // 첫 러닝은 첫 기록에서, 10km 배지는 11km를 달린 날에 열립니다.
  assert.equal(dates['first-run'], records[0].completedAt);
  assert.equal(dates['distance-10k'], records[2].completedAt);
  assert.equal(dates['first-post'], undefined);

  const streak = calculateStreak(records);
  const views = badgeProgressList(records, streak).map((entry) =>
    toBadgeView(entry, dates[entry.badge.id]),
  );
  const recent = mostRecentEarned(views, dates);
  assert.equal(recent?.badge.id, 'distance-10k');
  assert.ok(recent?.earnedLabel?.includes('2026'));
});

test('기록이 없으면 되짚기도 비어 있습니다', () => {
  assert.deepEqual(earnedDates([]), {});
});

test('새로 열린 배지만 축하 대상으로 뽑습니다', () => {
  const records = [activity(1)];
  const streak = calculateStreak(records);
  const views = badgeProgressList(records, streak).map((entry) => toBadgeView(entry));
  const earnedIds = views.filter((view) => view.state === 'earned').map((view) => view.badge.id);
  assert.deepEqual(newlyEarnedBadges(earnedIds, views), []);
  const fresh = newlyEarnedBadges(earnedIds.slice(1), views);
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].badge.id, earnedIds[0]);
});
