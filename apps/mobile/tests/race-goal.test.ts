// 목표 대회 D-day, 대회 빠른 필터·정렬·달력 뷰의 순수 규칙을 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyQuickFilters,
  buildRaceCalendarMonth,
  countRaces,
  formatRaceFeedRevision,
  formatRaceVerification,
  groupRaces,
  raceGroupLinkStatus,
  raceCountsByDay,
  raceMonthBuckets,
  raceQuickFilters,
  raceSorts,
  sortRaceGroups,
  weekendRange,
} from '../domains/races/aggregate';
import {
  isRegistrationClosingSoon,
  registrationCountdownLabel,
} from '../src/races';
import {
  GOAL_RACE_KEY,
  goalRaceChecklist,
  goalRaceCountdown,
  goalRacePhase,
  goalRacePhaseLabels,
  isGoalRace,
  type GoalRace,
} from '../domains/races/goalRace';
import type { Race } from '../src/types';

// 2026-07-26은 일요일입니다. 아래 테스트의 '오늘' 기준입니다.
const NOW = Date.parse('2026-07-26T03:00:00Z');

function race(id: string, overrides: Partial<Race> = {}): Race {
  return {
    id,
    name: `${id} 마라톤`,
    region: '서울',
    venue: '여의도 한강공원',
    raceDate: '2026-09-20',
    distances: ['10K'],
    registrationOpensAt: '2026-06-01T10:00:00+09:00',
    registrationTimeConfirmed: true,
    sourceName: '마라톤GO',
    ...overrides,
  };
}

function goal(overrides: Partial<GoalRace> = {}): GoalRace {
  return {
    raceId: 'spring-10k',
    groupKey: 'spring|2026-09-20|서울',
    name: '봄빛 마라톤',
    raceDate: '2026-09-20',
    region: '서울',
    savedAt: '2026-07-26T00:00:00.000Z',
    ...overrides,
  };
}

describe('목표 대회 D-day 계산', () => {
  it('오늘·미래·과거 대회의 D-day를 정확히 센다', () => {
    assert.equal(goalRaceCountdown('2026-07-26', NOW).dDayLabel, 'D-DAY');
    assert.equal(goalRaceCountdown('2026-07-26', NOW).days, 0);
    assert.equal(goalRaceCountdown('2026-07-27', NOW).dDayLabel, 'D-1');
    assert.equal(goalRaceCountdown('2026-09-20', NOW).days, 56);
    assert.equal(goalRaceCountdown('2026-09-20', NOW).dDayLabel, 'D-56');
    assert.equal(goalRaceCountdown('2026-07-19', NOW).dDayLabel, 'D+7');
    assert.equal(goalRaceCountdown('2026-07-19', NOW).days, -7);
  });

  it('남은 주차를 올림으로 계산하고 지난 대회는 0주로 둔다', () => {
    assert.equal(goalRaceCountdown('2026-08-09', NOW).weeks, 2); // 14일
    assert.equal(goalRaceCountdown('2026-08-10', NOW).weeks, 3); // 15일 → 3주차
    assert.equal(goalRaceCountdown('2026-07-26', NOW).weeks, 0);
    assert.equal(goalRaceCountdown('2026-07-01', NOW).weeks, 0);
  });

  it('남은 기간 안내 문구가 상황별로 달라진다', () => {
    assert.match(goalRaceCountdown('2026-07-26', NOW).remainingLabel, /오늘이 대회 날/);
    assert.match(goalRaceCountdown('2026-07-30', NOW).remainingLabel, /4일 남았어요/);
    assert.match(goalRaceCountdown('2026-09-20', NOW).remainingLabel, /약 8주 남았어요/);
    assert.match(goalRaceCountdown('2026-07-20', NOW).remainingLabel, /6일 지났어요/);
  });

  it('남은 기간에 따라 준비 단계가 바뀐다', () => {
    assert.equal(goalRacePhase(90), 'base');
    assert.equal(goalRacePhase(56), 'build');
    assert.equal(goalRacePhase(28), 'sharpen');
    assert.equal(goalRacePhase(14), 'taper');
    assert.equal(goalRacePhase(7), 'raceWeek');
    assert.equal(goalRacePhase(0), 'raceDay');
    assert.equal(goalRacePhase(-1), 'past');
    for (const label of Object.values(goalRacePhaseLabels)) {
      assert.ok(label.trim().length > 0);
    }
  });

  it('모든 단계에 준비 체크리스트가 있고 항목 id가 겹치지 않는다', () => {
    for (const date of ['2026-12-01', '2026-09-01', '2026-08-15', '2026-08-05', '2026-07-29', '2026-07-26', '2026-07-01']) {
      const items = goalRaceChecklist(date, NOW);
      assert.ok(items.length >= 3, `${date} 체크리스트가 ${items.length}개뿐입니다`);
      const ids = new Set(items.map((item) => item.id));
      assert.equal(ids.size, items.length);
      for (const item of items) assert.ok(item.text.trim().length > 0);
    }
  });

  it('목표 대회 저장 값은 새 키를 쓰고 형식을 검사한다', () => {
    assert.equal(GOAL_RACE_KEY, 'runningbom:vnext:goal-race:v1');
    assert.equal(isGoalRace(goal()), true);
    assert.equal(isGoalRace(null), false);
    assert.equal(isGoalRace({ ...goal(), raceDate: '2026-9-20' }), false);
    assert.equal(isGoalRace({ ...goal(), raceId: 12 }), false);
  });
});

