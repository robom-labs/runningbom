// 밀도에 맞게 **말이 얼마나 이어질지**를 계획합니다. 순수합니다.
//
// 지금까지의 코칭은 "몇 초마다 한 문장"이었습니다. 그래서 가장 촘촘한 설정에서도
// 실제로 말하는 시간은 전체의 절반뿐이었습니다(측정값 0.50). 나머지 절반은 침묵입니다.
//
// 풀토크는 0.75~0.95를 목표로 합니다. 짧은 문장만으로는 이 숫자에 닿을 수 없습니다.
// 5초마다 한 문장을 던져야 하는데, 그건 계속 말하는 게 아니라 계속 명령하는 것입니다.
//
// 그래서 **긴 덩어리를 끼워 넣습니다.** 한 덩어리는 30~55초 동안 이어집니다.
// 그동안 코치는 지시하지 않고 설명하거나 딴 이야기를 합니다. 사람이 옆에서
// 쉬지 않고 말할 때 실제로 하는 일이 그것입니다.

import type { CoachDensity } from './persona';
import { blockSpokenSeconds, longformBlocks, type LongformBlock } from './longform';

// 1차·2차 커리큘럼을 모두 씁니다.
// 예전에는 1차만 풀에 넣어 두고 2차는 만들어만 놓았습니다. 아무도 그걸 듣지 못했습니다.
const teachingPool = longformBlocks.filter((block) => block.kind === 'teaching');
const storyPool = longformBlocks.filter((block) => block.kind === 'story');

/** 밀도별로 노리는 말 점유율입니다. persona.ts의 densitySpeechOccupancy와 같은 뜻입니다. */
export const targetOccupancy: Record<CoachDensity, number> = {
  essential: 0.2,
  balanced: 0.35,
  'close-coach': 0.55,
  'full-talk': 0.85,
};

/** 긴 덩어리를 쓰는 밀도인지입니다. 조용한 설정에 이야기를 끼워 넣으면 그건 소음입니다. */
export function usesLongform(density: CoachDensity): boolean {
  return density === 'full-talk' || density === 'close-coach';
}

export type PlannedBlock = {
  block: LongformBlock;
  /** 이 덩어리가 시작하는 시각(초)입니다. */
  startSeconds: number;
  /** 말하는 데 걸리는 시간(초)입니다. */
  seconds: number;
};

export type PlanInput = {
  durationSeconds: number;
  /** 이미 짧은 문장으로 채워진 시간(초)입니다. 여기에 더해서 목표를 채웁니다. */
  shortSpokenSeconds: number;
  density: CoachDensity;
  /** 몸 훑기 커서입니다. 매번 머리부터 시작하면 발은 영영 안 나옵니다. */
  startCursor?: number;
  /** 워밍업이 끝나는 시각입니다. 그 전에는 긴 이야기를 시작하지 않습니다. */
  warmupSeconds: number;
};

/** 덩어리 사이에 두는 최소 간격입니다. 이야기가 연달아 붙으면 숨 쉴 틈이 없습니다. */
const BLOCK_GAP_SECONDS = 25;

/**
 * 긴 덩어리를 언제 말할지 정합니다.
 *
 * 순서는 **설명과 이야기를 번갈아** 갑니다.
 * 설명만 이어지면 수업이 되고, 이야기만 이어지면 팟캐스트가 됩니다.
 * 코치는 그 사이 어딘가에 있어야 합니다.
 */
