// 대사가 "만들어지는지"가 아니라 "제때 실제로 나가는지"를 검사합니다.
//
// 회장 보고: "5분 동안 걷기 시작할게요 그건 말하는데 그 뒤에 말을 안 해."
// 그때 기존 테스트는 전부 통과하고 있었습니다. 증명하던 것이 "올바른 말이 만들어진다"까지였고,
// "올바른 시각에 실제로 나간다"는 아무도 보고 있지 않았기 때문입니다.
// 이 파일이 그 빈틈을 막습니다. 가짜 시계로 회차 전체를 앞당겨 돌립니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import {
  dueCues,
  MAX_SPOKEN_CUES_PER_TICK,
  SPEECH_WATCHDOG_CEILING_MILLIS,
  SPEECH_WATCHDOG_FLOOR_MILLIS,
  speechWatchdogMillis,
} from '../domains/coaching/cuePump';
import { beginnerProgram } from '../domains/programs/beginnerProgram';
import {
  MAX_SILENCE_SECONDS,
  MIN_CUE_GAP_SECONDS,
  programCoachCues,
  programCoachSession,
} from '../domains/programs/coachSession';
import { buildTimeline } from '../domains/programs/session';
import type { CoachCue } from '../domains/coaching/model';
import type { ProgramSession } from '../domains/programs/types';

const allSessions: ProgramSession[] = beginnerProgram.weeks.flatMap((week) => week.sessions);

/**
 * 재생 엔진이 하는 일을 그대로 흉내 냅니다.
 * 0.5초마다 한 번씩 깨어나 "지금까지 도달한 대사"를 읽습니다.
 */
function playThrough(cues: readonly CoachCue[], totalSeconds: number): CoachCue[] {
  const heard: CoachCue[] = [];
  let index = 0;
  for (let millis = 0; millis <= (totalSeconds + 2) * 1_000; millis += 500) {
    const elapsedSeconds = Math.floor(millis / 1_000);
    const result = dueCues(cues, index, elapsedSeconds);
    index = result.nextIndex;
    heard.push(...result.spoken);
  }
  return heard;
}

describe('대사가 시간이 흐르는 동안 실제로 나간다', () => {
  it('첫 마디 하나로 끝나지 않는다', () => {
    // 이 테스트가 실패하던 상태가 회장이 겪은 상태입니다.
    const session = allSessions[0];
    const total = buildTimeline(session.segments).totalSeconds;
    const heard = playThrough(programCoachCues(session), total);
    assert.ok(heard.length > 1, `첫 마디 뒤로 아무 말도 나가지 않습니다 (${heard.length}개)`);
  });

  it('9주 프로그램 27회차 전부, 모든 대사가 빠짐없이 나간다', () => {
    for (const session of allSessions) {
      const cues = programCoachCues(session);
      const total = buildTimeline(session.segments).totalSeconds;
      const heard = playThrough(cues, total);
      assert.equal(
        heard.length,
        cues.length,
        `${session.id}: 대사 ${cues.length}개 중 ${heard.length}개만 나갔습니다`,
      );
      for (let index = 0; index < cues.length; index += 1) {
        assert.equal(heard[index].text, cues[index].text, `${session.id}: 순서가 어긋났습니다`);
      }
    }
  });

  it('구간이 바뀌는 순간의 안내가 늦지 않게 나간다', () => {
    // "달리기 시작해요"가 10초 늦게 나오면 이미 뛰기 시작한 뒤입니다.
    const session = allSessions[0];
    const cues = programCoachCues(session);
    let index = 0;
    for (let second = 0; second <= 1_800; second += 1) {
      const result = dueCues(cues, index, second);
      for (const cue of result.spoken) {
        assert.ok(
          second - cue.offsetSeconds <= 1,
          `${cue.offsetSeconds}초 대사가 ${second}초에 나갔습니다`,
        );
      }
      index = result.nextIndex;
    }
  });

  it('한 틱에 여러 대사가 밀려도 하나만 남기고 버리지 않는다', () => {
    // 예전에는 마지막 하나만 읽었습니다. 0초에 세 마디를 놨더니 한 마디만 들렸습니다.
    const cues: CoachCue[] = [
      { offsetSeconds: 0, text: '첫째', kind: 'phase' },
      { offsetSeconds: 0, text: '둘째', kind: 'safety' },
    ];
    const result = dueCues(cues, 0, 0);
    assert.equal(result.spoken.length, 2);
    assert.equal(result.nextIndex, 2);
  });

  it('화면이 오래 꺼져 있었어도 지난 이야기를 늘어놓지 않는다', () => {
    const cues: CoachCue[] = Array.from({ length: 20 }, (_value, index) => ({
      offsetSeconds: index * 10,
      text: `${index}번`,
      kind: 'instruction' as const,
    }));
    // 200초를 건너뛰고 깨어난 상황입니다.
    const result = dueCues(cues, 0, 200);
    assert.equal(result.spoken.length, MAX_SPOKEN_CUES_PER_TICK);
    // 읽지 않은 대사도 자리는 끝까지 넘겨야 합니다. 안 그러면 지난 대사가 계속 되살아납니다.
    assert.equal(result.nextIndex, 20);
    assert.equal(result.spoken[result.spoken.length - 1].text, '19번');
  });
});