describe('대회 빠른 필터와 정렬', () => {
  const groups = groupRaces(
    [
      race('open-seoul', { raceDate: '2026-09-20', region: '서울', distances: ['Full'] }),
      race('weekend-busan', {
        raceDate: '2026-08-01', // NOW 기준 이번 주 토요일
        region: '부산',
        distances: ['5K'],
        registrationOpensAt: '2026-09-01T10:00:00+09:00', // 아직 접수 예정
      }),
      race('open-jeju', { raceDate: '2026-10-05', region: '제주', distances: ['Half'] }),
    ],
    NOW,
  );

  it('마감 임박을 포함한 다섯 종류의 빠른 칩을 제공한다', () => {
    assert.deepEqual(raceQuickFilters, ['접수 중만', '마감 임박', '이번 주말', '내 지역', '관심만']);
    assert.deepEqual(raceSorts, ['가까운 날짜순', '거리순', '지역순']);
  });

  it('이번 주말 범위는 토·일이다', () => {
    const weekend = weekendRange(NOW);
    assert.equal(weekend.start, '2026-08-01');
    assert.equal(weekend.end, '2026-08-02');
  });

  it('접수 중만·이번 주말·내 지역·관심만을 각각 걸러낸다', () => {
    const openOnly = applyQuickFilters(groups, ['접수 중만'], {}, NOW);
    assert.ok(openOnly.every((group) => group.status === '접수 중'));
    assert.ok(!openOnly.some((group) => group.id === 'weekend-busan'));

    const weekend = applyQuickFilters(groups, ['이번 주말'], {}, NOW);
    assert.deepEqual(
      weekend.map((group) => group.id),
      ['weekend-busan'],
    );

    const mine = applyQuickFilters(groups, ['내 지역'], { myRegion: '제주' }, NOW);
    assert.deepEqual(
      mine.map((group) => group.id),
      ['open-jeju'],
    );
    // 지역이 정해지지 않았으면 임의로 고르지 않고 0건입니다.
    assert.equal(applyQuickFilters(groups, ['내 지역'], {}, NOW).length, 0);

    const interested = applyQuickFilters(
      groups,
      ['관심만'],
      { interestedGroupKeys: [groups[2]?.key ?? ''] },
      NOW,
    );
    assert.deepEqual(interested.map((group) => group.id), ['open-jeju']);
  });

  it('공식 마감일이 7일 안에 있는 접수 중 대회만 마감 임박으로 고른다', () => {
    const urgent = groupRaces([
      race('urgent', { registrationClosesAt: '2026-07-31T23:59:00+09:00' }),
      race('later', { registrationClosesAt: '2026-08-15T23:59:00+09:00' }),
      race('unknown-close'),
    ], NOW);
    assert.deepEqual(
      applyQuickFilters(urgent, ['마감 임박'], {}, NOW).map((group) => group.id),
      ['urgent'],
    );
  });

  it('칩을 겹쳐도 원본 목록을 바꾸지 않는다', () => {
    const before = groups.map((group) => group.id);
    applyQuickFilters(groups, ['접수 중만', '내 지역'], { myRegion: '서울' }, NOW);
    assert.deepEqual(
      groups.map((group) => group.id),
      before,
    );
    assert.equal(applyQuickFilters(groups, [], {}, NOW).length, groups.length);
  });

  it('날짜순·거리순·지역순 정렬이 각각 동작한다', () => {
    assert.deepEqual(
      sortRaceGroups(groups, '가까운 날짜순').map((group) => group.raceDate),
      ['2026-08-01', '2026-09-20', '2026-10-05'],
    );
    assert.deepEqual(
      sortRaceGroups(groups, '거리순').map((group) => group.distances[0]),
      ['5K', 'Half', 'Full'],
    );
    assert.deepEqual(
      sortRaceGroups(groups, '지역순').map((group) => group.region),
      ['부산', '서울', '제주'],
    );
  });
});

