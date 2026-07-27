// 걷기·뛰기 프로그램의 값 모양을 한곳에 모읍니다.
// 한 회차는 "구간"의 줄이고, 구간은 걷기 아니면 뛰기입니다. 화면은 이 값만 보고 그립니다.

/** 구간에서 무엇을 하는지입니다. 색을 나누는 기준이기도 합니다. */
export type SegmentKind = 'walk' | 'run';

/** 구간이 회차의 어느 부분인지입니다. 준비 → 본운동 → 마무리 순서입니다. */
export type SegmentRole = 'warmup' | 'main' | 'cooldown';

export type SessionSegment = {
  id: string;
  kind: SegmentKind;
  role: SegmentRole;
  /** 이 구간을 몇 초 동안 하는지입니다. */
  seconds: number;
  /** 화면 가운데 큰 글씨로 그대로 보여 주는 말입니다. */
  label: string;
};

/** 프로그램의 한 회차입니다. 하루에 하나씩 합니다. */
export type ProgramSession = {
  id: string;
  week: number;
  /** 그 주의 몇 일차인지입니다(1, 2, 3). */
  day: number;
  /** 예: "3주 2일차" */
  title: string;
  /** 오늘 무엇을 하는지 한 줄로 알려 주는 말입니다. */
  summary: string;
  segments: SessionSegment[];
  totalSeconds: number;
  /** 뛰는 시간만 더한 값입니다. */
  runSeconds: number;
  /** 많은 사람이 그만두는 고비 회차인지입니다. */
  isMilestone: boolean;
  /** 고비 회차에만 붙는 응원 문구입니다. */
  encouragement?: string;
};

export type ProgramWeek = {
  week: number;
  /** 예: "5주차" */
  title: string;
  /** 이 주에 무엇이 달라지는지 한 줄 설명입니다. */
  focus: string;
  sessions: ProgramSession[];
};

export type RunProgram = {
  id: string;
  /** 사람에게 보여 주는 이름입니다. 영어 줄임말을 쓰지 않습니다. */
  name: string;
  subtitle: string;
  description: string;
  /** 일주일에 몇 번 하는지입니다. */
  runsPerWeek: number;
  /** 회차 사이에 하루 쉬라는 안내입니다. */
  restNote: string;
  weeks: ProgramWeek[];
  sessions: ProgramSession[];
};

export const segmentKindLabels: Record<SegmentKind, string> = {
  walk: '걷기',
  run: '뛰기',
};

/** 초를 사람이 읽는 시간으로 바꿉니다. 90 → "1분 30초", 300 → "5분" */
export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  if (minutes === 0) return `${rest}초`;
  if (rest === 0) return `${minutes}분`;
  return `${minutes}분 ${rest}초`;
}

/** 시계 모양 시간입니다. 65 → "1:05", 3665 → "1:01:05" */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(rest).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 띠 한 칸에 넣는 짧은 시간 표시입니다. 90 → "1.5분"이 아니라 "1분 30초"가 길어서 "1'30"으로 줍니다. */
export function formatTick(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  if (minutes === 0) return `${rest}초`;
  if (rest === 0) return `${minutes}분`;
  return `${minutes}분${rest}`;
}