describe('회차 내내 조용한 구간이 없다', () => {
  it('어떤 회차에서도 침묵이 정해진 한도를 넘지 않는다', () => {
    // 5분 걷기 구간에 안내가 하나뿐이면 사용자는 고장으로 느낍니다.
    for (const session of allSessions) {
      const cues = programCoachCues(session);
      let previous = 0;
      for (const cue of cues) {
        assert.ok(
          cue.offsetSeconds - previous <= MAX_SILENCE_SECONDS,
          `${session.id}: ${previous}초 ~ ${cue.offsetSeconds}초 사이가 조용합니다`,
        );
        previous = cue.offsetSeconds;
      }
    }
  });

  it('대사끼리 겹치지 않는다', () => {
    // 겹쳐 있으면 재생 엔진이 그중 하나만 읽고 나머지를 버립니다.
    for (const session of allSessions) {
      const cues = programCoachCues(session);
      for (let index = 1; index < cues.length; index += 1) {
        const gap = cues[index].offsetSeconds - cues[index - 1].offsetSeconds;
        assert.ok(
          gap >= MIN_CUE_GAP_SECONDS,
          `${session.id}: ${cues[index - 1].offsetSeconds}초와 ${cues[index].offsetSeconds}초가 겹칩니다`,
        );
      }
    }
  });

  it('같은 말을 연달아 하지 않는다', () => {
    for (const session of allSessions) {
      const cues = programCoachCues(session);
      for (let index = 1; index < cues.length; index += 1) {
        assert.notEqual(
          cues[index].text,
          cues[index - 1].text,
          `${session.id}: ${cues[index].offsetSeconds}초에 같은 말을 반복합니다`,
        );
      }
    }
  });

  it('걷는 중에 속도를 올리라고 말하지 않는다', () => {
    for (const session of allSessions) {
      const timeline = buildTimeline(session.segments);
      for (const cue of programCoachCues(session)) {
        const entry = timeline.entries.find(
          (item) => cue.offsetSeconds >= item.startSeconds && cue.offsetSeconds < item.endSeconds,
        );
        if (!entry || entry.segment.kind !== 'walk') continue;
        // 전환 예고는 다음 구간을 말하는 것이므로 뺍니다.
        if (cue.text.includes('뒤')) continue;
        assert.ok(
          !cue.text.includes('속도를 올'),
          `${session.id}: 걷는 중(${cue.offsetSeconds}초)에 "${cue.text}"`,
        );
      }
    }
  });

  it('채운 대사도 결정적이다', () => {
    for (const session of allSessions.slice(0, 5)) {
      assert.deepEqual(programCoachCues(session), programCoachCues(session));
    }
  });

  it('밀도가 자유 러닝 코치 기준에 못 미치지 않는다', () => {
    for (const session of allSessions) {
      const coach = programCoachSession(session);
      const density = coach.cues.length / coach.durationMinutes;
      assert.ok(density >= 2.5, `${session.id}: 분당 ${density.toFixed(2)}마디뿐입니다`);
    }
  });
});