describe('대회 묶음의 접수 상태와 신뢰 문구', () => {
  it('거리별 상태가 달라도 대회는 한 건이고 지금 접수 중인 종목을 대표한다', () => {
    const values = [
      race('spring-5k', {
        name: '2026 봄빛 마라톤 5K',
        distances: ['5K'],
        registrationOpensAt: '2026-09-01T10:00:00+09:00',
      }),
      race('spring-10k', {
        name: '2026 봄빛 마라톤 10K',
        distances: ['10K'],
        registrationOpensAt: '2026-06-01T10:00:00+09:00',
        officialUrl: 'https://example.com/apply-10k',
      }),
    ];
    const groups = groupRaces(values, NOW);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0]?.distances, ['5K', '10K']);
    assert.equal(groups[0]?.status, '접수 중');
    assert.equal(groups[0]?.registrationTarget.id, 'spring-10k');
  });

  it('기계용 revision과 출처 표기를 사용자용 문구로 바꾼다', () => {
    assert.equal(formatRaceFeedRevision('2026.08.08-race-data-34'), '대회 자료 8월 8일판 · 데이터 34');
    assert.equal(formatRaceVerification('마라톤온라인 home 아이콘'), '검증 근거 마라톤온라인 공개 일정');
    assert.equal(formatRaceVerification('마라톤GO 공개 일정 상세'), '검증 근거 마라톤GO 공개 일정');
  });

  it('홈에는 공식성 대신 접수 페이지·정보 출처·확인 중 상태만 보여 준다', () => {
    const registration = groupRaces([race('registration', { registrationUrl: 'https://example.com/apply' })], NOW)[0];
    const source = groupRaces([race('source', { sourceDetailUrl: 'https://example.com/source' })], NOW)[0];
    const unavailable = groupRaces([race('unavailable')], NOW)[0];

    assert.equal(raceGroupLinkStatus(registration!), '접수 페이지 있음');
    assert.equal(raceGroupLinkStatus(source!), '대회 정보 출처 있음');
    assert.equal(raceGroupLinkStatus(unavailable!), '정보 확인 중');
  });
});

