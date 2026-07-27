// "9주 달리기 시작" 프로그램 데이터가 표준 구성 그대로인지 회귀 검증합니다.
// 값이 하나라도 틀리면 사용자가 실제로 잘못된 시간을 뛰게 되므로 표 전체를 확인합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COOLDOWN_SECONDS,
  SESSIONS_PER_WEEK,
  WARMUP_SECONDS,
  beginnerProgram,
  findSession,
  sessionShape,
} from '../domains/programs/beginnerProgram';
import { formatDuration } from '../domains/programs/types';

function session(week: number, day: number) {
  const found = beginnerProgram.sessions.find(
    (item) => item.week === week && item.day === day,
  );
  assert.ok(found, `${week}주 ${day}일차가 없습니다`);
  return found;
}

/** 본운동 구간만 [종류, 초] 짝으로 뽑습니다. */
function main(week: number, day: number): Array<[string, number]> {
  return session(week, day)
    .segments.filter((segment) => segment.role === 'main')
    .map((segment) => [segment.kind, segment.seconds]);
}

function run(seconds: number): [string, number] {
  return ['run', seconds];
}

function walk(seconds: number): [string, number] {
  return ['walk', seconds];
}

function repeat(times: number, steps: Array<[string, number]>): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  for (let index = 0; index < times; index += 1) out.push(...steps);
  return out;
}

describe('9주 달리기 시작 - 뼈대', () => {
  it('이름에 영어 줄임말을 쓰지 않는다', () => {
    assert.equal(beginnerProgram.name, '9주 달리기 시작');
    assert.equal(/[A-Za-z]/.test(beginnerProgram.name), false);
  });

  it('9주 × 주 3회 = 27회차다', () => {
    assert.equal(beginnerProgram.weeks.length, 9);
    assert.equal(SESSIONS_PER_WEEK, 3);
    assert.equal(beginnerProgram.sessions.length, 27);
    for (const week of beginnerProgram.weeks) {
      assert.equal(week.sessions.length, 3);
    }
  });

  it('모든 회차가 빠르게 걷기 5분으로 시작하고 걷기 5분으로 끝난다', () => {
    assert.equal(WARMUP_SECONDS, 300);
    assert.equal(COOLDOWN_SECONDS, 300);
    for (const item of beginnerProgram.sessions) {
      const first = item.segments[0];
      const last = item.segments[item.segments.length - 1];
      assert.equal(first?.role, 'warmup');
      assert.equal(first?.kind, 'walk');
      assert.equal(first?.seconds, 300);
      assert.equal(first?.label, '빠르게 걷기');
      assert.equal(last?.role, 'cooldown');
      assert.equal(last?.kind, 'walk');
      assert.equal(last?.seconds, 300);
    }
  });

  it('회차 id와 제목이 겹치지 않고 순서대로 붙는다', () => {
    const ids = new Set(beginnerProgram.sessions.map((item) => item.id));
    assert.equal(ids.size, 27);
    assert.equal(beginnerProgram.sessions[0]?.title, '1주 1일차');
    assert.equal(beginnerProgram.sessions[26]?.title, '9주 3일차');
    assert.equal(findSession('start9-w5-d3')?.title, '5주 3일차');
    assert.equal(findSession('없는-회차'), undefined);
  });

  it('전체 시간이 구간 합과 같고 뛰기 시간도 따로 맞는다', () => {
    for (const item of beginnerProgram.sessions) {
      const sum = item.segments.reduce((acc, segment) => acc + segment.seconds, 0);
      assert.equal(item.totalSeconds, sum);
      const runSum = item.segments
        .filter((segment) => segment.kind === 'run')
        .reduce((acc, segment) => acc + segment.seconds, 0);
      assert.equal(item.runSeconds, runSum);
    }
  });
});