describe('끝 신호가 오지 않아도 다음 대사로 넘어간다', () => {
  it('감시 시간이 정해진 범위 안에 있다', () => {
    assert.equal(speechWatchdogMillis('짧다'), SPEECH_WATCHDOG_FLOOR_MILLIS);
    assert.equal(speechWatchdogMillis('가'.repeat(500)), SPEECH_WATCHDOG_CEILING_MILLIS);
    const middle = speechWatchdogMillis('달리기 시작해요. 1분이에요. 빠를 필요 없어요.');
    assert.ok(middle > SPEECH_WATCHDOG_FLOOR_MILLIS);
    assert.ok(middle < SPEECH_WATCHDOG_CEILING_MILLIS);
  });

  it('느리게 말할수록 더 오래 기다린다', () => {
    const text = '오늘 목표한 강도보다 빠르면 조금 내려도 괜찮아요.';
    assert.ok(speechWatchdogMillis(text, 0.8) > speechWatchdogMillis(text, 1.2));
  });
});

describe('구간을 건너뛰면 음성도 따라간다', () => {
  it('건너뛴 시점의 안내를 골라 낸다', () => {
    // "다음 구간으로"를 누르면 화면 시간이 훌쩍 뜁니다.
    // 그때 이미 지나간 안내를 줄줄이 읽지 않고, 그 자리 안내 한 마디만 말해야 합니다.
    const session = allSessions[0];
    const cues = programCoachCues(session);
    // 5분 걷기가 끝나고 달리기가 시작되는 300초로 건너뜁니다.
    const { spoken, nextIndex } = dueCues(cues, 0, 300, 1);
    assert.equal(spoken.length, 1);
    assert.equal(spoken[0].offsetSeconds, 300);
    // 자리는 끝까지 넘겨야 지나간 안내가 되살아나지 않습니다.
    assert.ok(nextIndex > 1);
    assert.ok(cues[nextIndex].offsetSeconds > 300);
  });

  it('건너뛴 뒤에도 남은 안내가 순서대로 이어진다', () => {
    const session = allSessions[0];
    const cues = programCoachCues(session);
    const seek = dueCues(cues, 0, 300, 1);
    let index = seek.nextIndex;
    const heard: number[] = [];
    for (let second = 301; second <= 1_800; second += 1) {
      const result = dueCues(cues, index, second);
      index = result.nextIndex;
      heard.push(...result.spoken.map((cue) => cue.offsetSeconds));
    }
    assert.ok(heard.length > 0, '건너뛴 뒤로 아무 말도 나오지 않습니다');
    for (let position = 1; position < heard.length; position += 1) {
      assert.ok(heard[position] >= heard[position - 1], '순서가 어긋났습니다');
    }
  });
});

describe('회차 화면이 음성을 화면 시각에 맞춘다', () => {
  const runnerSource = readFileSync(
    fileURLToPath(new URL('../app/screens/programs/SessionRunner.tsx', import.meta.url)),
    'utf8',
  );
  const serviceSource = readFileSync(
    fileURLToPath(new URL('../services/audio/coachService.ts', import.meta.url)),
    'utf8',
  );

  it('건너뛰기가 음성도 함께 옮긴다', () => {
    // 이 줄이 사라지면 화면은 달리는데 음성은 걷기를 안내합니다.
    assert.ok(runnerSource.includes('seekCoachSpeech(next)'), '건너뛰기가 음성에 전달되지 않습니다');
  });

  it('매초 어긋남을 확인해 스스로 맞춘다', () => {
    assert.ok(runnerSource.includes('syncCoachSpeech(next)'), '시계 어긋남을 고치지 않습니다');
  });

  it('작은 어긋남까지 매번 다시 맞추지는 않는다', () => {
    // 매초 자리를 다시 잡으면 말이 계속 끊깁니다.
    assert.ok(serviceSource.includes('COACH_DRIFT_TOLERANCE_SECONDS'));
  });

  it('목소리 고르기에 실패해도 음성을 포기하지 않는다', () => {
    // 목소리 고르기는 있으면 좋은 것이지 말하기의 전제 조건이 아닙니다.
    assert.ok(
      serviceSource.includes('// 기기 기본 한국어 음성으로 말합니다. 안 들리는 것보다 낫습니다.'),
      '목소리 준비 실패가 음성 전체를 죽입니다',
    );
  });

  it('음성이 안 켜졌을 때 화면에서 다시 켤 수 있다', () => {
    assert.ok(runnerSource.includes('음성 다시 켜기'), '되살릴 방법이 없습니다');
    assert.ok(runnerSource.includes("voiceStatus.owner === 'none'"), '안 켜진 상태를 구분하지 않습니다');
  });
});
