// 풀토크의 긴 무음 구간을 기존 검증 문장으로 메우는 순수 시간축 계획입니다.
import { generalCues } from './cueLibrary';
import type { CoachCue, CoachSession } from './model';
import { estimatedCueSeconds, sortedCues } from './timelineAudit';

const MAX_SILENCE_SECONDS = 6;
const BREATH_SECONDS = 1.1;
const TARGET_SILENCE_SECONDS = 1.2;

const continuityLines = [...new Set([
  '좋아요. 지금 흐름으로 가요.',
  '좋습니다. 한 걸음씩 이어가요.',
  '서두르지 말고 리듬을 지켜요.',
  '힘을 빼고 가볍게 이어가요.',
  '호흡 한 번 정리하고 계속 가요.',
  '지금 속도에서 편하게 이어가요.',
  '몸 전체를 가볍게 두고 가요.',
  '발걸음을 작고 편하게 이어가요.',
  '시선만 앞에 두고 계속 가요.',
  '어깨를 풀고 자연스럽게 가요.',
  '손에 힘을 빼고 리듬을 타요.',
  '호흡과 발걸음을 나란히 맞춰요.',
  ...generalCues.posture,
  ...generalCues.breathing,
  ...generalCues.cadence,
  ...generalCues.pace,
  ...generalCues.encouragement,
  ...generalCues.mindset,
])];

function lineAt(index: number): string {
  return continuityLines[index % continuityLines.length] as string;
}

function normalized(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * 긴 이야기와 기존 큐 사이에서 6초보다 오래 비는 곳만 채웁니다.
 *
 * 기존 문장을 덮거나 동시에 말하지 않고, 한 문장이 끝난 뒤 숨 한 번 쉴 여백을 둡니다.
 * 수백 개의 검증 문장을 순환하므로 가까운 구간에서 같은 말이 되풀이되지 않습니다.
 */
export function fillFullTalkContinuity(session: CoachSession, startCursor = 0): CoachSession {
  const durationSeconds = session.durationMinutes * 60;
  const source = sortedCues(session.cues);
  const filled: CoachCue[] = [];
  let cursor = startCursor;
  let spokenUntil = 0;

  const takeLine = (
    maxSpokenSeconds: number,
    forbiddenText?: string,
  ): { text: string; spokenSeconds: number } | undefined => {
    const recent = new Set(filled.slice(-4).map((cue) => normalized(cue.text)));
    if (forbiddenText) recent.add(normalized(forbiddenText));
    for (let attempt = 0; attempt < continuityLines.length; attempt += 1) {
      const candidate = lineAt(cursor);
      cursor += 1;
      const spokenSeconds = estimatedCueSeconds(candidate);
      if (!recent.has(normalized(candidate)) && spokenSeconds <= maxSpokenSeconds) {
        return { text: candidate, spokenSeconds };
      }
    }
    return undefined;
  };

  const fillUntil = (nextCueAt: number, nextCueText?: string): void => {
    while (nextCueAt - spokenUntil > TARGET_SILENCE_SECONDS) {
      const offsetSeconds = spokenUntil + BREATH_SECONDS;
      const selected = takeLine(nextCueAt - offsetSeconds - 0.35, nextCueText);
      if (!selected) break;
      filled.push({
        offsetSeconds: Number(offsetSeconds.toFixed(2)),
        text: selected.text,
        kind: 'instruction',
      });
      spokenUntil = offsetSeconds + selected.spokenSeconds;
    }
  };

  for (const cue of source) {
    fillUntil(cue.offsetSeconds, cue.text);
    const recent = new Set(filled.slice(-4).map((candidate) => normalized(candidate.text)));
    const canSubstitute = cue.kind === 'instruction' || cue.kind === 'encouragement';
    const substitute = canSubstitute && recent.has(normalized(cue.text))
      ? takeLine(estimatedCueSeconds(cue.text))
      : undefined;
    const nextCue = substitute ? { ...cue, text: substitute.text } : cue;
    filled.push(nextCue);
    spokenUntil = Math.max(
      spokenUntil,
      nextCue.offsetSeconds + estimatedCueSeconds(nextCue.text),
    );
  }
  fillUntil(durationSeconds);

  // 문장 길이 때문에 끝에 짧은 여백이 남는 것은 허용하지만 계약 상한은 넘지 않습니다.
  if (durationSeconds - spokenUntil > MAX_SILENCE_SECONDS) {
    const text = lineAt(cursor);
    filled.push({
      offsetSeconds: Number((spokenUntil + BREATH_SECONDS).toFixed(2)),
      text,
      kind: 'instruction',
    });
  }

  const deduplicated: CoachCue[] = [];
  const orderedFilled = sortedCues(filled);
  for (const [cueIndex, cue] of orderedFilled.entries()) {
    const recent = new Set(deduplicated.slice(-4).map((candidate) => normalized(candidate.text)));
    const canSubstitute = cue.kind === 'instruction' || cue.kind === 'encouragement';
    if (canSubstitute && recent.has(normalized(cue.text))) {
      let replacement: string | undefined;
      const nextCueAt = orderedFilled[cueIndex + 1]?.offsetSeconds ?? durationSeconds;
      const maxSpokenSeconds = Math.max(
        estimatedCueSeconds(cue.text),
        nextCueAt - cue.offsetSeconds - 0.35,
      );
      for (let attempt = 0; attempt < continuityLines.length; attempt += 1) {
        const candidate = lineAt(cursor);
        cursor += 1;
        if (
          !recent.has(normalized(candidate))
          && estimatedCueSeconds(candidate) <= maxSpokenSeconds
        ) {
          replacement = candidate;
          break;
        }
      }
      if (replacement) deduplicated.push({ ...cue, text: replacement });
    } else {
      deduplicated.push(cue);
    }
  }

  return {
    ...session,
    id: `${session.id}:continuous`,
    cues: deduplicated,
  };
}