export function planLongform(input: PlanInput): PlannedBlock[] {
  const { durationSeconds, shortSpokenSeconds, density, warmupSeconds } = input;
  if (!usesLongform(density)) return [];

  const wanted = durationSeconds * targetOccupancy[density];
  let missing = wanted - shortSpokenSeconds;
  if (missing <= 0) return [];

  // 덩어리를 하나 놓으면 그 구간에 있던 짧은 문장이 사라집니다.
  // 그래서 덩어리 길이가 그대로 이득이 되지 않습니다.
  // 이걸 빼놓고 세면 계획은 다 찼다고 하는데 실제 점유율은 한참 모자랍니다. 실제로 그랬습니다.
  const shortOccupancy = Math.min(0.9, shortSpokenSeconds / Math.max(1, durationSeconds));
  const netRatio = Math.max(0.2, 1 - shortOccupancy);

  // 마지막 1분은 비워 둡니다. 마무리 안내가 이야기에 잘리면 안 됩니다.
  const lastPossible = durationSeconds - 60;
  const span = lastPossible - warmupSeconds;
  if (span <= 0) return [];

  // 1) 무엇을 어떤 순서로 말할지 먼저 정합니다.
  //
  // **설명과 이야기를 번갈아** 갑니다. 설명만 이어지면 수업이 되고,
  // 이야기만 이어지면 팟캐스트가 됩니다. 코치는 그 사이 어딘가에 있어야 합니다.
  // 그래서 짝이 맞는 만큼만 씁니다. 한쪽이 바닥나면 거기서 끝입니다.
  const startCursor = input.startCursor ?? 0;
  const pairCount = Math.min(teachingPool.length, storyPool.length);
  const order: LongformBlock[] = [];
  for (let index = 0; index < pairCount; index += 1) {
    order.push(teachingPool[(startCursor + index) % teachingPool.length] as LongformBlock);
    order.push(storyPool[(startCursor + index) % storyPool.length] as LongformBlock);
  }

  // 2) 몇 개나 필요한지 셉니다.
  const averageSeconds =
    order.reduce((total, block) => total + blockSpokenSeconds(block), 0) / Math.max(1, order.length);
  const needed = Math.ceil(missing / Math.max(1, averageSeconds * netRatio));
  const fits = Math.floor(span / (averageSeconds + BLOCK_GAP_SECONDS));
  const count = Math.max(0, Math.min(order.length, needed, fits));
  if (count === 0) return [];

  // 3) 전체 구간에 **고르게** 폅니다.
  //
  // 예전에는 워밍업이 끝나자마자 이야기를 연달아 쏟아 놓았습니다.
  // 그러면 세 시간짜리 러닝에서 이야기가 30분 만에 바닥나고 나머지 두 시간 반이 조용해집니다.
  // 그건 "쉬지 않고 말하는 코치"가 아닙니다.
  const step = span / count;
  const planned: PlannedBlock[] = [];
  for (let index = 0; index < count; index += 1) {
    const block = order[index] as LongformBlock;
    const seconds = blockSpokenSeconds(block);
    const at = warmupSeconds + step * index;
    if (at + seconds > lastPossible) break;
    planned.push({ block, startSeconds: Math.round(at), seconds });
  }

  return planned;
}

/**
 * 계획한 덩어리가 실제로 차지하는 구간입니다.
 *
 * 이 구간 안에 있던 짧은 문장은 버립니다. 이야기 중간에 "어깨 내려요"가 끼어들면
 * 두 사람이 동시에 말하는 것처럼 들립니다.
 */
export function blockedSpans(planned: PlannedBlock[]): { from: number; to: number }[] {
  return planned.map((entry) => ({
    from: entry.startSeconds - 2,
    to: entry.startSeconds + entry.seconds + 2,
  }));
}

export function isInsideBlock(offsetSeconds: number, spans: { from: number; to: number }[]): boolean {
  return spans.some((span) => offsetSeconds >= span.from && offsetSeconds <= span.to);
}

/** 덩어리 안의 문장들이 나갈 시각입니다. 한 문장이 끝나면 바로 다음 문장입니다. */
export function blockLineOffsets(entry: PlannedBlock): { offsetSeconds: number; text: string }[] {
  const lines: { offsetSeconds: number; text: string }[] = [];
  let at = entry.startSeconds;
  for (const text of entry.block.lines) {
    lines.push({ offsetSeconds: Math.round(at), text });
    at += Math.max(2, text.length / 5.5) + 0.4;
  }
  return lines;
}

/** 계획한 덩어리 전체가 말하는 시간입니다(검증용). */
export function plannedSeconds(planned: PlannedBlock[]): number {
  return planned.reduce((total, entry) => total + entry.seconds, 0);
}

export { longformBlocks };

/**
 * 다음 러닝이 이어받을 커서입니다.
 *
 * **왜 필요한가:** 커서가 없으면 매 러닝이 "머리부터"로 시작합니다.
 * 20분씩 뛰는 사람은 머리·어깨·팔까지만 듣고 끝납니다.
 * 몇 달을 달려도 **발 이야기는 한 번도 못 듣습니다.** 커리큘럼이 있으나 마나입니다.
 *
 * 그래서 이번에 어디까지 갔는지 기억했다가 다음에 거기서 이어 갑니다.
 * 설명과 이야기를 한 쌍씩 쓰므로, 쓴 개수의 절반만큼 나아갑니다.
 */
export function nextBodyCursor(cursor: number, plannedCount: number): number {
  const pairs = Math.ceil(Math.max(0, plannedCount) / 2);
  // 커서는 계속 커집니다. 쓰는 쪽에서 나머지 연산으로 자리를 찾으므로 되감을 필요가 없습니다.
  return cursor + pairs;
}
