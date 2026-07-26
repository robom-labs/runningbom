// 드로어 라우팅, 대회 집계, 배지 다종화, 캘린더 집계의 순수 규칙을 회귀 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { activityCalendarMonth, intensityForMinutes } from '../domains/activities/calendar';
import { parseRunPlan, plansByDate, upcomingPlans } from '../domains/activities/plans';
import {
  recentWeeklyAverage,
  totalsForMonth,
  totalsForWeek,
  weekStartKey,
} from '../domains/activities/summary';
import type { ActivityRecord } from '../domains/activities/types';
import {
  badgeCategoryOrder,
  badgeDefinitions,
  badgeProgressList,
  calculateStreak,
  unlockedBadges,
} from '../domains/badges/rules';
import {
  currentWeekProgress,
  recommendWeeklyGoal,
  weeklyGoalProgress,
} from '../domains/badges/goals';
import {
  countRaces,
  filterRaceGroups,
  findGroupByRaceId,
  formatDDay,
  groupRaces,
  normalizeRaceName,
} from '../domains/races/aggregate';
import { menuGroups, routeFromStoredValue, routeTitles } from '../app/navigation/routes';
import type { Race } from '../src/types';

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

function race(id: string, overrides: Partial<Race> = {}): Race {
  return {
    id,
    name: '2026 봄빛 마라톤',
    region: '서울',
    venue: '여의도 한강공원',
    raceDate: '2026-09-20',
    distances: ['10K'],
    registrationOpensAt: '2026-08-01T10:00:00+09:00',
    registrationTimeConfirmed: true,
    sourceName: '마라톤GO',
    ...overrides,
  };
}

