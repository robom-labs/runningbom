// 도전(챌린지)의 순수 규칙을 회귀 검증합니다.
// 기본 도전 목록이 날짜에서 자동으로 열리는지, 진행률과 "이 속도면" 예측이 맞는지,
// 그리고 화면이 참가자 수를 만들어 내지 않는지 확인합니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  builtInChallenges,
  daysBetween,
  formatDayRange,
  monthRange,
  monthlyChallenges,
  raceChallenge,
  raceRunTarget,
  weekRange,
  weeklyChallenges,
} from '../domains/challenges/catalog';
import {
  challengeCurrent,
  challengeForecast,
  challengeInsight,
  challengePeriod,
  challengeProgress,
  challengeSections,
  pendingCelebration,
  recommendChallenge,
} from '../domains/challenges/progress';
import {
  MAX_CUSTOM_TITLE,
  defaultCustomInput,
  parseCustomChallenge,
} from '../domains/challenges/custom';
import {
  CHALLENGE_STORE_KEY,
  MAX_CUSTOM_CHALLENGES,
  addCustomChallenge,
  emptyChallengeStore,
  joinChallenge,
  leaveChallenge,
  markCelebrated,
  parseChallengeStore,
} from '../domains/challenges/store';
import {
  formatChallengeAmount,
  formatChallengeValue,
  isChallenge,
  type Challenge,
} from '../domains/challenges/types';
import type { ActivityRecord } from '../domains/activities/types';

const root = join(import.meta.dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

// KST 2026-07-26(일요일) 12:00입니다. 이 주의 월요일은 2026-07-20입니다.
const NOW = Date.parse('2026-07-26T03:00:00Z');

function activity(dayKey: string, overrides: Partial<ActivityRecord> = {}): ActivityRecord {
  return {
    id: `activity-${dayKey}-${overrides.durationMinutes ?? 30}-${overrides.distanceKm ?? 0}`,
    localUuid: 'local-test',
    kind: 'run',
    durationMinutes: 30,
    source: 'COACH_COMPLETED',
    completedAt: `${dayKey}T09:00:00+09:00`,
    timezoneId: 'Asia/Seoul',
    ...overrides,
  };
}

function challenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'test-challenge',
    title: '테스트 도전',
    summary: '테스트용이에요.',
    startDay: '2026-07-01',
    endDay: '2026-07-31',
    goal: { metric: 'distance', target: 30 },
    origin: 'builtin',
    ...overrides,
  };
}

