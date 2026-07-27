// 회차 실행(구간 타임라인·미리 알림·건너뛰기)과 완주율 진급 판정, 저장 값 규칙을 검증합니다.
// 화면은 렌더링하지 않고, 순수 함수와 화면 소스 텍스트만 검사해 새 의존성 없이 돌아갑니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { beginnerProgram, findSession } from '../domains/programs/beginnerProgram';
import {
  PASS_RATIO,
  completionRatio,
  judgeSession,
  programProgress,
  progressSummary,
} from '../domains/programs/progress';
import {
  CUE_LEAD_SECONDS,
  buildTimeline,
  cueText,
  elapsedLabel,
  remainingSegmentsLabel,
  ribbonCells,
  sessionNow,
  sessionTimeline,
  skipToNextSegment,
} from '../domains/programs/session';
import {
  PROGRAM_STORE_KEY,
  bestAttempt,
  emptyProgramStore,
  parseProgramStore,
  restartProgram,
  saveAttempt,
} from '../domains/programs/store';
import { formatClock, type ProgramSession } from '../domains/programs/types';

const root = join(import.meta.dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

const week1 = findSession('start9-w1-d1') as ProgramSession;

describe('구간 타임라인', () => {
  it('구간이 시작·끝 시각을 이어서 갖는다', () => {
    const timeline = buildTimeline([
      { id: 'a', kind: 'walk', role: 'warmup', seconds: 300, label: '빠르게 걷기' },
      { id: 'b', kind: 'run', role: 'main', seconds: 60, label: '뛰기' },
      { id: 'c', kind: 'walk', role: 'cooldown', seconds: 300, label: '마무리 걷기' },
    ]);
    assert.equal(timeline.totalSeconds, 660);
    assert.deepEqual(
      timeline.entries.map((entry) => [entry.startSeconds, entry.endSeconds]),
      [
        [0, 300],
        [300, 360],
        [360, 660],
      ],
    );
  });

  it('회차 전체 시간과 타임라인 길이가 같다', () => {
    for (const session of beginnerProgram.sessions) {
      assert.equal(sessionTimeline(session).totalSeconds, session.totalSeconds);
    }
  });
});

describe('지금 무엇을 하는지', () => {
  const timeline = sessionTimeline(week1);

  it('시작하면 빠르게 걷기부터다', () => {
    const now = sessionNow(timeline, 0);
    assert.equal(now.entry.segment.label, '빠르게 걷기');
    assert.equal(now.remainingSeconds, 300);
    assert.equal(now.segmentRatio, 0);
    assert.equal(now.finished, false);
  });

  it('구간 경계에서 다음 구간으로 넘어간다', () => {
    assert.equal(sessionNow(timeline, 299).entry.segment.label, '빠르게 걷기');
    assert.equal(sessionNow(timeline, 300).entry.segment.label, '뛰기');
    assert.equal(sessionNow(timeline, 300).remainingSeconds, 60);
  });

  it('남은 구간 수를 센다', () => {
    const now = sessionNow(timeline, 0);
    assert.equal(now.remainingSegments, week1.segments.length - 1);
    assert.equal(remainingSegmentsLabel(now.remainingSegments), `남은 구간 ${now.remainingSegments}개`);
    assert.equal(remainingSegmentsLabel(0), '마지막 구간이에요');
  });

  it('끝나면 끝난 것으로 알린다', () => {
    const now = sessionNow(timeline, week1.totalSeconds + 10);
    assert.equal(now.finished, true);
    assert.equal(now.totalRatio, 1);
    assert.equal(now.remainingSegments, 0);
    assert.equal(now.upcomingCue, undefined);
  });

  it('전체 경과 시간을 시계 모양으로 보여 준다', () => {
    assert.equal(formatClock(0), '0:00');
    assert.equal(formatClock(65), '1:05');
    assert.equal(formatClock(3665), '1:01:05');
    assert.equal(elapsedLabel(65, 1800), '1:05 / 30:00');
  });
});

describe('구간이 바뀌기 10초 전 미리 알림', () => {
  const timeline = sessionTimeline(week1);

  it('10초를 미리 알린다', () => {
    assert.equal(CUE_LEAD_SECONDS, 10);
  });

  it('10초 전부터 화면에 알림 문구가 생긴다', () => {
    assert.equal(sessionNow(timeline, 289).upcomingCue, undefined);
    assert.equal(sessionNow(timeline, 290).upcomingCue, '10초 뒤 뛰기 시작');
    assert.equal(sessionNow(timeline, 299).upcomingCue, '10초 뒤 뛰기 시작');
  });

  it('뛰기 다음이 걷기면 걷기로 바꾸라고 알린다', () => {
    assert.equal(sessionNow(timeline, 355).upcomingCue, '10초 뒤 걷기로 바꿔요');
  });

  it('알림 문구를 따로도 만들 수 있다', () => {
    assert.equal(cueText(undefined, 10), '10초 뒤에 끝나요');
    assert.equal(
      cueText({ id: 'x', kind: 'walk', role: 'cooldown', seconds: 300, label: '마무리 걷기' }, 10),
      '10초 뒤 마무리 걷기',
    );
  });
});

describe('다음 구간 건너뛰기', () => {
  const timeline = sessionTimeline(week1);

  it('지금 구간 끝으로 시간을 옮긴다', () => {
    assert.equal(skipToNextSegment(timeline, 0), 300);
    assert.equal(skipToNextSegment(timeline, 300), 360);
  });

  it('마지막에서 더 건너뛰면 회차가 끝난다', () => {
    assert.equal(skipToNextSegment(timeline, week1.totalSeconds), week1.totalSeconds);
  });
});

describe('상단 구간 띠', () => {
  const timeline = sessionTimeline(week1);

  it('구간 수만큼 칸을 만들고 넓이 합이 1이다', () => {
    const cells = ribbonCells(timeline, 0);
    assert.equal(cells.length, week1.segments.length);
    const sum = cells.reduce((acc, cell) => acc + cell.widthRatio, 0);
    assert.ok(Math.abs(sum - 1) < 0.0001);
  });

  it('지난 칸·지금 칸·앞으로 올 칸을 나눈다', () => {
    const cells = ribbonCells(timeline, 2);
    assert.equal(cells[0]?.state, 'done');
    assert.equal(cells[2]?.state, 'current');
    assert.equal(cells[3]?.state, 'upcoming');
  });

  it('칸마다 분 표시와 걷기·뛰기 구분을 갖는다', () => {
    const cells = ribbonCells(timeline, 0);
    assert.equal(cells[0]?.minuteLabel, '5분');
    assert.equal(cells[0]?.kind, 'walk');
    assert.equal(cells[1]?.minuteLabel, '1분');
    assert.equal(cells[1]?.kind, 'run');
  });
});

describe('진급 판정 - 완주율 80%', () => {
  it('기준은 80%다', () => {
    assert.equal(PASS_RATIO, 0.8);
  });

  it('완주율을 0~1로 계산한다', () => {
    assert.equal(completionRatio(900, 1800), 0.5);
    assert.equal(completionRatio(2000, 1800), 1);
    assert.equal(completionRatio(100, 0), 0);
    assert.equal(completionRatio(-5, 1800), 0);
  });

  it('80% 이상이면 완료로 보고 다음 회차를 권한다', () => {
    const verdict = judgeSession({ completedSeconds: 1440, totalSeconds: 1800 });
    assert.equal(verdict.passed, true);
    assert.equal(verdict.percent, 80);
    assert.equal(verdict.suggestRepeat, false);
    assert.equal(verdict.primaryLabel, '다음 회차로');
  });

  it('80% 미만이면 한 번 더 하기를 권한다', () => {
    const verdict = judgeSession({ completedSeconds: 1000, totalSeconds: 1800 });
    assert.equal(verdict.passed, false);
    assert.equal(verdict.suggestRepeat, true);
    assert.equal(verdict.primaryLabel, '같은 회차 한 번 더');
    assert.match(verdict.message, /한 번 더 해볼까요/);
  });

  it('권하기만 하고 막지는 않는다', () => {
    const low = judgeSession({ completedSeconds: 10, totalSeconds: 1800 });
    assert.equal(low.canAdvance, true);
    assert.equal(low.secondaryLabel, '그래도 다음 회차로');
  });

  it('고비 회차를 넘기면 더 크게 칭찬한다', () => {
    const verdict = judgeSession({
      completedSeconds: 1800,
      totalSeconds: 1800,
      isMilestone: true,
    });
    assert.equal(verdict.title, '고비를 넘겼어요!');
    assert.match(verdict.message, /가장 어려운 날/);
  });
});

describe('프로그램 진행 상태', () => {
  it('아무것도 안 했으면 1주 1일차부터다', () => {
    const progress = programProgress([]);
    assert.equal(progress.completedCount, 0);
    assert.equal(progress.totalCount, 27);
    assert.equal(progress.current?.id, 'start9-w1-d1');
    assert.equal(progress.positionLabel, '1주 1일차');
    assert.match(progress.nextLabel, /^다음 회차 · 1주 1일차 · 30분$/);
    assert.equal(progress.weekDoneCount, 0);
    assert.match(progressSummary(progress), /아직 시작 전/);
  });

  it('마친 회차를 빼고 다음 회차를 고른다', () => {
    const progress = programProgress(['start9-w1-d1', 'start9-w1-d2']);
    assert.equal(progress.current?.id, 'start9-w1-d3');
    assert.equal(progress.weekDoneCount, 2);
    assert.equal(progress.percent, Math.round((2 / 27) * 100));
  });

  it('전부 마치면 끝난 상태가 된다', () => {
    const progress = programProgress(beginnerProgram.sessions.map((session) => session.id));
    assert.equal(progress.finished, true);
    assert.equal(progress.current, undefined);
    assert.equal(progress.ratio, 1);
    assert.equal(progress.positionLabel, '모두 마쳤어요');
  });
});

describe('저장 값', () => {
  it('새 키만 쓴다', () => {
    assert.equal(PROGRAM_STORE_KEY, 'runningbom:vnext:programs:v1');
  });

  it('깨진 값이 들어와도 앱이 멈추지 않는다', () => {
    assert.deepEqual(parseProgramStore(undefined), emptyProgramStore);
    assert.deepEqual(parseProgramStore('무엇'), emptyProgramStore);
    const parsed = parseProgramStore({
      completedSessionIds: ['a', 'a', 1],
      attempts: [{ sessionId: 'a' }, null],
    });
    assert.deepEqual(parsed.completedSessionIds, ['a']);
    assert.deepEqual(parsed.attempts, []);
  });

  it('완료로 표시할 때만 다음 회차가 열린다', () => {
    const attempt = {
      sessionId: 'start9-w1-d1',
      completedSeconds: 1500,
      totalSeconds: 1800,
      finishedAt: '2026-07-26T09:00:00.000Z',
    };
    const kept = saveAttempt(emptyProgramStore, attempt, false);
    assert.deepEqual(kept.completedSessionIds, []);
    assert.equal(kept.attempts.length, 1);
    assert.equal(programProgress(kept.completedSessionIds).current?.id, 'start9-w1-d1');

    const done = saveAttempt(kept, { ...attempt, completedSeconds: 1800 }, true);
    assert.deepEqual(done.completedSessionIds, ['start9-w1-d1']);
    assert.equal(done.attempts.length, 2);
    assert.equal(programProgress(done.completedSessionIds).current?.id, 'start9-w1-d2');
    assert.equal(bestAttempt(done, 'start9-w1-d1')?.completedSeconds, 1800);
  });

  it('처음부터 다시 하기는 완료 목록만 비운다', () => {
    const store = saveAttempt(
      emptyProgramStore,
      {
        sessionId: 'start9-w1-d1',
        completedSeconds: 1800,
        totalSeconds: 1800,
        finishedAt: '2026-07-26T09:00:00.000Z',
      },
      true,
    );
    const restarted = restartProgram(store);
    assert.deepEqual(restarted.completedSessionIds, []);
    assert.equal(restarted.attempts.length, 1);
  });
});

describe('회차 실행 화면 구성', () => {
  const runner = source('app/screens/programs/SessionRunner.tsx');

  it('상단 구간 띠·큰 원·경과 시간·남은 구간을 모두 보여 준다', () => {
    assert.match(runner, /<SegmentRibbon/);
    assert.match(runner, /<CountdownRing/);
    assert.match(runner, /전체 경과 시간/);
    assert.match(runner, /남은 구간/);
  });

  it('일시정지와 다음 구간 건너뛰기 버튼이 있다', () => {
    assert.match(runner, /label=\{paused \? '이어서 하기' : '일시정지'\}/);
    assert.match(runner, /label="다음 구간으로"/);
    assert.match(runner, /skipToNextSegment/);
  });

  it('미리 알림을 화면에도 띄운다', () => {
    assert.match(runner, /upcomingCue/);
    assert.match(runner, /accessibilityLiveRegion="polite"/);
  });

  it('원 안에 지금 할 일과 남은 시간을 크게 쓴다', () => {
    const ring = source('app/screens/programs/CountdownRing.tsx');
    assert.match(ring, /actionLabel/);
    assert.match(ring, /remainingLabel/);
    assert.match(ring, /strokeDashoffset/);
    assert.match(ring, /typeScale\.display/);
  });

  it('완주율로 판정하고 넘어갈지 다시 할지 사람이 고른다', () => {
    assert.match(runner, /judgeSession/);
    assert.match(runner, /verdict\.primaryLabel/);
    assert.match(runner, /verdict\.secondaryLabel/);
    assert.match(runner, /기준에 못 미쳐도 다음 회차로 넘어갈 수 있어요/);
  });
});

describe('프로그램 목록 화면 구성', () => {
  const screen = source('app/screens/programs/ProgramsScreen.tsx');

  it('스스로 화면을 옮기지 않고 부모가 넘겨 준 것만 쓴다', () => {
    // 화면이 직접 라우팅하면 뒤로가기 이력이 두 곳에서 관리됩니다.
    assert.match(screen, /export function ProgramsScreen\(\{ onBack, onOpenRaces, startRequest \}/);
    assert.match(source('app/screens/programs/index.ts'), /export \{ ProgramsScreen/);
  });

  it('훈련을 네 칸으로 나눠 한 번에 하나만 편다', () => {
    // 예전에는 일곱 덩어리가 세로로 전부 쌓여 있었습니다("너무 길다").
    assert.match(screen, /trainingSections\.map/);
    assert.match(screen, /toggleSection\(value, section\.key\)/);
    assert.match(screen, /defaultOpenSection/);
  });

  it('9주 프로그램의 진행률과 다음 회차를 보여 준다', () => {
    assert.match(screen, /<ProgressBar/);
    assert.match(screen, /progress\.nextLabel/);
    assert.match(screen, /progress\.weekDoneCount/);
  });

  it('목표 대회가 없으면 무엇을 하면 되는지 알려 준다', () => {
    assert.match(screen, /<EmptyState/);
    assert.ok(screen.includes('목표 대회를 정하면 대회 날짜에 맞춰 계획을 만들어 드려요.'));
  });

  it('대회 정보는 읽기만 하고 바꾸지 않는다', () => {
    assert.match(screen, /useGoalRace/);
    assert.equal(/saveGoalRace|clearGoalRace/.test(screen), false);
  });

  it('공통 레이아웃과 토큰만 쓴다', () => {
    for (const file of [
      'app/screens/programs/ProgramsScreen.tsx',
      'app/screens/programs/SessionRunner.tsx',
      'app/screens/programs/SegmentRibbon.tsx',
      'app/screens/programs/CountdownRing.tsx',
      'app/screens/programs/TrainingPlanCard.tsx',
    ]) {
      const text = source(file);
      assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(text), false, `${file}에 하드코딩된 색상`);
      assert.equal(/fontSize: \d/.test(text), false, `${file}에 하드코딩된 글자 크기`);
    }
    assert.match(screen, /screenStyles/);
  });
});

describe('쉬운 말 규칙 - 화면', () => {
  it('화면 문구에 어려운 말을 쓰지 않는다', () => {
    const forbidden = ['스트릭', 'RPE', '인터벌', '템포런', '테이퍼링', '볼륨', '컷백', '롱런'];
    for (const file of [
      'app/screens/programs/ProgramsScreen.tsx',
      'app/screens/programs/SessionRunner.tsx',
      'app/screens/programs/SegmentRibbon.tsx',
      'app/screens/programs/CountdownRing.tsx',
      'app/screens/programs/TrainingPlanCard.tsx',
    ]) {
      const text = source(file);
      for (const word of forbidden) {
        assert.equal(text.includes(word), false, `${file}에 "${word}"가 있습니다`);
      }
    }
  });
});
