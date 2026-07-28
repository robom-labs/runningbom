// 코칭 대사표를 실제 시간축으로 합쳐 말 점유율과 무음 구간을 계산합니다.
import type { CoachCue, CoachSession } from './model';

export type CoachTimelineAudit = {
  durationSeconds: number;
  cueCount: number;
  spokenSeconds: number;
  occupancy: number;
  silenceSeconds: number[];
  medianSilenceSeconds: number;
  p95SilenceSeconds: number;
  maxSilenceSeconds: number;
  duplicateTexts: number;
  nearbyDuplicateTexts: number;
};

export function estimatedCueSeconds(text: string): number {
  return Math.max(2, text.length / 5.5);
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * ratio) - 1));
  return ordered[index] ?? 0;
}

export function auditCoachTimeline(session: CoachSession): CoachTimelineAudit {
  const durationSeconds = session.durationMinutes * 60;
  const intervals = session.cues
    .map((cue) => ({
      from: Math.max(0, cue.offsetSeconds),
      to: Math.min(durationSeconds, cue.offsetSeconds + estimatedCueSeconds(cue.text)),
    }))
    .filter((interval) => interval.to > interval.from)
    .sort((left, right) => left.from - right.from || left.to - right.to);

  let coveredUntil = 0;
  let spokenSeconds = 0;
  const silenceSeconds: number[] = [];
  for (const interval of intervals) {
    if (interval.from > coveredUntil) {
      silenceSeconds.push(interval.from - coveredUntil);
      spokenSeconds += interval.to - interval.from;
    } else if (interval.to > coveredUntil) {
      spokenSeconds += interval.to - coveredUntil;
    }
    coveredUntil = Math.max(coveredUntil, interval.to);
  }
  if (coveredUntil < durationSeconds) {
    silenceSeconds.push(durationSeconds - coveredUntil);
  }

  const counts = new Map<string, number>();
  for (const cue of session.cues) {
    const normalized = cue.text.trim().replace(/\s+/g, ' ');
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  const duplicateTexts = [...counts.values()].reduce(
    (total, count) => total + Math.max(0, count - 1),
    0,
  );
  const nearbyDuplicateTexts = session.cues.reduce((total, cue, index, cues) => {
    const normalized = cue.text.trim().replace(/\s+/g, ' ');
    const previous = cues
      .slice(Math.max(0, index - 4), index)
      .some((candidate) => candidate.text.trim().replace(/\s+/g, ' ') === normalized);
    return total + Number(previous);
  }, 0);

  return {
    durationSeconds,
    cueCount: session.cues.length,
    spokenSeconds,
    occupancy: durationSeconds > 0 ? spokenSeconds / durationSeconds : 0,
    silenceSeconds,
    medianSilenceSeconds: percentile(silenceSeconds, 0.5),
    p95SilenceSeconds: percentile(silenceSeconds, 0.95),
    maxSilenceSeconds: Math.max(0, ...silenceSeconds),
    duplicateTexts,
    nearbyDuplicateTexts,
  };
}

export function sortedCues(cues: readonly CoachCue[]): CoachCue[] {
  return [...cues].sort(
    (left, right) => left.offsetSeconds - right.offsetSeconds || left.text.localeCompare(right.text),
  );
}