describe('기본 도전 목록', () => {
  it('달과 주가 오늘 날짜에서 자동으로 계산된다', () => {
    assert.deepEqual(monthRange('2026-07-26'), {
      startDay: '2026-07-01',
      endDay: '2026-07-31',
    });
    assert.deepEqual(monthRange('2026-02-10'), {
      startDay: '2026-02-01',
      endDay: '2026-02-28',
    });
    assert.deepEqual(weekRange('2026-07-26'), {
      startDay: '2026-07-20',
      endDay: '2026-07-26',
    });
    assert.equal(formatDayRange(monthRange('2026-07-26')), '7월 1일 ~ 7월 31일');
  });

  it('이번 달 30·50·100km와 10번 달리기, 30분 이상 5번을 연다', () => {
    const monthly = monthlyChallenges('2026-07-26');
    assert.deepEqual(
      monthly.map((item) => item.goal.target),
      [30, 50, 100, 10, 5],
    );
    assert.deepEqual(
      monthly.map((item) => item.goal.metric),
      ['distance', 'distance', 'distance', 'sessions', 'sessions'],
    );
    assert.deepEqual(monthly.at(3)?.goal.kinds, ['run']);
    assert.equal(monthly.at(4)?.goal.minMinutes, 30);
    for (const item of monthly) {
      assert.equal(item.startDay, '2026-07-01');
      assert.equal(item.endDay, '2026-07-31');
      assert.ok(item.id.endsWith(':2026-07'), `${item.id}에 기간이 없습니다`);
      assert.ok(isChallenge(item));
    }
  });

  it('이번 주 3일 움직이기는 월요일부터 일요일까지다', () => {
    const [weekly] = weeklyChallenges('2026-07-26');
    assert.equal(weekly?.title, '이번 주 3일 움직이기');
    assert.equal(weekly?.goal.metric, 'activeDays');
    assert.equal(weekly?.goal.target, 3);
    assert.equal(weekly?.startDay, '2026-07-20');
    assert.equal(weekly?.endDay, '2026-07-26');
  });

  it('달이 바뀌면 도전 id가 바뀌어 새 기간이 저절로 열린다', () => {
    const july = monthlyChallenges('2026-07-26').map((item) => item.id);
    const august = monthlyChallenges('2026-08-03').map((item) => item.id);
    assert.equal(july.some((id) => august.includes(id)), false);
  });

  it('목표 대회가 있으면 준비 도전이 하나 더 열린다', () => {
    const seed = {
      raceId: 'spring-race-10k',
      name: '2026 봄빛 마라톤',
      raceDate: '2026-09-20',
      savedAt: '2026-07-10T00:00:00.000Z',
    };
    const race = raceChallenge(seed, NOW);
    assert.ok(race);
    assert.equal(race?.origin, 'race');
    assert.equal(race?.title, '2026 봄빛 마라톤 준비');
    assert.equal(race?.startDay, '2026-07-10');
    assert.equal(race?.endDay, '2026-09-20');
    assert.equal(race?.goal.metric, 'sessions');
    // 56일 남았으니 주 3회 기준 24번입니다.
    assert.equal(daysBetween('2026-07-26', '2026-09-20'), 56);
    assert.equal(race?.goal.target, 24);
    assert.equal(raceRunTarget(3), 4);
    assert.equal(raceRunTarget(365), 60);

    assert.equal(builtInChallenges(NOW).length, 6);
    assert.equal(builtInChallenges(NOW, seed).length, 7);
    // 대회가 지났으면 준비 도전을 만들지 않습니다.
    assert.equal(raceChallenge({ ...seed, raceDate: '2026-07-01' }, NOW), undefined);
  });
});

describe('진행률 계산', () => {
  const records = [
    activity('2026-07-02', { distanceKm: 5, durationMinutes: 32 }),
    activity('2026-07-06', { distanceKm: 4, durationMinutes: 28 }),
    activity('2026-07-06', { distanceKm: 3, durationMinutes: 20, kind: 'walk' }),
    // 기간 밖이라 세지 않습니다.
    activity('2026-06-30', { distanceKm: 20, durationMinutes: 120 }),
  ];

  it('기간 안의 거리만 더한다', () => {
    assert.equal(challengeCurrent(records, challenge()), 12);
  });

  it('종류를 정하면 그 종류만 센다', () => {
    const runsOnly = challenge({ goal: { metric: 'sessions', target: 10, kinds: ['run'] } });
    assert.equal(challengeCurrent(records, runsOnly), 2);
    const all = challenge({ goal: { metric: 'sessions', target: 10 } });
    assert.equal(challengeCurrent(records, all), 3);
  });

  it('30분 이상만 세는 도전은 짧은 운동을 빼고 센다', () => {
    const longOnly = challenge({ goal: { metric: 'sessions', target: 5, minMinutes: 30 } });
    assert.equal(challengeCurrent(records, longOnly), 1);
  });

  it('움직인 날은 같은 날 여러 번 해도 하루로 센다', () => {
    const activeDays = challenge({ goal: { metric: 'activeDays', target: 3 } });
    assert.equal(challengeCurrent(records, activeDays), 2);
  });

  it('시간 합계도 기간 안의 기록만 더한다', () => {
    const minutes = challenge({ goal: { metric: 'minutes', target: 300 } });
    assert.equal(challengeCurrent(records, minutes), 80);
  });

  it('진행률은 0과 1 사이로 자른다', () => {
    const progress = challengeProgress(challenge(), records, NOW);
    assert.equal(progress.current, 12);
    assert.equal(progress.percent, 40);
    assert.equal(progress.done, false);
    assert.equal(progress.amountLabel, '12.0km / 30.0km');

    const easy = challengeProgress(challenge({ goal: { metric: 'distance', target: 5 } }), records, NOW);
    assert.equal(easy.ratio, 1);
    assert.equal(easy.done, true);
  });
});

