// 도전이 안전하고, 기록을 정확히 해석하는지 검사합니다.
//
// 도전이 지켜야 할 가장 중요한 규칙: **훈련량을 늘리라고 시키지 않는다.**
// 쉬는 날을 못 쉬게 하는 도전은 사람을 다치게 합니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import type { ActivityRecord } from '../domains/activities/types';
import {
  achievedChallenges,
  activeChallenges,
  challengeCategoryLabels,
  challengeProgress,
  challenges,
  validateChallenges,
  windowStart,
} from '../domains/challenges/library';

const screenSource = readFileSync(
  fileURLToPath(new URL('../app/screens/programs/ProgramsScreen.tsx', import.meta.url)),
  'utf8',
);

// 2026-07-27은 **월요일**입니다. 주 단위 도전은 이 날이 그 주의 첫날입니다.
// 그래서 "1일 전"(일요일)은 지난주에 들어갑니다. 아래 테스트가 그 경계를 지킵니다.
const NOW = new Date('2026-07-27T12:00:00Z');

function record(
  daysAgo: number,
  kind: ActivityRecord['kind'],
  durationMinutes: number,
  distanceKm?: number,
): ActivityRecord {
  return {
    id: `a-${daysAgo}-${kind}`,
    localUuid: `u-${daysAgo}-${kind}`,
    kind,
    durationMinutes,
    ...(distanceKm === undefined ? {} : { distanceKm }),
    source: 'COACH_COMPLETED',
    completedAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
    timezoneId: 'Asia/Seoul',
  };
}

/** 이번 주 안에 확실히 들어가는 기록입니다(오늘, 서로 다른 시각). */
let thisWeekCounter = 0;
function thisWeek(
  kind: ActivityRecord['kind'],
  durationMinutes: number,
  distanceKm?: number,
): ActivityRecord {
  thisWeekCounter += 1;
  return {
    ...record(0, kind, durationMinutes, distanceKm),
    id: `week-${thisWeekCounter}`,
    localUuid: `week-${thisWeekCounter}`,
  };
}

const byId = (id: string) => {
  const found = challenges.find((challenge) => challenge.id === id);
  assert.ok(found, `${id} 도전이 없습니다`);
  return found!;
};

describe('도전 목록', () => {
  it('30개 이상 있고 규칙을 지킨다', () => {
    assert.deepEqual(validateChallenges(), []);
    assert.ok(challenges.length >= 30, `도전이 ${challenges.length}개뿐입니다`);
  });

  it('도전 ID가 겹치지 않는다', () => {
    const ids = new Set(challenges.map((challenge) => challenge.id));
    assert.equal(ids.size, challenges.length);
  });

  it('쉬는 날을 못 쉬게 하는 도전이 없다', () => {
    // 세는 방법 자체에 "연속"이 없어야 구조적으로 안전합니다.
    for (const challenge of challenges) {
      assert.ok(
        ['sessions', 'minutes', 'distanceKm', 'days'].includes(challenge.metric),
        `${challenge.id}: 모르는 세는 방법입니다`,
      );
      assert.ok(!/연속/.test(challenge.title), `${challenge.id}: 제목이 연속을 요구합니다`);
    }
  });

  it('걷기만 해도 되는 도전이 충분히 있다', () => {
    // 달리기만 인정하면 걷는 사람이 앱을 떠납니다.
    const walkable = challenges.filter((challenge) => challenge.countsWalking);
    assert.ok(walkable.length >= challenges.length / 2, '걷기를 세는 도전이 너무 적습니다');
  });

  it('모든 갈래가 비어 있지 않다', () => {
    const used = new Set(challenges.map((challenge) => challenge.category));
    assert.equal(used.size, Object.keys(challengeCategoryLabels).length);
  });

  it('처음 쓰는 사람이 바로 이룰 수 있는 도전이 있다', () => {
    // 첫날 아무것도 못 이루면 다시 안 옵니다.
    const first = challengeProgress(byId('all-first-move'), [record(0, 'walk', 10)], NOW);
    assert.equal(first.achieved, true);
  });
});