describe('대회 달력 뷰', () => {
  it('월별로 묶고 대회가 없는 달은 만들지 않는다', () => {
    const groups = groupRaces(
      [
        race('a', { raceDate: '2026-08-01' }),
        race('b', { raceDate: '2026-08-15', region: '부산' }),
        race('c', { raceDate: '2026-10-05', region: '제주' }),
      ],
      NOW,
    );
    const buckets = raceMonthBuckets(groups);
    assert.deepEqual(
      buckets.map((bucket) => bucket.month),
      ['2026-08', '2026-10'],
    );
    assert.equal(buckets[0]?.count, 2);
    assert.equal(buckets[0]?.label, '2026년 8월');
    // 달력 뷰 합계는 목록의 대회 수와 같아야 합니다.
    assert.equal(
      buckets.reduce((total, bucket) => total + bucket.count, 0),
      groups.length,
    );
  });

  it('같은 대회의 여러 종목은 달력에서도 1건이다', () => {
    const values = [
      race('spring-10k', { name: '2026 봄빛 마라톤', distances: ['10K'], raceDate: '2026-09-20' }),
      race('spring-5k', { name: '2026 봄빛 마라톤 5K', distances: ['5K'], raceDate: '2026-09-20' }),
    ];
    const groups = groupRaces(values, NOW);
    assert.equal(countRaces(values, NOW), 1);
    const buckets = raceMonthBuckets(groups);
    assert.equal(buckets.length, 1);
    assert.equal(buckets[0]?.count, 1);
    assert.deepEqual(raceCountsByDay(groups, '2026-09'), { '2026-09-20': 1 });
  });

  it('날짜별 집계는 해당 달만 센다', () => {
    const groups = groupRaces(
      [
        race('a', { raceDate: '2026-08-01' }),
        race('b', { raceDate: '2026-08-01', region: '부산' }),
        race('c', { raceDate: '2026-09-05', region: '제주' }),
      ],
      NOW,
    );
    assert.deepEqual(raceCountsByDay(groups, '2026-08'), { '2026-08-01': 2 });
    assert.deepEqual(raceCountsByDay(groups, '2026-09'), { '2026-09-05': 1 });
    assert.deepEqual(raceCountsByDay(groups, '2026-11'), {});
  });

  it('월 시작 요일과 말일을 포함한 7열 달력을 만들고 거리별 종목은 한 건으로 센다', () => {
    const groups = groupRaces([
      race('spring-10k', { name: '2026 봄빛 마라톤 10K', distances: ['10K'], raceDate: '2026-09-20' }),
      race('spring-5k', { name: '2026 봄빛 마라톤 5K', distances: ['5K'], raceDate: '2026-09-20' }),
    ], NOW);
    const month = buildRaceCalendarMonth(groups, '2026-09', NOW);
    assert.ok(month);
    assert.equal(month.cells.length % 7, 0);
    assert.equal(month.cells.find((cell) => cell.key === '2026-09-20')?.groupCount, 1);
    assert.equal(month.cells.filter((cell) => cell.inMonth).length, 30);
  });
});

describe('접수 마감 안내', () => {
  it('KST 날짜 경계에서 시작·마감 D-day를 정확히 표시한다', () => {
    const open = race('open', {
      registrationOpensAt: '2026-07-01T10:00:00+09:00',
      registrationClosesAt: '2026-07-27T23:59:00+09:00',
    });
    assert.equal(registrationCountdownLabel(open, NOW), '접수 마감 D-1');
    assert.equal(isRegistrationClosingSoon(open, NOW), true);

    const scheduled = race('scheduled', { registrationOpensAt: '2026-07-27T10:00:00+09:00' });
    assert.equal(registrationCountdownLabel(scheduled, NOW), '접수 시작 D-1');

    const noClose = race('no-close');
    assert.equal(registrationCountdownLabel(noClose, NOW), '접수 중 · 마감일 확인 필요');
    assert.equal(isRegistrationClosingSoon(noClose, NOW), false);
  });
});
