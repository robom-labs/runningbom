// 회차를 실제로 따라 하는 동안 필요한 계산입니다. 전부 순수 함수라 화면 없이 시험할 수 있어요.
// 화면은 "지금 몇 초 지났는지"만 세고, 무엇을 보여 줄지는 여기서 정합니다.
import type { ProgramSession, SessionSegment } from './types';
import { formatClock, formatDuration } from './types';

export type TimelineEntry = {
  segment: SessionSegment;
  index: number;
  /** 회차 시작에서 몇 초 뒤에 이 구간이 시작하는지 */
  startSeconds: number;
  /** 이 구간이 끝나는 시각(초) */
  endSeconds: number;
};

export type SessionTimeline = {
  entries: TimelineEntry[];
  totalSeconds: number;
};

export function buildTimeline(segments: SessionSegment[]): SessionTimeline {
  let cursor = 0;
  const entries = segments.map((segment, index) => {
    const startSeconds = cursor;
    cursor += Math.max(0, Math.round(segment.seconds));
    return { segment, index, startSeconds, endSeconds: cursor };
  });
  return { entries, totalSeconds: cursor };
}

export function sessionTimeline(session: ProgramSession): SessionTimeline {
  return buildTimeline(session.segments);
}

/** 구간이 바뀌기 몇 초 전에 미리 알려 줄지입니다. */
export const CUE_LEAD_SECONDS = 10;

export type SessionNow = {
  /** 지금 하고 있는 구간입니다. 끝났으면 마지막 구간입니다. */
  entry: TimelineEntry;
  index: number;
  /** 이 구간이 끝날 때까지 남은 초입니다. */
  remainingSeconds: number;
  /** 이 구간을 얼마나 했는지(0~1). 원 테두리를 줄이는 데 씁니다. */
  segmentRatio: number;
  /** 회차 전체를 얼마나 했는지(0~1) */
  totalRatio: number;
  elapsedSeconds: number;
  /** 아직 남은 구간 수입니다(지금 구간 제외). */
  remainingSegments: number;
  next?: SessionSegment;
  /** 구간이 곧 바뀔 때만 채워지는 미리 알림입니다. */
  upcomingCue?: string;
  finished: boolean;
};

function clampElapsed(timeline: SessionTimeline, elapsedSeconds: number): number {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) return 0;
  return Math.min(Math.round(elapsedSeconds), timeline.totalSeconds);
}

/** 다음 구간으로 바뀌기 직전에 화면에 띄울 말입니다. */
export function cueText(next: SessionSegment | undefined, leadSeconds: number): string {
  if (!next) return `${leadSeconds}초 뒤에 끝나요`;
  if (next.kind === 'run') return `${leadSeconds}초 뒤 뛰기 시작`;
  if (next.role === 'cooldown') return `${leadSeconds}초 뒤 마무리 걷기`;
  return `${leadSeconds}초 뒤 걷기로 바꿔요`;
}

/** 경과 시간으로 지금 화면에 보여 줄 것을 전부 계산합니다. */
export function sessionNow(
  timeline: SessionTimeline,
  elapsedSeconds: number,
  leadSeconds: number = CUE_LEAD_SECONDS,
): SessionNow {
  const total = timeline.totalSeconds;
  const elapsed = clampElapsed(timeline, elapsedSeconds);
  const last = timeline.entries[timeline.entries.length - 1] as TimelineEntry;
  const finished = elapsed >= total;
  const entry = finished
    ? last
    : (timeline.entries.find((item) => elapsed < item.endSeconds) ?? last);
  const remainingSeconds = Math.max(0, entry.endSeconds - elapsed);
  const segmentSeconds = Math.max(1, entry.endSeconds - entry.startSeconds);
  const segmentRatio = Math.min(1, Math.max(0, (elapsed - entry.startSeconds) / segmentSeconds));
  const nextEntry: TimelineEntry | undefined = timeline.entries[entry.index + 1];
  const next = finished ? undefined : nextEntry?.segment;
  const showCue = !finished && remainingSeconds > 0 && remainingSeconds <= leadSeconds;
  return {
    entry,
    index: entry.index,
    remainingSeconds,
    segmentRatio,
    totalRatio: total > 0 ? Math.min(1, elapsed / total) : 0,
    elapsedSeconds: elapsed,
    remainingSegments: finished ? 0 : timeline.entries.length - 1 - entry.index,
    ...(next ? { next } : {}),
    ...(showCue ? { upcomingCue: cueText(next, leadSeconds) } : {}),
    finished,
  };
}

/** "다음 구간 건너뛰기"를 누르면 지금 구간 끝으로 시간을 옮깁니다. */
export function skipToNextSegment(timeline: SessionTimeline, elapsedSeconds: number): number {
  const elapsed = clampElapsed(timeline, elapsedSeconds);
  const entry = timeline.entries.find((item) => elapsed < item.endSeconds);
  return entry ? entry.endSeconds : timeline.totalSeconds;
}

/** 상단 띠 한 칸에 넣을 값입니다. 칸 너비는 구간 길이에 비례하되 너무 얇아지지 않게 최소값을 둡니다. */
export type RibbonCell = {
  id: string;
  index: number;
  kind: SessionSegment['kind'];
  label: string;
  minuteLabel: string;
  /** 칸 너비 비율(0~1)입니다. 모두 더하면 1이에요. */
  widthRatio: number;
  state: 'done' | 'current' | 'upcoming';
};

export function ribbonCells(timeline: SessionTimeline, currentIndex: number): RibbonCell[] {
  const total = Math.max(1, timeline.totalSeconds);
  const minWidth = 0.02;
  const raw = timeline.entries.map((entry) =>
    Math.max(minWidth, (entry.endSeconds - entry.startSeconds) / total),
  );
  const sum = raw.reduce((acc, value) => acc + value, 0);
  return timeline.entries.map((entry, index) => ({
    id: entry.segment.id,
    index,
    kind: entry.segment.kind,
    label: entry.segment.label,
    minuteLabel: formatDuration(entry.segment.seconds),
    widthRatio: (raw[index] as number) / sum,
    state: index === currentIndex ? 'current' : index < currentIndex ? 'done' : 'upcoming',
  }));
}

/** 화면 아래에 그대로 쓰는 문장들입니다. */
export function elapsedLabel(elapsedSeconds: number, totalSeconds: number): string {
  return `${formatClock(elapsedSeconds)} / ${formatClock(totalSeconds)}`;
}

export function remainingSegmentsLabel(remainingSegments: number): string {
  return remainingSegments > 0 ? `남은 구간 ${remainingSegments}개` : '마지막 구간이에요';
}
