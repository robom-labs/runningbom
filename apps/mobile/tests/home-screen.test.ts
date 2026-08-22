// 홈 화면의 순수 규칙(오늘 한 문장, 기록량 3단계, 이번 주 해석, 요일 7칸, 최근 기록 한 줄 평)을
// 상황별로 회귀 검증합니다. 화면을 렌더링하지 않고 model.ts의 함수와 소스 텍스트만 검사합니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  FULL_HOME_MIN_ACTIVITIES,
  activitiesUntilFullHome,
  dayCountLabel,
  greetingLine,
  homeStage,
  isPlainKorean,
  pickForToday,
  planForToday,
  recentActivityCards,
  recentActivityNote,
  registrationDeadlineLabel,
  startActionLabel,
  todayHeadline,
  todayLabel,
  weekDayMarks,
  weekInsight,
  weekMovementCaption,
} from '../app/screens/home/model';
import { knowledgeCards } from '../app/screens/community/knowledge';
import type { RunPlan } from '../domains/activities/plans';
import { shoeCatalog } from '../domains/shoes/catalog';
import type { ActivityRecord } from '../domains/activities/types';
import type { WeeklyGoal } from '../domains/badges/goals';

const root = join(import.meta.dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

// KST 2026-07-26(일요일) 12:00입니다. 이 주의 월요일은 2026-07-20입니다.
const NOW = Date.parse('2026-07-26T03:00:00Z');

function activity(dayKey: string, overrides: Partial<ActivityRecord> = {}): ActivityRecord {
  return {
    id: `activity-${dayKey}-${overrides.durationMinutes ?? 30}`,
    localUuid: 'local-test',
    kind: 'run',
    durationMinutes: 30,
    source: 'COACH_COMPLETED',
    completedAt: `${dayKey}T09:00:00+09:00`,
    timezoneId: 'Asia/Seoul',
    ...overrides,
  };
}

function plan(date: string, title: string): RunPlan {
  return {
    id: `plan-${date}`,
    date,
    kind: 'run',
    title,
    createdAt: '2026-07-01T00:00:00.000Z',
  };
}

const sessionGoal: WeeklyGoal = { metric: 'sessions', target: 3, auto: false };

function headline(
  activities: ActivityRecord[],
  options: {
    goal?: WeeklyGoal;
    plans?: RunPlan[];
    goalRace?: { name: string; raceDate: string };
    coachMinutes?: number;
  } = {},
) {
  return todayHeadline({
    activities,
    weeklyGoal: options.goal ?? sessionGoal,
    plans: options.plans ?? [],
    coachMinutes: options.coachMinutes ?? 30,
    ...(options.goalRace ? { goalRace: options.goalRace } : {}),
    now: NOW,
  });
}

describe('기록량 3단계 판정', () => {
  it('기록 0건은 신규, 1~4건은 초기, 5건 이상은 충분으로 나눈다', () => {
    assert.equal(homeStage([]), 'new');
    assert.equal(homeStage([activity('2026-07-20')]), 'early');
    assert.equal(
      homeStage(['20', '21', '22', '24'].map((day) => activity(`2026-07-${day}`))),
      'early',
    );
    assert.equal(
      homeStage(['20', '21', '22', '23', '24'].map((day) => activity(`2026-07-${day}`))),
      'steady',
    );
  });

  it('전체 카드가 열리기까지 남은 기록 수를 알려 준다', () => {
    assert.equal(FULL_HOME_MIN_ACTIVITIES, 5);
    assert.equal(activitiesUntilFullHome([]), 5);
    assert.equal(activitiesUntilFullHome([activity('2026-07-20'), activity('2026-07-21')]), 3);
    assert.equal(
      activitiesUntilFullHome(['20', '21', '22', '23', '24', '25'].map((day) => activity(`2026-07-${day}`))),
      0,
    );
  });
});

describe('오늘 한 문장', () => {
  it('기록이 하나도 없으면 숫자 대신 첫 러닝을 권한다', () => {
    const result = headline([]);
    assert.equal(result.tone, 'first');
    assert.match(result.text, /아직 기록이 없어요/);
    assert.match(result.text, /첫 기록이 남아요/);
    // 신규 사용자에게 지난주 비교나 목표 숫자를 들이밀지 않습니다.
    assert.equal(/지난주/.test(result.text), false);
    assert.equal(/\/ 3회/.test(result.text), false);
  });

  it('기록이 없어도 오늘 계획이 있으면 그 사실을 먼저 말한다', () => {
    const result = headline([], { plans: [plan('2026-07-26', '20분 걷고 달리기')] });
    assert.equal(result.tone, 'first');
    assert.match(result.text, /오늘 첫 러닝이 잡혀 있어요/);
  });

  it('오늘 이미 움직였으면 오늘 몫을 다 했다고 말한다', () => {
    const result = headline([
      activity('2026-07-26', { distanceKm: 5.2, durationMinutes: 32 }),
      activity('2026-07-24'),
    ]);
    assert.equal(result.tone, 'done');
    assert.match(result.text, /오늘 5\.2km 움직였어요/);
    assert.match(result.text, /오늘 몫은 다 했어요/);
  });

  it('거리가 없는 기록만 있으면 시간으로 말한다', () => {
    const result = headline([activity('2026-07-26', { durationMinutes: 40 })]);
    assert.match(result.text, /오늘 40분 움직였어요/);
  });

  it('목표 대회가 일주일 안이면 대회 주간 안내가 이긴다', () => {
    const result = headline(['20', '21'].map((day) => activity(`2026-07-${day}`)), {
      goalRace: { name: '봄빛 마라톤', raceDate: '2026-07-29' },
    });
    assert.equal(result.tone, 'race');
    assert.equal(result.text, '봄빛 마라톤까지 3일 남았어요. 이번 주는 짧고 가볍게만 달려요.');
  });

  it('대회 당일에는 대회 문장으로 바뀐다', () => {
    const result = headline([activity('2026-07-20')], {
      goalRace: { name: '봄빛 마라톤', raceDate: '2026-07-26' },
    });
    assert.equal(result.tone, 'race');
    assert.match(result.text, /오늘이 봄빛 마라톤 날이에요/);
  });

  it('오늘 적어 둔 운동이 있으면 그 이름을 말한다', () => {
    const result = headline([activity('2026-07-20')], {
      plans: [plan('2026-07-26', '30분 편한 러닝')],
    });
    assert.equal(result.tone, 'planned');
    assert.equal(result.text, '오늘은 30분 편한 러닝 예정이에요. 준비되면 바로 시작해요.');
  });

  it('오래 쉬었으면 목표보다 다시 시작을 먼저 말한다', () => {
    const result = headline([activity('2026-06-20')]);
    assert.equal(result.tone, 'comeback');
    assert.match(result.text, /36일 쉬었어요/);
    assert.match(result.text, /다시 시작이에요/);
  });

  it('이번 주 목표를 채웠으면 쉬어도 된다고 말한다', () => {
    const result = headline(['20', '21', '22'].map((day) => activity(`2026-07-${day}`)), {
      goal: { metric: 'sessions', target: 3, auto: false },
    });
    assert.equal(result.tone, 'goalMet');
    assert.equal(result.text, '이번 주 목표를 채웠어요. 오늘은 몸이 편한 만큼만 달려도 좋아요.');
  });

  it('한 번만 더 하면 되는 상태를 그대로 말한다', () => {
    const result = headline(
      ['13', '14', '20', '21'].map((day) => activity(`2026-07-${day}`)),
      { goal: { metric: 'sessions', target: 3, auto: false } },
    );
    assert.equal(result.tone, 'almost');
    assert.equal(result.text, '이번 주 2번 뛰었어요. 한 번만 더 하면 목표 달성이에요.');
  });

  it('거리 목표에서도 남은 양을 단위와 함께 말한다', () => {
    const result = headline(
      [
        activity('2026-07-13', { distanceKm: 5 }),
        activity('2026-07-20', { distanceKm: 5 }),
        activity('2026-07-21', { distanceKm: 4.5 }),
      ],
      { goal: { metric: 'distance', target: 10, auto: false } },
    );
    assert.equal(result.tone, 'almost');
    assert.equal(result.text, '이번 주 9.5km 채웠어요. 0.5km만 더 하면 목표 달성이에요.');
  });

  it('최근 7일을 많이 움직였으면 쉬는 것도 계획이라고 말한다', () => {
    const result = headline(
      ['20', '21', '22', '23', '24'].map((day) => activity(`2026-07-${day}`)),
      { goal: { metric: 'sessions', target: 9, auto: false } },
    );
    assert.equal(result.tone, 'rest');
    assert.equal(result.text, '최근 7일 중 5일 움직였어요. 오늘은 쉬는 게 더 도움이 돼요.');
  });

  it('어제 달렸으면 오늘은 짧게 권한다', () => {
    const result = headline(
      ['06', '07', '13', '25'].map((day) => activity(`2026-07-${day}`)),
      { goal: { metric: 'sessions', target: 4, auto: false } },
    );
    assert.equal(result.tone, 'easy');
    assert.match(result.text, /^어제 달렸어요\. 오늘은 \d+분 편한 러닝이면 충분해요\.$/);
  });

  it('오늘 계획이 없고 내일 계획이 있으면 쉬는 날이라고 말한다', () => {
    const result = headline(
      ['06', '07', '13', '14'].map((day) => activity(`2026-07-${day}`)),
      {
        goal: { metric: 'sessions', target: 4, auto: false },
        plans: [plan('2026-07-27', '30분 편한 러닝')],
      },
    );
    assert.equal(result.tone, 'tomorrow');
    assert.equal(result.text, '오늘은 쉬는 날이에요. 내일은 30분 편한 러닝 예정이에요.');
  });

  it('기록 1~4개 구간에서는 지난주 비교를 만들지 않는다', () => {
    const result = headline(['20', '21'].map((day) => activity(`2026-07-${day}`)), {
      goal: { metric: 'sessions', target: 4, auto: false },
    });
    assert.equal(result.tone, 'early');
    assert.match(result.text, /지금까지 2번 기록했어요/);
    assert.equal(/지난주/.test(result.text), false);
  });

  it('기록은 충분한데 이번 주가 비어 있으면 시작을 권한다', () => {
    const result = headline(
      ['13', '14', '15', '16', '17'].map((day) => activity(`2026-07-${day}`)),
      { goal: { metric: 'sessions', target: 4, auto: false } },
    );
    assert.equal(result.tone, 'blankWeek');
    assert.match(result.text, /이번 주는 아직 첫 기록이 없어요/);
  });

  it('평소 상태에서는 이번 주 값과 오늘 할 일을 함께 말한다', () => {
    const result = headline(
      ['01', '02', '03', '13', '14', '20'].map((day) => activity(`2026-07-${day}`)),
      { goal: { metric: 'sessions', target: 5, auto: false } },
    );
    assert.equal(result.tone, 'steady');
    assert.match(result.text, /^이번 주 1회 채웠어요\. 오늘 \d+분 달리면 목표에 더 가까워져요\.$/);
  });

  it('모든 상황의 문장이 한 문장 원칙과 금지 용어를 지킨다', () => {
    const cases = [
      headline([]),
      headline([activity('2026-07-26', { distanceKm: 5 })]),
      headline([activity('2026-07-20')], { goalRace: { name: '봄빛 마라톤', raceDate: '2026-07-29' } }),
      headline([activity('2026-07-20')], { plans: [plan('2026-07-26', '30분 편한 러닝')] }),
      headline([activity('2026-06-20')]),
      headline(['20', '21', '22'].map((day) => activity(`2026-07-${day}`))),
      headline(['13', '14', '20', '21'].map((day) => activity(`2026-07-${day}`))),
      headline(['20', '21', '22', '23', '24'].map((day) => activity(`2026-07-${day}`)), {
        goal: { metric: 'sessions', target: 9, auto: false },
      }),
      headline(['06', '07', '13', '25'].map((day) => activity(`2026-07-${day}`)), {
        goal: { metric: 'sessions', target: 4, auto: false },
      }),
      headline(['06', '07'].map((day) => activity(`2026-07-${day}`)), {
        goal: { metric: 'sessions', target: 4, auto: false },
      }),
    ];
    // 서로 다른 상황이 실제로 서로 다른 문장을 만듭니다.
    assert.equal(new Set(cases.map((entry) => entry.text)).size, cases.length);
    for (const entry of cases) {
      assert.ok(entry.text.length > 0 && entry.text.length <= 60, entry.text);
      // 숫자만 나열하고 끝나지 않고 항상 문장으로 끝납니다.
      assert.match(entry.text, /(요|다)\.$/);
      for (const banned of ['스트릭', 'RPE', '인터벌', '세션', '액티비티']) {
        assert.equal(entry.text.includes(banned), false, `${banned} 사용: ${entry.text}`);
      }
    }
  });
});

describe('시작 버튼 이름', () => {
  it('오늘 계획이 없으면 기본 이름이고 있으면 그 운동 이름을 넣는다', () => {
    assert.equal(startActionLabel(), '달리기 시작');
    assert.equal(
      startActionLabel(plan('2026-07-26', '30분 편한 러닝')),
      '오늘의 운동: 30분 편한 러닝 시작',
    );
  });

  it('오늘 날짜의 계획만 골라 온다', () => {
    const plans = [plan('2026-07-26', '오늘 러닝'), plan('2026-07-27', '내일 러닝')];
    assert.equal(planForToday(plans, NOW)?.title, '오늘 러닝');
    assert.equal(planForToday([plan('2026-07-27', '내일 러닝')], NOW), undefined);
  });
});

describe('이번 주 해석', () => {
  it('숫자에는 항상 해석 한 줄이 붙는다', () => {
    const insight = weekInsight(
      ['20', '21'].map((day) => activity(`2026-07-${day}`)),
      sessionGoal,
      NOW,
    );
    assert.equal(insight.valueLabel, '2회 / 3회');
    assert.ok(insight.meaning.length > 0);
  });

  it('기록 1~4개 구간에서는 지난주 대비 문구를 만들지 않는다', () => {
    const insight = weekInsight([activity('2026-07-20')], sessionGoal, NOW);
    assert.equal(insight.compared, false);
    assert.equal(insight.meaning, '4번 더 기록하면 지난주와 비교해서 알려드릴 수 있어요.');
  });

  it('기록이 충분하면 지난주 같은 요일까지와 비교한다', () => {
    const activities = [
      ...['13', '14', '15'].map((day) => activity(`2026-07-${day}`)),
      ...['20', '21', '22', '23'].map((day) => activity(`2026-07-${day}`)),
    ];
    const insight = weekInsight(activities, { metric: 'sessions', target: 5, auto: false }, NOW);
    assert.equal(insight.compared, true);
    assert.equal(insight.meaning, '지난주 이맘때보다 1회 많아요. 1회 남았어요.');
  });

  it('지난주보다 적으면 적다고 그대로 말한다', () => {
    const activities = [
      ...['13', '14', '15', '16'].map((day) => activity(`2026-07-${day}`)),
      ...['20', '21'].map((day) => activity(`2026-07-${day}`)),
    ];
    const insight = weekInsight(activities, { metric: 'sessions', target: 5, auto: false }, NOW);
    assert.equal(insight.meaning, '지난주 이맘때보다 2회 적어요. 3회 남았어요.');
  });

  it('지난주와 같으면 같다고 말한다', () => {
    const activities = [
      ...['13', '14', '15'].map((day) => activity(`2026-07-${day}`)),
      ...['20', '21', '22'].map((day) => activity(`2026-07-${day}`)),
    ];
    const insight = weekInsight(activities, { metric: 'sessions', target: 5, auto: false }, NOW);
    assert.equal(insight.meaning, '지난주 이맘때와 같아요. 2회 남았어요.');
  });

  it('목표를 채웠으면 비교 대신 달성 문구를 쓴다', () => {
    const insight = weekInsight(
      ['20', '21', '22'].map((day) => activity(`2026-07-${day}`)),
      sessionGoal,
      NOW,
    );
    assert.equal(insight.met, true);
    assert.equal(insight.compared, false);
    assert.match(insight.meaning, /이번 주 목표를 채웠어요/);
  });
});

describe('요일 7칸', () => {
  it('월요일부터 일요일까지 7칸을 만들고 오늘을 표시한다', () => {
    const marks = weekDayMarks(['20', '22'].map((day) => activity(`2026-07-${day}`)), NOW);
    assert.equal(marks.length, 7);
    assert.deepEqual(
      marks.map((mark) => mark.label),
      ['월', '화', '수', '목', '금', '토', '일'],
    );
    assert.deepEqual(
      marks.map((mark) => mark.moved),
      [true, false, true, false, false, false, false],
    );
    assert.equal(marks.at(-1)?.isToday, true);
    assert.equal(marks.every((mark) => mark.isFuture === false), true);
  });

  it('인정 기준보다 짧은 기록은 움직인 날로 세지 않는다', () => {
    const marks = weekDayMarks([activity('2026-07-20', { durationMinutes: 5 })], NOW);
    assert.equal(marks[0]?.moved, false);
  });

  it("설명 한 줄에 '스트릭'을 쓰지 않는다", () => {
    const marks = weekDayMarks(['20', '21'].map((day) => activity(`2026-07-${day}`)), NOW);
    assert.equal(weekMovementCaption(marks, 0), '이번 주 2일 움직였어요.');
    assert.equal(weekMovementCaption(marks, 3), '연속 기록 3일째예요. 오늘도 이어 볼까요?');
    assert.match(weekMovementCaption(weekDayMarks([], NOW), 0), /이번 주는 아직 쉬는 중이에요/);
    for (const streakDays of [0, 1, 5]) {
      assert.equal(weekMovementCaption(marks, streakDays).includes('스트릭'), false);
    }
  });
});

describe('최근 기록 한 줄 평', () => {
  it('거리·시간·페이스와 한 줄 평을 함께 만든다', () => {
    const activities = [
      activity('2026-07-25', { distanceKm: 5, durationMinutes: 30 }),
      activity('2026-07-20', { distanceKm: 8, durationMinutes: 48 }),
    ];
    const cards = recentActivityCards(activities, 2);
    assert.equal(cards.length, 2);
    assert.equal(cards[0]?.title, '러닝 30분 · 5.0km');
    assert.equal(cards[0]?.meta, "7월 25일 · 6'00\" 페이스");
    assert.ok((cards[0]?.note ?? '').length > 0);
  });

  it('가장 멀리 달린 날, 빠른 날, 느긋한 날을 구분한다', () => {
    const activities = [
      activity('2026-07-25', { distanceKm: 10, durationMinutes: 60 }),
      activity('2026-07-23', { distanceKm: 5, durationMinutes: 25 }),
      activity('2026-07-20', { distanceKm: 5, durationMinutes: 35 }),
    ];
    assert.equal(recentActivityNote(activities[0] as ActivityRecord, activities), '지금까지 가장 멀리 달린 날이에요.');
    assert.equal(recentActivityNote(activities[1] as ActivityRecord, activities), '평소보다 빠르게 달린 날이에요.');
    assert.equal(recentActivityNote(activities[2] as ActivityRecord, activities), '평소보다 여유 있게 달린 날이에요.');
  });

  it('걷기와 회복은 러닝과 다른 말로 적는다', () => {
    const walk = activity('2026-07-25', { kind: 'walk' });
    const recovery = activity('2026-07-24', { kind: 'recovery' });
    assert.match(recentActivityNote(walk, [walk]), /걸으면서/);
    assert.match(recentActivityNote(recovery, [recovery]), /회복/);
  });

  it('거리가 없으면 페이스를 지어내지 않는다', () => {
    const cards = recentActivityCards([activity('2026-07-25', { durationMinutes: 30 })], 1);
    assert.equal(cards[0]?.title, '러닝 30분');
    assert.equal(cards[0]?.meta, '7월 25일');
  });
});

describe('다가오는 것 꼬리표', () => {
  it('오늘·내일·남은 날을 짧게 적는다', () => {
    assert.equal(dayCountLabel('2026-07-26', NOW), '오늘');
    assert.equal(dayCountLabel('2026-07-27', NOW), '내일');
    assert.equal(dayCountLabel('2026-08-05', NOW), 'D-10');
    assert.equal(dayCountLabel('2026-07-24', NOW), 'D+2');
  });

  it('접수 마감은 2주 안일 때만 알린다', () => {
    assert.equal(registrationDeadlineLabel(undefined, NOW), undefined);
    assert.equal(registrationDeadlineLabel('2026-07-26T23:59:00+09:00', NOW), '오늘 접수 마감');
    assert.equal(registrationDeadlineLabel('2026-08-01T23:59:00+09:00', NOW), '접수 마감 6일 전');
    assert.equal(registrationDeadlineLabel('2026-09-01T23:59:00+09:00', NOW), undefined);
    assert.equal(registrationDeadlineLabel('2026-07-01T23:59:00+09:00', NOW), undefined);
  });
});

describe('오늘 날짜와 인사', () => {
  it('한국 날짜와 요일을 직접 계산한다', () => {
    assert.equal(todayLabel(NOW), '7월 26일 일요일');
    assert.equal(greetingLine('봄이', NOW), '7월 26일 일요일 · 봄이님');
    assert.equal(greetingLine('   ', NOW), '7월 26일 일요일 · 러너님');
  });
});

describe('발견 추천 고르기', () => {
  it('같은 날에는 같은 항목을 고르고 빈 목록에서는 아무것도 고르지 않는다', () => {
    const values = ['a', 'b', 'c', 'd'];
    const picked = pickForToday(values, NOW);
    assert.ok(picked !== undefined && values.includes(picked));
    assert.equal(pickForToday(values, NOW), picked);
    assert.equal(pickForToday([], NOW), undefined);
  });
});

describe('홈 화면 구성', () => {
  const home = source('app/screens/home/HomeScreen.tsx');
  const model = source('app/screens/home/model.ts');

  it('접수 중 대회 → 내 대회와 일정 → 이용 안내 순서로 흐른다', () => {
    // 첫 화면에는 대회 탐색과 일정만 남깁니다.
    const order = [
      '지금 접수 중인',
      'title="내 대회와 일정"',
      'title="이용 안내"',
    ];
    let cursor = -1;
    for (const marker of order) {
      const index = home.indexOf(marker);
      assert.ok(index > cursor, `${marker} 구획 순서가 어긋납니다`);
      cursor = index;
    }
  });

  it('접수 중 대회 버튼이 첫 카드 안에, 섹션 제목보다 앞에 있다', () => {
    assert.ok(home.indexOf('testID="home-open-races"') < home.indexOf('<SectionHeader'));
    assert.match(home, /accessibilityHint="접수 중인 대회를 지역과 거리로 찾아봐요"/);
    assert.match(home, /size="lg"/);
  });

  it('홈 대회 카드는 링크 성격을 보여 주고, 고른 대회는 상세를 바로 연다', () => {
    assert.match(home, /raceGroupLinkStatus\(group\)/);
    assert.match(home, /row\.linkStatus/);
    const races = source('domains/races/RaceScreen.tsx');
    assert.match(races, /setExpandedGroupId\(focused\.id\)/);
  });

  it('색·글자 크기·간격을 디자인 토큰으로만 지정한다', () => {
    for (const text of [home, model]) {
      assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(text.replace(/https?:\/\/\S+/g, '')), false);
      assert.equal(/rgba?\(/.test(text), false);
      assert.equal(/fontSize: \d/.test(text), false);
      assert.equal(/fontWeight: '\d/.test(text), false);
      assert.equal(/(margin|padding|gap)[A-Za-z]*: \d/.test(text), false);
    }
    assert.match(home, /screenStyles/);
  });

  it('금지 용어를 화면 문구에 쓰지 않는다', () => {
    for (const banned of ['스트릭', 'RPE', '인터벌', '액티비티']) {
      assert.equal(home.includes(banned), false, `${banned} 사용`);
    }
  });

  it('어려운 낱말 필터는 기존 지식 데이터에도 유지한다', () => {
    assert.equal(isPlainKorean('무릎이 아프면 어떻게 하나요?'), true);
    assert.equal(isPlainKorean('인터벌은 언제부터 시작하면 좋나요?'), false);
    assert.equal(isPlainKorean('스트릭을 이어 가는 방법'), false);
    // 기존 목록에도 쉬운 문구가 넉넉히 남습니다.
    assert.ok(shoeCatalog.filter((entry) => isPlainKorean(entry.pick)).length >= 20);
    assert.ok(knowledgeCards.filter((card) => isPlainKorean(card.question)).length >= 20);
    assert.doesNotMatch(home, /TodayCard|ShoeRankingCard/);
  });

  it('부모가 이미 넘겨 주는 이동 수단만 쓰고 새 prop을 만들지 않는다', () => {
    assert.match(home, /onNavigate: \(route: RouteKey\) => void;/);
    assert.match(home, /onOpenRace: \(raceId\?: string\) => void;/);
    const propBlock = home.slice(home.indexOf('type Props = {'), home.indexOf('};', home.indexOf('type Props = {')));
    assert.equal((propBlock.match(/^\s{2}\w+:/gm) ?? []).length, 2);
  });

  it('빈 상태와 불러오는 중 상태를 모두 갖는다', () => {
    assert.match(home, /<EmptyState/);
    assert.match(home, /<Skeleton/);
  });
});