describe('기간과 남은 날', () => {
  it('진행 중이면 오늘을 포함해 남은 날을 센다', () => {
    const period = challengePeriod(challenge(), NOW);
    assert.equal(period.state, 'active');
    assert.equal(period.totalDays, 31);
    assert.equal(period.daysElapsed, 26);
    assert.equal(period.daysLeft, 6);
    assert.equal(period.dDayLabel, 'D-5');
    assert.equal(period.remainingLabel, '6일 남았어요');
  });

  it('마지막 날에는 D-DAY로 알린다', () => {
    const period = challengePeriod(challenge({ endDay: '2026-07-26' }), NOW);
    assert.equal(period.dDayLabel, 'D-DAY');
    assert.equal(period.remainingLabel, '오늘이 마지막 날이에요');
  });

  it('시작 전과 끝난 뒤를 구분한다', () => {
    const upcoming = challengePeriod(
      challenge({ startDay: '2026-08-01', endDay: '2026-08-31' }),
      NOW,
    );
    assert.equal(upcoming.state, 'upcoming');
    assert.equal(upcoming.daysElapsed, 0);
    assert.equal(upcoming.remainingLabel, '6일 뒤에 시작해요');

    const ended = challengePeriod(
      challenge({ startDay: '2026-06-01', endDay: '2026-06-30' }),
      NOW,
    );
    assert.equal(ended.state, 'ended');
    assert.equal(ended.daysLeft, 0);
    assert.equal(ended.dDayLabel, 'D+26');
  });
});

describe('"이 속도면" 예측', () => {
  it('하루 평균으로 기간 끝까지 갈 양을 계산한다', () => {
    // 10일 동안 20km 했으니 하루 2km, 30일이면 60km입니다.
    const forecast = challengeForecast({
      current: 20,
      target: 30,
      totalDays: 30,
      daysElapsed: 10,
      daysLeft: 20,
    });
    assert.equal(forecast.perDaySoFar, 2);
    assert.equal(forecast.projected, 60);
    // 남은 10km를 하루 2km로 채우면 5일입니다. 20일 중 5일이니 15일 일찍 끝나요.
    assert.equal(forecast.finishInDays, 5);
    assert.equal(forecast.earlyByDays, 15);
    assert.equal(forecast.perDayNeeded, 0.5);
  });

  it('아직 아무것도 안 했으면 예측하지 않는다', () => {
    const forecast = challengeForecast({
      current: 0,
      target: 30,
      totalDays: 30,
      daysElapsed: 5,
      daysLeft: 25,
    });
    assert.equal(forecast.perDaySoFar, 0);
    assert.equal(forecast.projected, 0);
    assert.equal(forecast.finishInDays, undefined);
    assert.equal(forecast.earlyByDays, 0);
    assert.equal(forecast.perDayNeeded, 1.2);
  });

  it('이미 다 했으면 더 필요한 양이 0이다', () => {
    const forecast = challengeForecast({
      current: 40,
      target: 30,
      totalDays: 30,
      daysElapsed: 20,
      daysLeft: 10,
    });
    assert.equal(forecast.perDayNeeded, 0);
    assert.equal(forecast.earlyByDays, 0);
  });
});