describe('9주 달리기 시작 - 주차별 구성', () => {
  it('1주: 뛰기 60초 + 걷기 90초를 8번', () => {
    for (let day = 1; day <= 3; day += 1) {
      assert.deepEqual(main(1, day), repeat(8, [run(60), walk(90)]));
    }
  });

  it('2주: 뛰기 90초 + 걷기 120초를 6번', () => {
    for (let day = 1; day <= 3; day += 1) {
      assert.deepEqual(main(2, day), repeat(6, [run(90), walk(120)]));
    }
  });

  it('3주: [뛰기 90초 + 걷기 90초 + 뛰기 3분 + 걷기 3분]을 2번', () => {
    for (let day = 1; day <= 3; day += 1) {
      assert.deepEqual(main(3, day), repeat(2, [run(90), walk(90), run(180), walk(180)]));
    }
  });

  it('4주: 3분·5분·3분·5분 뛰기', () => {
    for (let day = 1; day <= 3; day += 1) {
      assert.deepEqual(main(4, day), [
        run(180),
        walk(90),
        run(300),
        walk(150),
        run(180),
        walk(90),
        run(300),
      ]);
    }
  });

  it('5주: 날마다 다르고 3일차에 20분 연속으로 간다', () => {
    assert.deepEqual(main(5, 1), [run(300), walk(180), run(300), walk(180), run(300)]);
    assert.deepEqual(main(5, 2), [run(480), walk(300), run(480)]);
    assert.deepEqual(main(5, 3), [run(1200)]);
  });

  it('6주: 3일차에 22분 연속으로 간다', () => {
    assert.deepEqual(main(6, 1), [run(300), walk(180), run(480), walk(180), run(300)]);
    assert.deepEqual(main(6, 2), [run(600), walk(180), run(600)]);
    assert.deepEqual(main(6, 3), [run(1320)]);
  });

  it('7~9주: 25분·28분·30분을 걷지 않고 뛴다', () => {
    const expected: Record<number, number> = { 7: 1500, 8: 1680, 9: 1800 };
    for (const week of [7, 8, 9]) {
      for (let day = 1; day <= 3; day += 1) {
        assert.deepEqual(main(week, day), [run(expected[week] as number)]);
      }
    }
  });

  it('주차별 전체 시간 합계가 표와 같다', () => {
    // [주, 1일차, 2일차, 3일차] 단위는 초입니다.
    const expected: Array<[number, number, number, number]> = [
      [1, 1800, 1800, 1800],
      [2, 1860, 1860, 1860],
      [3, 1680, 1680, 1680],
      [4, 1890, 1890, 1890],
      [5, 1860, 1860, 1800],
      [6, 2040, 1980, 1920],
      [7, 2100, 2100, 2100],
      [8, 2280, 2280, 2280],
      [9, 2400, 2400, 2400],
    ];
    for (const [week, first, second, third] of expected) {
      assert.equal(session(week, 1).totalSeconds, first, `${week}주 1일차`);
      assert.equal(session(week, 2).totalSeconds, second, `${week}주 2일차`);
      assert.equal(session(week, 3).totalSeconds, third, `${week}주 3일차`);
    }
  });

  it('뛰는 시간이 1주 8분에서 9주 30분까지 늘어난다', () => {
    assert.equal(session(1, 1).runSeconds, 480);
    assert.equal(session(9, 3).runSeconds, 1800);
  });
});

describe('9주 달리기 시작 - 고비 회차', () => {
  it('5주 3일차와 6주 3일차만 고비로 표시한다', () => {
    const milestones = beginnerProgram.sessions
      .filter((item) => item.isMilestone)
      .map((item) => item.id);
    assert.deepEqual(milestones, ['start9-w5-d3', 'start9-w6-d3']);
  });

  it('고비 회차에는 응원 문구가 들어 있다', () => {
    for (const id of ['start9-w5-d3', 'start9-w6-d3']) {
      const item = findSession(id);
      assert.ok(item?.encouragement, `${id} 응원 문구 없음`);
      assert.ok((item?.encouragement ?? '').length > 30);
    }
    // 고비가 아닌 회차에는 붙이지 않습니다.
    assert.equal(findSession('start9-w1-d1')?.encouragement, undefined);
  });

  it('고비 회차는 처음으로 걷지 않고 이어서 뛰는 날이다', () => {
    assert.equal(session(5, 3).segments.filter((s) => s.role === 'main').length, 1);
    assert.equal(session(6, 3).segments.filter((s) => s.role === 'main').length, 1);
  });
});

describe('시간 표시', () => {
  it('사람이 읽는 말로 바꾼다', () => {
    assert.equal(formatDuration(60), '1분');
    assert.equal(formatDuration(90), '1분 30초');
    assert.equal(formatDuration(300), '5분');
    assert.equal(formatDuration(45), '45초');
  });

  it('회차 뼈대를 한 줄로 알려 준다', () => {
    assert.equal(
      sessionShape(session(1, 1)),
      '빠르게 걷기 5분 · 본운동 20분 · 걷기 5분 마무리',
    );
  });
});

describe('쉬운 말 규칙', () => {
  it('프로그램 문구에 어려운 말이나 영어를 쓰지 않는다', () => {
    const forbidden = [
      '스트릭',
      'RPE',
      '인터벌',
      '템포런',
      '테이퍼링',
      '볼륨',
      '세션',
      '컷백',
      '롱런',
    ];
    const texts = [
      beginnerProgram.name,
      beginnerProgram.subtitle,
      beginnerProgram.description,
      beginnerProgram.restNote,
      ...beginnerProgram.weeks.map((week) => week.focus),
      ...beginnerProgram.sessions.flatMap((item) => [
        item.title,
        item.summary,
        item.encouragement ?? '',
        ...item.segments.map((segment) => segment.label),
      ]),
    ];
    for (const text of texts) {
      for (const word of forbidden) {
        assert.equal(text.includes(word), false, `"${word}"가 "${text}"에 있습니다`);
      }
    }
  });
});
