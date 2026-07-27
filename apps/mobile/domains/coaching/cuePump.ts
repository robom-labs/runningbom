// 시간이 흐르는 동안 "지금 읽어 줄 대사"를 고르는 규칙입니다.
//
// 왜 도메인으로 뺐는가:
//   이 규칙이 services/audio 안에 타이머와 섞여 있어서, 자동 테스트로는 대사가 제때 나오는지
//   확인할 수 없었습니다. 실제로 "첫 마디만 들리고 그 뒤로 조용하다"는 신고가 있었는데도
//   기존 테스트는 전부 통과했습니다. 테스트가 증명하던 것은 "올바른 말이 만들어진다"까지였고,
//   "올바른 시각에 실제로 나간다"는 아무도 보고 있지 않았습니다.
//   여기로 옮기면 가짜 시계로 30분을 앞당겨 돌려 볼 수 있습니다.
import type { CoachCue } from './model';

/**
 * 한 번의 틱에서 실제로 읽어 줄 최대 대사 수입니다.
 * 예전에는 밀린 대사 중 마지막 하나만 읽고 나머지를 버렸습니다.
 * 그래서 같은 순간에 놓인 대사 세 개 중 한 마디만 들렸습니다.
 */
export const MAX_SPOKEN_CUES_PER_TICK = 2;

export type CuePumpResult = {
  /** 이번 틱에서 읽어 줄 대사입니다(시간순). */
  spoken: CoachCue[];
  /** 다음 틱에서 볼 대사의 자리입니다. 읽지 않고 건너뛴 대사도 여기서 소비됩니다. */
  nextIndex: number;
};

/**
 * 경과 시간까지 도달한 대사를 꺼냅니다.
 *
 * 화면이 꺼져 있던 동안 여러 대사가 한꺼번에 밀릴 수 있습니다.
 * 그때 밀린 것을 전부 읽으면 지난 이야기를 몇 십 초씩 늘어놓게 되므로 최근 것만 읽습니다.
 * 다만 "읽지 않는다"와 "자리를 넘기지 않는다"는 다릅니다. 자리는 언제나 끝까지 넘깁니다.
 */
export function dueCues(
  cues: readonly CoachCue[],
  nextIndex: number,
  elapsedSeconds: number,
  limit: number = MAX_SPOKEN_CUES_PER_TICK,
): CuePumpResult {
  let index = Math.max(0, nextIndex);
  const due: CoachCue[] = [];
  while (index < cues.length && cues[index].offsetSeconds <= elapsedSeconds) {
    due.push(cues[index]);
    index += 1;
  }
  return { spoken: due.slice(-Math.max(1, limit)), nextIndex: index };
}

/** 말할 만한 시간의 넉넉한 상한입니다(끝 신호가 유실됐는지 감시하는 데 씁니다). */
export const SPEECH_WATCHDOG_FLOOR_MILLIS = 4_000;
export const SPEECH_WATCHDOG_CEILING_MILLIS = 30_000;
const MILLIS_PER_CHARACTER = 260;

/**
 * 한 문장을 말하는 데 이 시간이 지나도 끝 신호가 없으면 다음으로 넘어갑니다.
 *
 * expo-speech의 onDone은 기기·엔진에 따라 오지 않는 일이 있습니다.
 * 그때 "지금 말하는 중" 표시가 영원히 켜진 채로 남으면, 그 뒤의 모든 대사가 큐에 쌓이기만 하고
 * 한 마디도 나가지 않습니다. 첫 마디만 들리고 조용해지는 증상이 정확히 이 모양입니다.
 */
export function speechWatchdogMillis(text: string, rate = 1): number {
  const safeRate = Math.max(0.5, rate);
  const estimated = (text.length * MILLIS_PER_CHARACTER) / safeRate;
  return Math.min(
    SPEECH_WATCHDOG_CEILING_MILLIS,
    Math.max(SPEECH_WATCHDOG_FLOOR_MILLIS, estimated),
  );
}