describe('해석 한 줄', () => {
  function insight(current: number, target = 30, overrides: Partial<Challenge> = {}) {
    const item = challenge({ goal: { metric: 'distance', target }, ...overrides });
    const period = challengePeriod(item, NOW);
    const forecast = challengeForecast({
      current,
      target,
      totalDays: period.totalDays,
      daysElapsed: period.daysElapsed,
      daysLeft: period.daysLeft,
    });
    return challengeInsight({
      challenge: item,
      current,
      done: current >= target,
      period,
      forecast,
    });
  }

  it('다 채우면 축하한다', () => {
    assert.equal(insight(30), '목표를 다 채웠어요. 축하해요!');
  });

  it('빠른 속도면 며칠 일찍 끝나는지 알려 준다', () => {
    // 26일 동안 29km(하루 1.11km) → 남은 1km는 하루면 되고 남은 날은 6일입니다.
    assert.equal(insight(29), '이 속도면 5일 일찍 끝나요.');
  });

  it('아직 못 미치면 하루에 얼마씩 하면 되는지 알려 준다', () => {
    // 남은 24km를 6일에 나누면 하루 4km입니다.
    assert.equal(insight(6), '하루 4.0km씩이면 됩니다.');
    // 아무것도 안 했으면 하루 5km입니다.
    assert.equal(insight(0), '하루 5.0km씩이면 됩니다.');
  });

  it('횟수·움직인 날은 하루 몇 번 대신 남은 양으로 말한다', () => {
    const item = challenge({ goal: { metric: 'sessions', target: 10, kinds: ['run'] } });
    const period = challengePeriod(item, NOW);
    const line = challengeInsight({
      challenge: item,
      current: 1,
      done: false,
      period,
      forecast: challengeForecast({
        current: 1,
        target: 10,
        totalDays: period.totalDays,
        daysElapsed: period.daysElapsed,
        daysLeft: period.daysLeft,
      }),
    });
    assert.equal(line, '남은 6일 동안 9번 더 하면 됩니다.');
  });

  it('시작 전과 끝난 도전은 상태를 그대로 말한다', () => {
    assert.equal(
      insight(0, 30, { startDay: '2026-08-01', endDay: '2026-08-31' }),
      '8월 1일에 시작해요.',
    );
    assert.equal(
      insight(12, 30, { startDay: '2026-06-01', endDay: '2026-06-30' }),
      '12.0km에서 기간이 끝났어요. 다음 기간에 다시 도전해요.',
    );
  });
});

describe('구획 나누기와 추천', () => {
  const items = [
    challengeProgress(challenge({ id: 'a', goal: { metric: 'distance', target: 30 } }), [], NOW),
    challengeProgress(challenge({ id: 'b', goal: { metric: 'distance', target: 50 } }), [], NOW),
    challengeProgress(
      challenge({ id: 'old', startDay: '2026-06-01', endDay: '2026-06-30' }),
      [],
      NOW,
    ),
  ];

  it('참가한 것·참가할 수 있는 것·지난 것으로 나눈다', () => {
    const sections = challengeSections(items, ['a', 'old']);
    assert.deepEqual(sections.mine.map((item) => item.challenge.id), ['a']);
    assert.deepEqual(sections.available.map((item) => item.challenge.id), ['b']);
    assert.deepEqual(sections.past.map((item) => item.challenge.id), ['old']);
  });

  it('지난 도전은 참가했던 것만 남긴다', () => {
    assert.deepEqual(challengeSections(items, []).past, []);
  });

  it('추천은 지금 참가할 수 있는 것 중에서 고른다', () => {
    const sections = challengeSections(items, []);
    assert.equal(recommendChallenge(sections.available)?.challenge.id, 'a');
    assert.equal(recommendChallenge([]), undefined);
  });

  it('완료했지만 축하를 아직 안 본 도전을 찾아 준다', () => {
    const done = challengeProgress(
      challenge({ id: 'done', goal: { metric: 'distance', target: 5 } }),
      [activity('2026-07-02', { distanceKm: 6 })],
      NOW,
    );
    assert.equal(pendingCelebration([done], [])?.challenge.id, 'done');
    assert.equal(pendingCelebration([done], ['done']), undefined);
  });
});

