// 9주 프로그램의 모든 회차가 "귀로 들을 수 있는지" 검사합니다.
//
// 회장 보고: "체계적 훈련에서 음성이 안 나온다."
// 원인은 TTS 고장이 아니라, 프로그램 회차 화면에 말하는 코드가 아예 없던 것이었습니다.
// 이 테스트는 그 상태로 되돌아가면 실패합니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { beginnerProgram } from '../domains/programs/beginnerProgram';
import { buildTimeline } from '../domains/programs/session';
import {
  programCoachCues,
  programCoachSession,
  spokenDuration,
} from '../domains/programs/coachSession';
import type { ProgramSession } from '../domains/programs/types';

const runnerSource = readFileSync(
  fileURLToPath(new URL('../app/screens/programs/SessionRunner.tsx', import.meta.url)),
  'utf8',
);

/** 9주 프로그램의 모든 회차입니다. */
const allSessions: ProgramSession[] = beginnerProgram.weeks.flatMap((week) => week.sessions);

describe('프로그램 회차 음성', () => {
  it('회차가 27개 모두 음성 시간표를 만든다', () => {
    assert.equal(allSessions.length, 27);
    for (const session of allSessions) {
      assert.ok(programCoachCues(session).length > 0, `${session.id}에 음성이 없습니다`);
    }
  });

  it('모든 구간에 "지금 무엇을 하는지" 말해 주는 안내가 있다', () => {
    // 이게 빠지면 주머니 속에서 걷는지 뛰는지 알 수 없습니다.
    for (const session of allSessions) {
      const cues = programCoachCues(session);
      const timeline = buildTimeline(session.segments);
      for (const entry of timeline.entries) {
        const atStart = cues.filter((cue) => cue.offsetSeconds === entry.startSeconds);
        assert.ok(
          atStart.some((cue) => cue.kind === 'instruction'),
          `${session.id} / ${entry.segment.label}(${entry.startSeconds}초) 시작 안내가 없습니다`,
        );
      }
    }
  });

  it('구간이 바뀌기 전에 미리 알려 준다', () => {
    for (const session of allSessions) {
      const cues = programCoachCues(session);
      const timeline = buildTimeline(session.segments);
      // 마지막 구간은 다음이 없으므로 뺍니다.
      for (const entry of timeline.entries.slice(0, -1)) {
        const ready = cues.some(
          (cue) => cue.offsetSeconds === entry.endSeconds - 10 && cue.kind === 'instruction',
        );
        assert.ok(ready, `${session.id} / ${entry.segment.label} 10초 전 예고가 없습니다`);
      }
    }
  });

  it('시작과 완료를 반드시 말한다', () => {
    for (const session of allSessions) {
      const cues = programCoachCues(session);
      assert.ok(cues.some((cue) => cue.kind === 'phase' && cue.offsetSeconds === 0));
      assert.ok(cues.some((cue) => cue.kind === 'safety'));
      assert.ok(cues.some((cue) => cue.kind === 'completion'));
    }
  });

  it('회차가 끝난 뒤나 시작 전에 말하지 않는다', () => {
    for (const session of allSessions) {
      const total = buildTimeline(session.segments).totalSeconds;
      for (const cue of programCoachCues(session)) {
        assert.ok(
          cue.offsetSeconds >= 0 && cue.offsetSeconds <= total,
          `${session.id}: ${cue.offsetSeconds}초는 0~${total} 밖입니다`,
        );
      }
    }
  });

  it('시간순으로 정렬돼 있다', () => {
    for (const session of allSessions) {
      const cues = programCoachCues(session);
      for (let index = 1; index < cues.length; index += 1) {
        assert.ok(cues[index].offsetSeconds >= cues[index - 1].offsetSeconds);
      }
    }
  });

  it('같은 회차는 언제나 같은 결과를 낸다', () => {
    // 결정적이어야 시뮬레이터로 검증할 수 있습니다.
    for (const session of allSessions.slice(0, 5)) {
      assert.deepEqual(programCoachCues(session), programCoachCues(session));
    }
  });

  it('길이를 귀에 들리는 말로 바꾼다', () => {
    assert.equal(spokenDuration(30), '30초');
    assert.equal(spokenDuration(60), '1분');
    assert.equal(spokenDuration(90), '1분 30초');
    assert.equal(spokenDuration(1800), '30분');
  });

  it('메인 코치 엔진이 받는 형태로 감싼다', () => {
    const session = allSessions[0];
    const coach = programCoachSession(session);
    assert.equal(coach.id, session.id);
    assert.ok(coach.phases.length === session.segments.length);
    assert.ok(coach.durationMinutes > 0);
    // 단계가 시간 순서대로 이어져야 합니다.
    for (let index = 1; index < coach.phases.length; index += 1) {
      assert.equal(coach.phases[index].startSeconds, coach.phases[index - 1].endSeconds);
    }
  });
});

describe('회차 화면과 음성 엔진 연결', () => {
  it('회차 화면이 메인 코치 엔진을 실제로 시작한다', () => {
    // 이 줄이 사라지면 프로그램 회차가 다시 무음이 됩니다.
    assert.ok(
      runnerSource.includes('startCoachSession(programCoachSession(session))'),
      '회차 화면이 음성 엔진을 시작하지 않습니다',
    );
  });

  it('화면을 벗어나면 음성을 정리한다', () => {
    assert.ok(runnerSource.includes('stopCoachSession()'), '음성이 계속 남습니다');
  });

  it('일시정지·재개를 음성에도 전달한다', () => {
    assert.ok(runnerSource.includes('pauseCoachSession()'));
    assert.ok(runnerSource.includes('resumeCoachSession()'));
  });
});
