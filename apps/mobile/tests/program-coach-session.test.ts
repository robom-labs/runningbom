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
  MIN_CUE_GAP_SECONDS,
  programCoachCues,
  programCoachSession,
  spokenDuration,
} from '../domains/programs/coachSession';
import type { ProgramSession } from '../domains/programs/types';

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

const runnerSource = read('../app/screens/programs/SessionRunner.tsx');
const serviceSource = read('../services/audio/coachService.ts');

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
        // 첫 구간만은 여는 인사와 겹치지 않게 몇 초 뒤에 말합니다.
        // 0초에 몰아 두면 재생 엔진이 그중 하나만 읽고 나머지를 버립니다.
        const window = entry.index === 0 ? MIN_CUE_GAP_SECONDS * 2 : 0;
        const atStart = cues.filter(
          (cue) =>
            cue.offsetSeconds >= entry.startSeconds &&
            cue.offsetSeconds <= entry.startSeconds + window,
        );
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
      runnerSource.includes('startCoachSession(programCoachSession(session)'),
      '회차 화면이 음성 엔진을 시작하지 않습니다',
    );
  });

  it('회차 음성은 앱이 직접 말한다', () => {
    // 기기 서비스의 대사표에만 의존하던 동안 첫 대사만 들리고 조용해지는 일이 두 번 있었습니다.
    // 그 서비스 안은 앱에서 볼 수 없고 원격 수정도 안 됩니다. 들리는 것이 확인된 경로를 씁니다.
    assert.ok(
      runnerSource.includes("speechOwner: 'app'"),
      '회차 음성이 다시 기기 서비스에만 맡겨졌습니다',
    );
  });

  it('두 곳이 같이 말하지 않는다', () => {
    // 앱이 말할 때 기기 서비스에도 대사표를 주면 같은 문장이 두 번 들립니다.
    assert.ok(
      serviceSource.includes("speechOwner === 'app' ? '' : cueScheduleForNative(session)"),
      '앱이 말할 때 기기 서비스에도 대사표가 넘어갑니다',
    );
  });

  it('멈춤·재개·정지가 앱 음성에도 전달된다', () => {
    // 멈췄는데 앱이 계속 말하면 더 나쁩니다.
    for (const guard of ['if (appSpeechActive)']) {
      const count = serviceSource.split(guard).length - 1;
      assert.ok(count >= 3, `앱 음성 정리가 ${count}곳에만 있습니다(멈춤·재개·정지 3곳 필요)`);
    }
  });

  it('화면을 벗어나면 음성을 정리한다', () => {
    assert.ok(runnerSource.includes('stopCoachSession()'), '음성이 계속 남습니다');
  });

  it('일시정지·재개를 음성에도 전달한다', () => {
    assert.ok(runnerSource.includes('pauseCoachSession()'));
    assert.ok(runnerSource.includes('resumeCoachSession()'));
  });

  it('화면이 처음 그려질 때 재개 신호를 먼저 보내지 않는다', () => {
    // 시작이 준비되는 동안 재개 신호가 먼저 닿으면 엔진이 시작 전 상태에서 그 신호를 받습니다.
    assert.ok(
      runnerSource.includes('pausedSentRef'),
      '멈춤 상태가 실제로 바뀌었는지 구분하지 않습니다',
    );
  });
});

describe('재생 엔진이 스스로 멈추지 않는다', () => {
  it('잠시 멈춤 상태에서도 다음 확인을 예약한다', () => {
    // 예전에는 running이 아니면 재예약 없이 빠져나가, 그 뒤로 영영 조용했습니다.
    assert.ok(
      serviceSource.includes("fallbackState.state === 'completed'"),
      '끝난 경우와 잠시 멈춘 경우를 구분하지 않습니다',
    );
    assert.ok(!/state !== 'running'\) return;/.test(serviceSource));
  });

  it('밀린 대사를 하나만 남기고 버리지 않는다', () => {
    assert.ok(serviceSource.includes('dueCues('), '대사 선택 규칙을 공유하지 않습니다');
  });

  it('끝 신호가 유실돼도 큐가 잠기지 않는다', () => {
    assert.ok(serviceSource.includes('speechWatchdogMillis'), '발화 감시 장치가 없습니다');
  });
});