describe('내가 만드는 도전', () => {
  it('기본 입력은 오늘부터 30일이다', () => {
    const input = defaultCustomInput(NOW);
    assert.equal(input.startDay, '2026-07-26');
    assert.equal(input.endDay, '2026-08-24');
    assert.equal(input.metric, 'distance');
  });

  it('제대로 적으면 도전이 만들어진다', () => {
    const result = parseCustomChallenge(
      {
        title: '  여름 100km  ',
        startDay: '2026-08-01',
        endDay: '2026-08-31',
        metric: 'distance',
        targetText: '100',
      },
      NOW,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.title, '여름 100km');
      assert.equal(result.value.goal.target, 100);
      assert.equal(result.value.origin, 'custom');
      assert.equal(result.value.summary, '31일 동안 100.0km');
      assert.ok(isChallenge(result.value));
    }
  });

  it('잘못 적으면 왜 안 되는지 쉬운 말로 알려 준다', () => {
    const cases: Array<[Parameters<typeof parseCustomChallenge>[0], string]> = [
      [
        { title: '', startDay: '2026-08-01', endDay: '2026-08-31', metric: 'distance', targetText: '10' },
        '도전 이름을 적어 주세요.',
      ],
      [
        {
          title: 'ㄱ'.repeat(MAX_CUSTOM_TITLE + 1),
          startDay: '2026-08-01',
          endDay: '2026-08-31',
          metric: 'distance',
          targetText: '10',
        },
        `도전 이름은 ${MAX_CUSTOM_TITLE}자까지 적을 수 있어요.`,
      ],
      [
        { title: '테스트', startDay: '2026-13-40', endDay: '2026-08-31', metric: 'distance', targetText: '10' },
        '날짜는 2026-08-01처럼 적어 주세요.',
      ],
      [
        { title: '테스트', startDay: '2026-08-31', endDay: '2026-08-01', metric: 'distance', targetText: '10' },
        '끝나는 날이 시작하는 날보다 빨라요.',
      ],
      [
        { title: '테스트', startDay: '2026-08-01', endDay: '2026-08-31', metric: 'distance', targetText: '' },
        '목표 값을 숫자로 적어 주세요.',
      ],
      [
        { title: '테스트', startDay: '2026-08-01', endDay: '2026-08-31', metric: 'distance', targetText: '9999' },
        '목표는 1000km까지 정할 수 있어요.',
      ],
      [
        { title: '테스트', startDay: '2026-08-01', endDay: '2026-08-31', metric: 'activeDays', targetText: '40' },
        '기간이 31일이라 그보다 많은 날을 채울 수는 없어요.',
      ],
    ];
    for (const [input, message] of cases) {
      const result = parseCustomChallenge(input, NOW);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.message, message);
    }
  });
});

describe('참가 상태 저장', () => {
  it('새 저장 키만 쓴다', () => {
    assert.equal(CHALLENGE_STORE_KEY, 'runningbom:vnext:challenges:v1');
    // 기존 키(활동·설정·목표 대회·온보딩)와 겹치지 않아야 합니다.
    for (const existing of [
      'runningbom:vnext:preferences:v1',
      'runningbom:vnext:run-plans:v1',
      'runningbom:vnext:weekly-goal:v1',
      'runningbom:vnext:goal-race:v1',
      'runningbom:vnext:local-uuid',
    ]) {
      assert.notEqual(CHALLENGE_STORE_KEY, existing);
    }
  });

  it('참가와 그만두기를 기록한다', () => {
    const joined = joinChallenge(emptyChallengeStore, 'a');
    assert.deepEqual(joined.joinedIds, ['a']);
    assert.equal(joinChallenge(joined, 'a'), joined);
    assert.deepEqual(leaveChallenge(joined, 'a').joinedIds, []);
  });

  it('직접 만든 도전은 만들자마자 참가 상태가 된다', () => {
    const custom = challenge({ id: 'custom:1', origin: 'custom' });
    const result = addCustomChallenge(emptyChallengeStore, custom);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.store.joinedIds, ['custom:1']);
      assert.equal(result.store.customChallenges.length, 1);
      // 그만두면 본체도 함께 지웁니다.
      assert.deepEqual(leaveChallenge(result.store, 'custom:1').customChallenges, []);
    }
  });

  it('직접 만든 도전 개수에 상한이 있다', () => {
    let store = emptyChallengeStore;
    for (let index = 0; index < MAX_CUSTOM_CHALLENGES; index += 1) {
      const result = addCustomChallenge(
        store,
        challenge({ id: `custom:${index}`, origin: 'custom' }),
      );
      assert.equal(result.ok, true);
      if (result.ok) store = result.store;
    }
    const overflow = addCustomChallenge(store, challenge({ id: 'custom:extra', origin: 'custom' }));
    assert.equal(overflow.ok, false);
  });

  it('축하를 본 도전은 다시 띄우지 않는다', () => {
    assert.deepEqual(markCelebrated(emptyChallengeStore, 'a').celebratedIds, ['a']);
  });

  it('저장 값이 깨져도 쓸 수 있는 부분만 살린다', () => {
    const parsed = parseChallengeStore({
      joinedIds: ['a', 'a', 3],
      customChallenges: [challenge({ id: 'ok', origin: 'custom' }), { id: 'broken' }],
      celebratedIds: 'nope',
    });
    assert.deepEqual(parsed.joinedIds, ['a']);
    assert.deepEqual(parsed.customChallenges.map((item) => item.id), ['ok']);
    assert.deepEqual(parsed.celebratedIds, []);
    assert.deepEqual(parseChallengeStore(undefined), emptyChallengeStore);
  });
});