describe('대회 집계는 대회 기준 1건', () => {
  it('같은 대회의 5K·10K 행은 카드 하나로 합쳐지고 개수도 1이다', () => {
    const values = [
      race('spring-race-10k', { distances: ['10K'] }),
      race('spring-race-5k', { name: '2026 봄빛 마라톤 5K', distances: ['5K'] }),
    ];
    const groups = groupRaces(values);
    assert.equal(groups.length, 1);
    assert.equal(countRaces(values), 1);
    assert.deepEqual(groups[0]?.distances, ['5K', '10K']);
    assert.equal(groups[0]?.raceIds.length, 2);
  });

  it('날짜나 지역이 다르면 별개 대회로 센다', () => {
    const values = [
      race('a'),
      race('b', { raceDate: '2026-10-04' }),
      race('c', { region: '부산' }),
    ];
    assert.equal(countRaces(values), 3);
  });

  it('같은 id가 중복으로 들어와도 한 번만 센다', () => {
    assert.equal(countRaces([race('dup'), race('dup')]), 1);
  });

  it('대회명에서 종목 표기를 걷어내 같은 대회를 인식한다', () => {
    assert.equal(normalizeRaceName('2026 봄빛 마라톤 10K'), normalizeRaceName('2026 봄빛 마라톤'));
    assert.equal(normalizeRaceName('봄빛 마라톤 (하프)'), normalizeRaceName('봄빛 마라톤'));
  });

  it('딥링크로 들어온 종목 id로도 대회 카드를 찾는다', () => {
    const groups = groupRaces([
      race('spring-race-10k'),
      race('spring-race-5k', { distances: ['5K'] }),
    ]);
    assert.equal(findGroupByRaceId(groups, 'spring-race-5k')?.raceIds.length, 2);
    assert.equal(findGroupByRaceId(groups, 'unknown'), undefined);
  });

  it('지역·거리·검색 필터가 대회 단위로 동작한다', () => {
    const groups = groupRaces([race('a'), race('b', { region: '부산', id: 'b' })]);
    const filtered = filterRaceGroups(groups, {
      region: '부산',
      distance: '전체',
      registration: '전체',
      period: '전체',
      query: '',
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.region, '부산');
  });

  it('D-day 배지를 한국 날짜 기준으로 만든다', () => {
    const now = Date.parse('2026-09-18T03:00:00Z');
    assert.equal(formatDDay('2026-09-20', now), 'D-2');
    assert.equal(formatDDay('2026-09-18', now), 'D-DAY');
  });
});

describe('배지 다종화', () => {
  const records = [
    activity('2026-07-20T22:30:00.000Z', { distanceKm: 10, durationMinutes: 60 }),
    activity('2026-07-21T22:30:00.000Z', { distanceKm: 5, durationMinutes: 30 }),
    activity('2026-07-22T00:30:00.000Z', { kind: 'recovery', durationMinutes: 20 }),
  ];
  const streak = calculateStreak(records, new Date('2026-07-22T12:00:00.000Z'));

  it('모든 배지 정의에 카테고리가 있다', () => {
    for (const badge of badgeDefinitions) {
      assert.ok(badgeCategoryOrder.includes(badge.category), `${badge.id} 카테고리 누락`);
    }
  });

  it('누적 거리·시간·시간대·회복 배지를 각각 계산한다', () => {
    const unlocked = unlockedBadges(records, streak).map((badge) => badge.id);
    assert.ok(unlocked.includes('total-distance-10'));
    assert.ok(unlocked.includes('recovery-1'));
    assert.ok(unlocked.includes('morning-run-1'));
    assert.ok(unlocked.includes('distance-10k'));
    assert.ok(!unlocked.includes('total-distance-100'));
  });

  it('대회 관심 배지는 관심 저장 수를 문맥으로 받는다', () => {
    assert.ok(
      !unlockedBadges(records, streak)
        .map((badge) => badge.id)
        .includes('race-interest-1'),
    );
    assert.ok(
      unlockedBadges(records, streak, { interestedRaceCount: 2 })
        .map((badge) => badge.id)
        .includes('race-interest-1'),
    );
  });

  it('미획득 배지는 진행률을 0과 1 사이로 알려 준다', () => {
    const progress = badgeProgressList(records, streak);
    const target = progress.find((entry) => entry.badge.id === 'total-distance-100');
    assert.equal(target?.unlocked, false);
    assert.ok((target?.ratio ?? 0) > 0 && (target?.ratio ?? 0) < 1);
    const serverBadge = progress.find((entry) => entry.badge.id === 'first-post');
    assert.equal(serverBadge?.unlocked, false);
  });
});

describe('주간 목표', () => {
  it('기록이 없으면 무리하지 않는 작은 목표를 제안한다', () => {
    const goal = recommendWeeklyGoal([], new Date('2026-07-22T12:00:00.000Z'));
    assert.equal(goal.metric, 'sessions');
    assert.equal(goal.target, 2);
  });

  it('최근 4주 평균보다 크게 늘리지 않는다', () => {
    const now = new Date('2026-07-22T12:00:00.000Z');
    const records = [
      activity('2026-07-14T12:00:00.000Z'),
      activity('2026-07-15T12:00:00.000Z'),
      activity('2026-07-16T12:00:00.000Z'),
    ];
    const average = recentWeeklyAverage(records, now);
    assert.equal(average.measuredWeeks, 1);
    const goal = recommendWeeklyGoal(records, now);
    assert.ok(goal.target <= average.sessions + 1);
  });

  it('목표 달성 여부와 남은 양을 계산한다', () => {
    const progress = weeklyGoalProgress(
      { metric: 'sessions', target: 3, auto: false },
      { sessions: 2, minutes: 60, distanceKm: 8, activeDays: 2 },
    );
    assert.equal(progress.met, false);
    assert.equal(progress.label, '2회 / 3회');
    assert.ok(progress.remainingLabel.includes('1회'));

    const current = currentWeekProgress(
      [activity(new Date().toISOString())],
      { metric: 'sessions', target: 1, auto: false },
    );
    assert.equal(current.met, true);
  });
});

describe('캘린더 집계', () => {
  it('날짜별 활동을 합산하고 강도를 계산한다', () => {
    const values = activityCalendarMonth(
      [
        activity('2026-07-15T01:00:00.000Z', { durationMinutes: 30, distanceKm: 5 }),
        activity('2026-07-15T10:00:00.000Z', { durationMinutes: 20, distanceKm: 3 }),
      ],
      new Date('2026-07-01T12:00:00.000Z'),
    );
    const day = values.find((value) => value.key === '2026-07-15');
    assert.equal(day?.activities.length, 2);
    assert.equal(day?.totalMinutes, 50);
    assert.equal(day?.distanceKm, 8);
    assert.equal(day?.intensity, 2);
    assert.equal(intensityForMinutes(0), 0);
    assert.equal(intensityForMinutes(90), 3);
  });

  it('예정 일정을 해당 날짜 칸에 붙인다', () => {
    const plan = {
      id: 'plan-1',
      date: '2026-07-18',
      kind: 'run' as const,
      title: '아침 5K',
      createdAt: '2026-07-10T00:00:00.000Z',
    };
    const values = activityCalendarMonth([], new Date('2026-07-01T12:00:00.000Z'), [plan]);
    assert.equal(values.find((value) => value.key === '2026-07-18')?.plans.length, 1);
    assert.equal(plansByDate([plan]).get('2026-07-18')?.length, 1);
    assert.equal(upcomingPlans([plan], '2026-07-01').length, 1);
    assert.equal(upcomingPlans([plan], '2026-07-19').length, 0);
  });

  it('일정 입력값을 검증한다', () => {
    assert.equal(
      parseRunPlan({ date: '2026-13-40', kind: 'run', title: '', minutesText: '', distanceText: '' }).ok,
      false,
    );
    const parsed = parseRunPlan({
      date: '2026-08-01',
      kind: 'run',
      title: '  주말 롱런  ',
      minutesText: '60',
      distanceText: '10',
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.value.title, '주말 롱런');
      assert.equal(parsed.value.targetMinutes, 60);
      assert.equal(parsed.value.targetDistanceKm, 10);
    }
  });

  it('주간·월간 합계를 한국 날짜 기준으로 낸다', () => {
    const records = [
      activity('2026-07-13T23:00:00.000Z', { durationMinutes: 40, distanceKm: 6 }),
      activity('2026-07-16T02:00:00.000Z', { durationMinutes: 20, distanceKm: 3 }),
    ];
    const week = totalsForWeek(records, weekStartKey('2026-07-15'));
    assert.equal(week.sessions, 2);
    assert.equal(week.minutes, 60);
    assert.equal(week.distanceKm, 9);
    assert.equal(totalsForMonth(records, '2026-07').sessions, 2);
    assert.equal(totalsForMonth(records, '2026-08').sessions, 0);
  });
});

describe('드로어 라우팅', () => {
  it('메뉴 항목이 모두 실제 라우트를 가리킨다', () => {
    for (const group of menuGroups) {
      for (const item of group.items) {
        assert.ok(routeTitles[item.key], `${item.key} 제목 누락`);
      }
    }
  });

  it('프로필을 뺀 주요·시스템 메뉴가 모두 노출된다', () => {
    const keys = menuGroups.flatMap((group) => group.items.map((item) => item.key));
    for (const key of ['home', 'start', 'calendar', 'races', 'shoes', 'community', 'stats'] as const) {
      assert.ok(keys.includes(key), `${key} 메뉴 누락`);
    }
    assert.ok(keys.includes('settings'));
    assert.ok(keys.includes('help'));
  });

  it('예전 하단 탭 값도 새 라우트로 복원한다', () => {
    assert.equal(routeFromStoredValue('마이'), 'stats');
    assert.equal(routeFromStoredValue('탐색'), 'races');
    assert.equal(routeFromStoredValue('calendar'), 'calendar');
    assert.equal(routeFromStoredValue(undefined), 'home');
    assert.equal(routeFromStoredValue('없는값'), 'home');
  });
});