describe('기록을 정확히 센다', () => {
  it('횟수를 센다', () => {
    const result = challengeProgress(
      byId('week-move-3'),
      [thisWeek('run', 30), thisWeek('walk', 20)],
      NOW,
    );
    assert.equal(result.current, 2);
    assert.equal(result.achieved, false);
    assert.ok(result.note.includes('1회'));
  });

  it('주 단위 도전은 이번 주 것만 센다', () => {
    // 월요일이 주의 첫날입니다. 어제(일요일)는 지난주이므로 세지 않습니다.
    const lastSunday = record(1, 'run', 30);
    assert.equal(challengeProgress(byId('week-move-2'), [lastSunday], NOW).current, 0);
    // 같은 기록도 최근 30일 도전에서는 셉니다.
    assert.equal(challengeProgress(byId('rolling30-days-10'), [lastSunday], NOW).current, 1);
  });

  it('걷기만 세는 도전과 달리기만 세는 도전을 구분한다', () => {
    const activities = [thisWeek('run', 30), thisWeek('walk', 20)];
    assert.equal(challengeProgress(byId('week-move-2'), activities, NOW).current, 2);
    // 달리기만 세는 도전은 걷기를 빼야 합니다.
    assert.equal(challengeProgress(byId('week-run-2'), activities, NOW).current, 1);
  });

  it('시간을 더한다', () => {
    const result = challengeProgress(
      byId('week-minutes-60'),
      [thisWeek('run', 30), thisWeek('walk', 35)],
      NOW,
    );
    assert.equal(result.current, 65);
    assert.equal(result.achieved, true);
  });

  it('거리가 없는 기록은 거리로 세지 않는다', () => {
    // 거리 없이 시간만 남긴 기록이 0km로 섞이면 안 됩니다.
    const result = challengeProgress(
      byId('week-km-5'),
      [thisWeek('run', 30), thisWeek('run', 30, 5)],
      NOW,
    );
    assert.equal(result.current, 5);
  });

  it('하루에 여러 번 해도 하루로 센다', () => {
    const twiceToday = [record(0, 'run', 20), record(0, 'walk', 20)];
    // 같은 날짜이므로 1일입니다.
    const result = challengeProgress(byId('month-days-8'), twiceToday, NOW);
    assert.equal(result.current, 1);
  });

  it('기간 밖의 기록은 세지 않는다', () => {
    const old = [record(400, 'run', 30, 10)];
    assert.equal(challengeProgress(byId('week-km-5'), old, NOW).current, 0);
    // 전체 기간 도전은 오래된 기록도 셉니다.
    assert.equal(challengeProgress(byId('all-first-move'), old, NOW).achieved, true);
  });

  it('기간의 시작을 올바르게 잡는다', () => {
    assert.equal(windowStart('allTime', NOW), undefined);
    const month = windowStart('month', NOW);
    assert.equal(month?.getDate(), 1);
    const rolling = windowStart('rolling30', NOW);
    assert.ok(rolling && rolling < NOW);
    const week = windowStart('week', NOW);
    // 월요일 시작이므로 요일 번호가 1이어야 합니다.
    assert.equal(week?.getDay(), 1);
  });

  it('진행률이 1을 넘지 않는다', () => {
    const many = Array.from({ length: 20 }, (_value, index) => record(index % 7, 'run', 60, 10));
    const result = challengeProgress(byId('week-move-2'), many, NOW);
    assert.ok(result.ratio <= 1);
  });

  it('같은 기록이면 언제나 같은 결과가 나온다', () => {
    const activities = [record(0, 'run', 30, 5), record(2, 'walk', 20, 2)];
    for (const challenge of challenges.slice(0, 10)) {
      assert.deepEqual(
        challengeProgress(challenge, activities, NOW),
        challengeProgress(challenge, activities, NOW),
      );
    }
  });
});

describe('무엇을 보여 줄지 고른다', () => {
  it('기록이 하나도 없어도 빈 화면을 주지 않는다', () => {
    const shown = activeChallenges([], NOW);
    assert.ok(shown.length > 0);
  });

  it('거의 같은 도전만 늘어놓지 않는다', () => {
    // "이번 주 2번·3번·4번"이 나란히 나오면 고를 이유가 없습니다.
    const shown = activeChallenges([], NOW);
    const categories = new Set(shown.map((item) => item.challenge.category));
    assert.ok(categories.size >= 3, `갈래가 ${categories.size}개뿐입니다`);
  });

  it('이룬 도전을 하나는 남긴다', () => {
    // 성취가 화면에서 사라지면 계속할 이유가 줄어듭니다.
    const activities = [record(0, 'walk', 10)];
    const shown = activeChallenges(activities, NOW);
    assert.ok(shown.some((item) => item.achieved), '이룬 도전이 하나도 안 보입니다');
  });

  it('보여 주는 개수를 제한한다', () => {
    assert.ok(activeChallenges([], NOW).length <= 5);
    assert.ok(activeChallenges([], NOW, 3).length <= 3);
  });

  it('이룬 도전만 따로 모을 수 있다', () => {
    const activities = [record(0, 'run', 30, 5)];
    const done = achievedChallenges(activities, NOW);
    assert.ok(done.every((item) => item.achieved));
    assert.ok(done.some((item) => item.challenge.id === 'all-first-run'));
  });
});

describe('도전이 화면에 연결돼 있다', () => {
  it('프로그램 화면이 도전판을 실제로 그린다', () => {
    assert.ok(screenSource.includes('<ChallengeBoard'), '도전판이 화면에 없습니다');
  });

  it('활동 기록을 그대로 넘긴다', () => {
    assert.ok(screenSource.includes('activities={activities}'));
  });
});