describe('표기', () => {
  it('종류마다 같은 단위를 쓴다', () => {
    assert.equal(formatChallengeValue('distance', 12.34), '12.3km');
    assert.equal(formatChallengeValue('minutes', 80.4), '80분');
    assert.equal(formatChallengeValue('sessions', 3), '3번');
    assert.equal(formatChallengeValue('activeDays', 2), '2일');
    assert.equal(formatChallengeAmount('distance', 12, 30), '12.0km / 30.0km');
  });
});

describe('참가자 수를 지어내지 않는다', () => {
  const files = [
    'domains/challenges/types.ts',
    'domains/challenges/catalog.ts',
    'domains/challenges/progress.ts',
    'domains/challenges/custom.ts',
    'domains/challenges/store.ts',
    'domains/challenges/useChallenges.ts',
    'app/screens/challenges/ChallengesScreen.tsx',
    'app/screens/challenges/ChallengeCard.tsx',
    'app/screens/challenges/ChallengeForm.tsx',
  ];

  it('참가자·명 수를 뜻하는 표현을 쓰지 않는다', () => {
    for (const file of files) {
      const text = source(file);
      // 안내 문구에서 "참가자 수를 보여 주지 않아요"라고 밝히는 곳만 예외입니다.
      const suspicious = text
        .split('\n')
        .filter((line) => /\d+명|참가자 \d|participantCount|참가 인원/.test(line));
      assert.deepEqual(suspicious, [], `${file}에 없는 참가자 수가 있습니다`);
    }
  });

  it('진행률과 예측이 순수 함수로 분리돼 있다', () => {
    const progress = source('domains/challenges/progress.ts');
    assert.match(progress, /export function challengeCurrent/);
    assert.match(progress, /export function challengeForecast/);
    assert.match(progress, /export function challengeInsight/);
    // 순수 모듈이라 저장소나 화면을 가져오지 않습니다.
    assert.equal(/AsyncStorage|react-native|expo-/.test(progress), false);
  });

  it('활동 기록 도메인은 읽기만 한다', () => {
    for (const file of files) {
      const text = source(file);
      assert.equal(
        /from '\.\.\/(activities|badges|races)\/.*'\s*;?\s*$/m.test(text) &&
          /insertActivity|queueActivityForSync|savePreferences/.test(text),
        false,
        `${file}이 다른 도메인에 쓰기를 합니다`,
      );
    }
  });

  it('화면은 참가한 게 없을 때 추천 하나를 크게 보여 준다', () => {
    const screen = source('app/screens/challenges/ChallengesScreen.tsx');
    assert.match(screen, /<EmptyState/);
    assert.match(screen, /recommended/);
    assert.match(screen, /featured/);
    assert.match(screen, /screenStyles/);
  });

  it('화면은 어려운 말을 쓰지 않는다', () => {
    for (const file of ['app/screens/challenges/ChallengesScreen.tsx', 'app/screens/challenges/ChallengeCard.tsx']) {
      const text = source(file);
      for (const word of ['스트릭', 'OAuth', 'SSO', '세션']) {
        assert.equal(text.includes(word), false, `${file}에 "${word}"가 있습니다`);
      }
    }
  });
});
