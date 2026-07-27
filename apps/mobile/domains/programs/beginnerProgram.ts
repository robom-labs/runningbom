// "9주 달리기 시작" 프로그램의 정본 데이터입니다.
// 걷기부터 시작해 9주 뒤에 30분을 쉬지 않고 뛰는 것이 목표입니다.
//
// 모든 회차는 같은 뼈대입니다.
//   빠르게 걷기 5분  →  그날의 본운동  →  걷기 5분 마무리
// 일주일에 3번, 하루 걸러 하루 하는 것을 권합니다.
import type {
  ProgramSession,
  ProgramWeek,
  RunProgram,
  SegmentKind,
  SessionSegment,
} from './types';
import { formatDuration } from './types';

export const PROGRAM_ID = 'start9';
export const WARMUP_SECONDS = 300;
export const COOLDOWN_SECONDS = 300;
export const SESSIONS_PER_WEEK = 3;

type MainStep = { kind: SegmentKind; seconds: number };

function run(seconds: number): MainStep {
  return { kind: 'run', seconds };
}

function walk(seconds: number): MainStep {
  return { kind: 'walk', seconds };
}

function repeat(times: number, steps: MainStep[]): MainStep[] {
  const out: MainStep[] = [];
  for (let index = 0; index < times; index += 1) out.push(...steps);
  return out;
}

type SessionSpec = {
  /** 본운동 구간입니다. 준비·마무리 걷기는 자동으로 붙습니다. */
  main: MainStep[];
  summary: string;
  isMilestone?: boolean;
  encouragement?: string;
};

type WeekSpec = {
  week: number;
  focus: string;
  /** 세 회차가 같으면 하나만, 다르면 셋을 적습니다. */
  days: [SessionSpec] | [SessionSpec, SessionSpec, SessionSpec];
};

/** 조사로 확인된 표준 9주 구성입니다. 값을 고칠 때는 이 표만 고칩니다. */
const weekSpecs: WeekSpec[] = [
  {
    week: 1,
    focus: '1분만 뛰고 1분 30초 걷기를 반복해요. 짧게 여러 번이 핵심이에요.',
    days: [
      {
        main: repeat(8, [run(60), walk(90)]),
        summary: '뛰기 1분 + 걷기 1분 30초를 8번 반복해요.',
      },
    ],
  },
  {
    week: 2,
    focus: '뛰는 시간이 1분 30초로 늘어요. 걷는 시간도 함께 늘어서 괜찮아요.',
    days: [
      {
        main: repeat(6, [run(90), walk(120)]),
        summary: '뛰기 1분 30초 + 걷기 2분을 6번 반복해요.',
      },
    ],
  },
  {
    week: 3,
    focus: '처음으로 3분을 이어서 뛰어요. 짧은 뛰기와 번갈아 해서 부담이 적어요.',
    days: [
      {
        main: repeat(2, [run(90), walk(90), run(180), walk(180)]),
        summary: '[뛰기 1분 30초 + 걷기 1분 30초 + 뛰기 3분 + 걷기 3분]을 2번 반복해요.',
      },
    ],
  },
  {
    week: 4,
    focus: '5분 뛰기가 두 번 들어와요. 이번 주가 지나면 몸이 많이 달라져요.',
    days: [
      {
        main: [run(180), walk(90), run(300), walk(150), run(180), walk(90), run(300)],
        summary: '뛰기 3분 · 5분 · 3분 · 5분을 걷기와 번갈아 해요.',
      },
    ],
  },
  {
    week: 5,
    focus: '주마다 다르게 해요. 마지막 날 처음으로 20분을 쉬지 않고 뛰어요.',
    days: [
      {
        main: [run(300), walk(180), run(300), walk(180), run(300)],
        summary: '뛰기 5분을 세 번, 사이사이 3분씩 걸어요.',
      },
      {
        main: [run(480), walk(300), run(480)],
        summary: '뛰기 8분을 두 번, 사이에 5분 걸어요.',
      },
      {
        main: [run(1200)],
        summary: '중간에 걷지 않고 20분을 이어서 뛰어요.',
        isMilestone: true,
        encouragement:
          '오늘이 처음으로 20분을 쉬지 않고 뛰는 날이에요. 여기서 그만두는 사람이 가장 많아요. 속도는 아주 느려도 괜찮으니 시간만 채워 봐요. 옆 사람과 이야기할 수 있는 속도면 충분해요.',
      },
    ],
  },
  {
    week: 6,
    focus: '다시 나눠 뛰다가 마지막 날 22분을 이어서 뛰어요.',
    days: [
      {
        main: [run(300), walk(180), run(480), walk(180), run(300)],
        summary: '뛰기 5분 · 8분 · 5분을 3분씩 걸으며 이어 가요.',
      },
      {
        main: [run(600), walk(180), run(600)],
        summary: '뛰기 10분을 두 번, 사이에 3분 걸어요.',
      },
      {
        main: [run(1320)],
        summary: '중간에 걷지 않고 22분을 이어서 뛰어요.',
        isMilestone: true,
        encouragement:
          '지난주에 20분을 해냈으니 2분만 더 하면 돼요. 여기도 많이 그만두는 자리예요. 숨이 차면 속도를 더 줄이고, 걷지 않고 버티는 것만 목표로 삼아요.',
      },
    ],
  },
  {
    week: 7,
    focus: '이제 걷지 않고 25분을 뛰어요. 속도보다 끝까지가 중요해요.',
    days: [
      {
        main: [run(1500)],
        summary: '중간에 걷지 않고 25분을 이어서 뛰어요.',
      },
    ],
  },
  {
    week: 8,
    focus: '28분으로 늘려요. 다음 주면 목표에 닿아요.',
    days: [
      {
        main: [run(1680)],
        summary: '중간에 걷지 않고 28분을 이어서 뛰어요.',
      },
    ],
  },
  {
    week: 9,
    focus: '30분을 쉬지 않고 뛰어요. 프로그램의 마지막 주예요.',
    days: [
      {
        main: [run(1800)],
        summary: '중간에 걷지 않고 30분을 이어서 뛰어요.',
      },
    ],
  },
];

function mainLabel(kind: SegmentKind): string {
  return kind === 'run' ? '뛰기' : '걷기';
}

function buildSegments(sessionId: string, main: MainStep[]): SessionSegment[] {
  const segments: SessionSegment[] = [
    {
      id: `${sessionId}-warmup`,
      kind: 'walk',
      role: 'warmup',
      seconds: WARMUP_SECONDS,
      label: '빠르게 걷기',
    },
  ];
  main.forEach((step, index) => {
    segments.push({
      id: `${sessionId}-main-${index + 1}`,
      kind: step.kind,
      role: 'main',
      seconds: step.seconds,
      label: mainLabel(step.kind),
    });
  });
  segments.push({
    id: `${sessionId}-cooldown`,
    kind: 'walk',
    role: 'cooldown',
    seconds: COOLDOWN_SECONDS,
    label: '마무리 걷기',
  });
  return segments;
}

function buildSession(week: number, day: number, spec: SessionSpec): ProgramSession {
  const id = `${PROGRAM_ID}-w${week}-d${day}`;
  const segments = buildSegments(id, spec.main);
  const totalSeconds = segments.reduce((sum, segment) => sum + segment.seconds, 0);
  const runSeconds = segments
    .filter((segment) => segment.kind === 'run')
    .reduce((sum, segment) => sum + segment.seconds, 0);
  return {
    id,
    week,
    day,
    title: `${week}주 ${day}일차`,
    summary: spec.summary,
    segments,
    totalSeconds,
    runSeconds,
    isMilestone: spec.isMilestone === true,
    ...(spec.encouragement ? { encouragement: spec.encouragement } : {}),
  };
}

function buildWeeks(): ProgramWeek[] {
  return weekSpecs.map((spec) => {
    const sessions: ProgramSession[] = [];
    for (let day = 1; day <= SESSIONS_PER_WEEK; day += 1) {
      const daySpec = spec.days.length === 1 ? spec.days[0] : spec.days[day - 1];
      sessions.push(buildSession(spec.week, day, daySpec as SessionSpec));
    }
    return {
      week: spec.week,
      title: `${spec.week}주차`,
      focus: spec.focus,
      sessions,
    };
  });
}

const weeks = buildWeeks();

export const beginnerProgram: RunProgram = {
  id: PROGRAM_ID,
  name: '9주 달리기 시작',
  subtitle: '걷기부터 시작해 30분 달리기까지',
  description:
    '한 번도 달려 본 적이 없어도 괜찮아요. 걷기와 뛰기를 번갈아 하면서 9주에 걸쳐 조금씩 뛰는 시간을 늘려요. 마지막 주에는 쉬지 않고 30분을 뛸 수 있게 돼요.',
  runsPerWeek: SESSIONS_PER_WEEK,
  restNote: '일주일에 세 번, 하루 걸러 하루 하는 게 가장 좋아요. 쉬는 날에 몸이 자라요.',
  weeks,
  sessions: weeks.flatMap((week) => week.sessions),
};

export function findSession(sessionId: string): ProgramSession | undefined {
  return beginnerProgram.sessions.find((session) => session.id === sessionId);
}

/** 한 회차를 "준비 5분 · 본운동 · 마무리 5분"으로 풀어 쓴 안내 문장입니다. */
export function sessionShape(session: ProgramSession): string {
  const main = session.totalSeconds - WARMUP_SECONDS - COOLDOWN_SECONDS;
  return `빠르게 걷기 ${formatDuration(WARMUP_SECONDS)} · 본운동 ${formatDuration(
    main,
  )} · 걷기 ${formatDuration(COOLDOWN_SECONDS)} 마무리`;
}
