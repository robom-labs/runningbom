// 옆에서 쉴 새 없이 말해 주는 코치처럼, 촘촘하고 반복되지 않는 TTS 큐를 만드는 코칭 도메인 정본입니다.
import type { ActivityKind } from '../activities/types';
import {
  allowsEasyIntensityCues,
  allowsSpeedUpCues,
  buildPhases,
  resolveRunningType,
  runningTypes,
  type CoachSessionKind,
  type RunningTypeId,
  type SessionPhase,
} from './sessionTypes';
import {
  categoryRotation,
  closingCues,
  contextualCuePool,
  openingCues,
  phaseScripts,
  progressLine,
  type CueCategory,
} from './cueLibrary';

export const COACH_CONTENT_VERSION = '2026.07-v3-continuous';

export type { CoachSessionKind, RunningTypeId, SessionPhase };
export {
  buildPhases,
  legacyKindMap,
  phaseGroups,
  resolveRunningType,
  runningTypeById,
  runningTypes,
  runningTypeCategories,
  runningTypesByCategory,
  type PhaseGroup,
  type RunningTypeCategory,
  type RunningTypeDefinition,
  type PhaseKind,
} from './sessionTypes';
export type { CueCategory } from './cueLibrary';
import { hasKnownEnd, totalSeconds, type SessionExtent } from './extent';
export * from './extent';

export type GuidanceLevel = 'minimal' | 'standard' | 'detailed';

export type CoachCue = {
  offsetSeconds: number;
  text: string;
  kind: 'safety' | 'instruction' | 'phase' | 'encouragement' | 'completion' | 'progress';
  category?: CueCategory;
  phaseIndex?: number;
};

export type CoachSession = {
  id: string;
  title: CoachSessionKind;
  typeId: RunningTypeId;
  durationMinutes: number;
  guidance: GuidanceLevel;
  countsAs: ActivityKind;
  summary: string;
  phases: SessionPhase[];
  cues: CoachCue[];
  /**
   * 이번 러닝이 어떻게 끝나는지입니다.
   * 없으면 예전처럼 "정해진 시간"으로 봅니다(기존 호출부 호환).
   */
  extent?: SessionExtent;
};

/** 값이 아예 없거나 숫자가 아닐 때만 쓰는 기본값입니다. 상한이 아닙니다. */
export const DEFAULT_SESSION_MINUTES = 30;

/**
 * 끝을 정하지 않은 러닝에서 **미리 만들어 두는 분량**입니다.
 *
 * 큐는 "시작 후 몇 초"로 붙어 있으므로 무한히 만들 수는 없습니다.
 * 그렇다고 짧게 만들면 그 뒤로 코치가 조용해집니다.
 * 그래서 한 시간치를 만들어 두고, 다 써 갈 때쯤 다음 분량을 이어 만듭니다.
 */
export const OPEN_ENDED_HORIZON_MINUTES = 60;

/** 다음 분량을 만들기 시작하는 시점입니다. 남은 분량이 이보다 적으면 이어 만듭니다. */
export const OPEN_ENDED_REFILL_MINUTES = 20;

export const recommendedSessionKinds: CoachSessionKind[] = [
  '이지런',
  '인터벌',
  '템포런',
  '롱런',
  '리커버리 워크',
];

/**
 * 안내 밀도별 평시 큐 간격(초)입니다.
 * "옆에서 쉴 새 없이 말해 주는 코치"가 기본이므로 보통을 15초로 두어 분당 4마디를 유지합니다.
 */
export const guidanceIntervalSeconds: Record<GuidanceLevel, number> = {
  minimal: 26,
  standard: 15,
  detailed: 9,
};

export const guidanceLabels: Record<GuidanceLevel, string> = {
  minimal: '간단',
  standard: '보통',
  detailed: '자세히',
};

export const guidanceDescriptions: Record<GuidanceLevel, string> = {
  minimal: '약 25~30초마다 한 마디',
  standard: '약 15초마다 한 마디 (권장)',
  detailed: '거의 쉬지 않고 계속',
};

const legacySummaries: Partial<Record<CoachSessionKind, string>> = {
  '기본 지속주': '말은 할 수 있는 편안한 속도로 리듬을 쌓아요.',
  '편안한 지속주': '이지런과 같은 편안한 지속주로 이어집니다.',
  '계속 달리기': '이지런과 같은 편안한 지속주로 이어집니다.',
  '조금 빠르게': '템포런으로 이어집니다.',
  '걷고 달리기': '워크런으로 이어집니다.',
  '회복하며': '리커버리 워크로 이어집니다.',
  '회복 걷기': '가볍게 걸으며 다리의 긴장을 풀어 줘요.',
  '대회 전': '피로를 남기지 않는 짧은 준비 러닝이에요.',
};

export const sessionSummaries: Record<CoachSessionKind, string> = {
  '기본 지속주': legacySummaries['기본 지속주'] as string,
  인터벌: '빠르게 달리는 구간과 회복 구간을 번갈아 진행해요.',
  템포런: '조금 숨차지만 유지 가능한 집중 구간을 경험해요.',
  롱런: '속도를 욕심내지 않고 긴 시간을 안정적으로 가요.',
  '회복 걷기': legacySummaries['회복 걷기'] as string,
  '편안한 지속주': legacySummaries['편안한 지속주'] as string,
  '걷고 달리기': legacySummaries['걷고 달리기'] as string,
  '회복하며': legacySummaries['회복하며'] as string,
  '계속 달리기': legacySummaries['계속 달리기'] as string,
  '조금 빠르게': legacySummaries['조금 빠르게'] as string,
  러닝머신: '러닝머신에서 속도를 안전하게 조절해요.',
  '대회 전': legacySummaries['대회 전'] as string,
  '회복 루틴': '관절과 호흡을 부드럽게 정리해요.',
  '아침 깨우기': '작은 움직임으로 몸을 천천히 깨워요.',
  걷기: '시선과 호흡을 편안하게 두고 걸어요.',
  이지런: '말은 할 수 있는 편안한 속도로 리듬을 쌓아요.',
  파틀렉: '자유롭게 빠르기를 바꾸며 달리는 변화 있는 러닝이에요.',
  빌드업: '뒤로 갈수록 조금씩 속도를 올리며 마무리해요.',
  '힐 리핏': '짧은 언덕을 반복하며 밀어내는 힘을 익혀요.',
  스트라이드: '짧고 빠른 질주와 충분한 회복을 반복해요.',
  '리커버리 워크': '가볍게 걸으며 다리의 긴장을 풀어 줘요.',
  워크런: '달리기와 걷기를 번갈아 하며 부담 없이 이어가요.',
  '대회 전 세이버': '피로를 남기지 않는 짧은 준비 러닝이에요.',
};

const knownKinds = new Set<string>(Object.keys(sessionSummaries));

export function isCoachSessionKind(value: string): value is CoachSessionKind {
  return knownKinds.has(value);
}

function hashSeed(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function createRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let result = Math.imul(state ^ (state >>> 15), 1 | state);
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** 풀 크기와 무관하게 최소한 이만큼은 최근 문장을 피합니다. */
export const minimumCooldownWindow = 15;
/** 카테고리 풀 크기 대비 쿨다운 윈도 비율입니다. */
export const cooldownWindowRatio = 0.4;
/** 카테고리가 달라도 바로 앞 문장과는 겹치지 않게 하는 전역 윈도입니다. */
const GLOBAL_COOLDOWN = 5;

/** 풀 크기에 맞춘 쿨다운 윈도(최근 사용 문장 회피 개수)입니다. */
export function cooldownWindowFor(poolSize: number): number {
  if (poolSize <= 1) return 0;
  return Math.min(
    poolSize - 1,
    Math.max(minimumCooldownWindow, Math.floor(poolSize * cooldownWindowRatio)),
  );
}

/** 풀마다 최근 사용 이력을 따로 기억하는 선택기입니다. */
type CuePicker = {
  /** 세션 전체에서 마지막으로 말한 문장들입니다(카테고리 무관 근접 반복 방지). */
  spoken: string[];
  /** 풀 키별 최근 사용 문장입니다(카테고리별 넉넉한 쿨다운). */
  byPool: Map<string, string[]>;
};

function createPicker(): CuePicker {
  return { spoken: [], byPool: new Map() };
}

/** 최근에 쓴 문장을 피해 가며 큐를 고릅니다. 연속·근접 반복을 막습니다. */
function pickWithCooldown(
  pool: string[],
  poolKey: string,
  picker: CuePicker,
  random: () => number,
): string {
  if (pool.length === 0) return '';
  const usedInPool = picker.byPool.get(poolKey) ?? [];
  const globallyRecent = picker.spoken.slice(-GLOBAL_COOLDOWN);

  let chosen = pool[Math.floor(random() * pool.length) % pool.length];
  for (let window = cooldownWindowFor(pool.length); window >= 0; window -= 1) {
    const blocked = new Set(usedInPool.slice(-window));
    for (const text of globallyRecent) blocked.add(text);
    const candidates = pool.filter((text) => !blocked.has(text));
    if (candidates.length > 0) {
      chosen = candidates[Math.floor(random() * candidates.length) % candidates.length];
      break;
    }
  }

  // 예전에는 문장을 하나 고를 때마다 이력 배열을 통째로 새로 만들었습니다(고른 횟수의 제곱).
  // 있는 배열에 그대로 덧붙입니다. 담기는 내용과 순서는 같습니다.
  if (picker.byPool.has(poolKey)) usedInPool.push(chosen);
  else picker.byPool.set(poolKey, [chosen]);
  return chosen;
}

type CueSlot = {
  offsetSeconds: number;
  priority: number;
  build: (picker: CuePicker, random: () => number) => CoachCue;
};

function phaseSlot(
  offsetSeconds: number,
  phase: SessionPhase,
  step: keyof typeof phaseScripts.warmup,
  priority: number,
): CueSlot {
  return {
    offsetSeconds,
    priority,
    build: (picker, random) => ({
      offsetSeconds,
      text: pickWithCooldown(
        phaseScripts[phase.kind][step],
        `phase:${phase.kind}:${step}`,
        picker,
        random,
      ),
      kind: 'phase',
      phaseIndex: phase.index,
    }),
  };
}

/** 카테고리를 화면·기록에서 쓰는 큐 종류로 옮깁니다. */
function kindForCategory(category: CueCategory): CoachCue['kind'] {
  if (category === 'safety') return 'safety';
  if (category === 'encouragement' || category === 'mindset') return 'encouragement';
  return 'instruction';
}

export function createCoachSession(
  kind: CoachSessionKind | RunningTypeId | string,
  durationMinutes: number,
  guidance: GuidanceLevel = 'standard',
): CoachSession {
  const type = resolveRunningType(kind);
  const title: CoachSessionKind = isCoachSessionKind(kind) ? kind : type.title;
  // V6: 여기에 `Math.min(120, Math.max(10, ...))`이 있었습니다.
  //
  // 사용자가 7분을 고르면 10분짜리가, 3시간을 고르면 2시간짜리가 만들어졌습니다.
  // 아무 말도 없이 그렇게 됐습니다. 사용자는 자기가 고른 것과 다른 러닝을 하면서
  // 이유를 알 수 없었습니다. **말없이 자르는 것이 잘못이었습니다.**
  //
  // 이제 자르지 않습니다. 계산이 불가능한 값(0·음수·NaN)만 막습니다.
  const safeDuration = Number.isFinite(durationMinutes)
    ? Math.max(1, Math.round(durationMinutes))
    : DEFAULT_SESSION_MINUTES;
  const durationSeconds = safeDuration * 60;
  const phases = buildPhases(type.id, durationSeconds);
  const interval = guidanceIntervalSeconds[guidance];
  const minGap = Math.max(5, Math.min(7, Math.floor(interval / 2)));
  const random = createRandom(hashSeed(`${type.id}:${safeDuration}:${guidance}:${COACH_CONTENT_VERSION}`));

  const slots: CueSlot[] = [];

  slots.push({
    offsetSeconds: 0,
    priority: 100,
    build: () => ({ offsetSeconds: 0, text: openingCues[0], kind: 'safety' }),
  });

  // 1) 구간 전환 3단 안내: 10초 전 예고 → 전환 시점 → 전환 직후 자리잡기
  for (const phase of phases) {
    const length = phase.endSeconds - phase.startSeconds;
    const startAt = phase.index === 0 ? Math.min(6, Math.max(4, length - 2)) : phase.startSeconds;
    if (phase.index > 0 && phase.startSeconds >= 20) {
      slots.push(phaseSlot(phase.startSeconds - 10, phase, 'pre', 90));
    }
    slots.push(phaseSlot(startAt, phase, 'start', 95));
    if (length >= 30 && startAt + 10 < phase.endSeconds - 5) {
      slots.push(phaseSlot(startAt + 10, phase, 'settle', 80));
    }
  }

  // 2) 경과·남은 시간 진행 안내
  const progressOffsets = new Set<number>();
  for (let offset = 300; offset < durationSeconds - 60; offset += 300) {
    progressOffsets.add(offset);
  }
  for (const ratio of [0.25, 0.5, 0.75]) {
    const offset = Math.round(durationSeconds * ratio);
    if (offset > 60 && offset < durationSeconds - 60) progressOffsets.add(offset);
  }
  for (const offset of progressOffsets) {
    slots.push({
      offsetSeconds: offset,
      priority: 70,
      build: () => ({
        offsetSeconds: offset,
        text: progressLine(offset, durationSeconds),
        kind: 'progress',
      }),
    });
  }

  // 3) 평시 큐: 카테고리를 로테이션하며 촘촘하게 채웁니다.
  //    문장은 "그 시점의 상황"에 맞는 것만 뽑습니다. 경과 비율에 맞는 진행 문장, 유형 강도에 맞는
  //    표현, 워밍업에서 마무리성 문장 배제까지 여기서 걸러집니다.
  const allowEasyIntensity = allowsEasyIntensityCues(type);
  const allowSpeedUp = allowsSpeedUpCues(type);
  const phaseAt = (offset: number): SessionPhase | undefined =>
    phases.find((phase) => offset >= phase.startSeconds && offset < phase.endSeconds);

  const rotation = categoryRotation[type.id];
  let rotationIndex = 0;
  for (let offset = interval; offset < durationSeconds - 20; offset += interval) {
    const category: CueCategory = rotation[rotationIndex % rotation.length];
    rotationIndex += 1;
    const at = offset;
    const pool = contextualCuePool(type.id, category, {
      ratio: at / durationSeconds,
      allowEasyIntensity,
      allowSpeedUp,
      isWarmup: (phaseAt(at)?.index ?? 0) === 0,
    });
    slots.push({
      offsetSeconds: at,
      priority: 10,
      build: (picker, rng) => ({
        offsetSeconds: at,
        text: pickWithCooldown(pool, `category:${category}`, picker, rng),
        kind: kindForCategory(category),
        category,
      }),
    });
  }

  const closingOffset = Math.max(1, durationSeconds - 6);
  slots.push({
    offsetSeconds: closingOffset,
    priority: 100,
    build: () => ({ offsetSeconds: closingOffset, text: closingCues[0], kind: 'completion' }),
  });

  // 우선순위가 높은 큐를 먼저 확보하고, 너무 가까운 낮은 우선순위 큐는 버립니다.
  //
  // 예전에는 큐 하나를 넣을 때마다 이미 넣은 큐 전부와 거리를 견줬습니다(긴 세션이면 수만~수십만 번).
  // 넣은 시각을 정렬된 채로 들고 다니면 "바로 앞·바로 뒤" 둘만 보면 되므로 결과는 같고 훨씬 빠릅니다.
  const kept: CueSlot[] = [];
  const keptOffsets: number[] = [];
  /** 정렬된 배열에서 offset이 들어갈 자리를 찾습니다. */
  const insertionIndex = (offset: number): number => {
    let low = 0;
    let high = keptOffsets.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (keptOffsets[mid] < offset) low = mid + 1;
      else high = mid;
    }
    return low;
  };
  const ordered = [...slots].sort(
    (left, right) => right.priority - left.priority || left.offsetSeconds - right.offsetSeconds,
  );
  for (const slot of ordered) {
    const gap = slot.priority >= 70 ? 5 : minGap;
    const at = insertionIndex(slot.offsetSeconds);
    const after = keptOffsets[at];
    const before = keptOffsets[at - 1];
    if (after !== undefined && Math.abs(after - slot.offsetSeconds) < gap) continue;
    if (before !== undefined && Math.abs(before - slot.offsetSeconds) < gap) continue;
    kept.push(slot);
    keptOffsets.splice(at, 0, slot.offsetSeconds);
  }

  const picker = createPicker();
  const cues: CoachCue[] = [];
  for (const slot of kept.sort((left, right) => left.offsetSeconds - right.offsetSeconds)) {
    const cue = slot.build(picker, random);
    if (!cue.text) continue;
    cues.push(cue);
    picker.spoken.push(cue.text);
  }

  return {
    id: `${title}:${safeDuration}:${guidance}:${COACH_CONTENT_VERSION}`,
    title,
    typeId: type.id,
    durationMinutes: safeDuration,
    guidance,
    countsAs: type.countsAs,
    summary: sessionSummaries[title],
    phases,
    cues,
  };
}

/**
 * 실행 길이(SessionExtent)로 코칭을 만듭니다. **여기가 V6의 입구입니다.**
 *
 * 시간이 정해진 러닝은 그대로 만들면 됩니다.
 * 끝을 정하지 않은 러닝은 다릅니다 — 남은 시간을 모르므로
 * "3분 남았어요", "수고했어요" 같은 말이 나오면 안 됩니다.
 * 그래서 진행·완료 문장을 빼고, 한 시간치씩 이어 만듭니다.
 */
export function createCoachSessionForExtent(
  kind: CoachSessionKind | RunningTypeId | string,
  extent: SessionExtent,
  guidance: GuidanceLevel = 'standard',
  horizonMinutes: number = OPEN_ENDED_HORIZON_MINUTES,
): CoachSession {
  const known = totalSeconds(extent);
  if (known !== undefined) {
    return { ...createCoachSession(kind, known / 60, guidance), extent };
  }

  const base = createCoachSession(kind, Math.max(OPEN_ENDED_HORIZON_MINUTES, horizonMinutes), guidance);
  return {
    ...base,
    extent,
    // 끝을 모르는데 남은 시간과 마무리를 말하면 거짓말이 됩니다.
    cues: base.cues.filter((cue) => cue.kind !== 'progress' && cue.kind !== 'completion'),
  };
}

/**
 * 끝을 정하지 않은 러닝에서 다음 분량을 만들어야 하는지입니다.
 *
 * 만들어 둔 것이 바닥나기 전에 미리 이어 붙입니다. 바닥난 뒤에 만들면
 * 그 사이에 코치가 조용해지고, 사용자는 앱이 멈춘 줄 압니다.
 */
export function needsHorizonRefill(session: CoachSession, elapsedSeconds: number): boolean {
  if (!session.extent || hasKnownEnd(session.extent)) return false;
  return elapsedSeconds >= (session.durationMinutes - OPEN_ENDED_REFILL_MINUTES) * 60;
}

/** 지금 흘러간 시간에 맞는 다음 분량입니다. 30분 단위로 늘려 갑니다. */
export function nextHorizonMinutes(elapsedSeconds: number): number {
  const elapsedMinutes = elapsedSeconds / 60;
  const wanted = Math.ceil((elapsedMinutes + OPEN_ENDED_REFILL_MINUTES * 2) / 30) * 30;
  return Math.max(OPEN_ENDED_HORIZON_MINUTES, wanted);
}

export function cueScheduleForNative(session: CoachSession): string {
  return session.cues
    .map((cue) => `${cue.offsetSeconds}|${cue.text.replaceAll('|', ' ').replaceAll('\n', ' ')}`)
    .join('\n');
}

/** 분당 몇 개의 코치 멘트가 나오는지입니다. 연속 코칭의 핵심 지표예요. */
export function cueDensityPerMinute(session: CoachSession): number {
  if (session.durationMinutes <= 0) return 0;
  return session.cues.length / session.durationMinutes;
}

/** 말하기에 쓰일 것으로 추정되는 총 시간(초)입니다. */
export function estimatedSpokenSeconds(session: CoachSession): number {
  return session.cues.reduce((total, cue) => total + Math.max(2, cue.text.length / 5.5), 0);
}

/**
 * 세션에서 말이 없는 시간의 비율입니다.
 * 연속 코칭 기준에서는 0.35~0.85 사이가 정상 범위로, 완전한 침묵도 쉼 없는 소음도 아닙니다.
 */
export function cueSilenceRatio(session: CoachSession): number {
  return Math.max(0, 1 - estimatedSpokenSeconds(session) / (session.durationMinutes * 60));
}

/** 모든 유형이 최소 밀도 기준을 만족하는지 확인할 때 쓰는 임계값입니다. */
export const minimumCueDensityPerMinute = 2.5;

export function currentPhase(
  session: CoachSession,
  elapsedSeconds: number,
): SessionPhase | undefined {
  return (
    session.phases.find(
      (phase) => elapsedSeconds >= phase.startSeconds && elapsedSeconds < phase.endSeconds,
    ) ?? session.phases[session.phases.length - 1]
  );
}

export function nextPhase(
  session: CoachSession,
  elapsedSeconds: number,
): SessionPhase | undefined {
  return session.phases.find((phase) => phase.startSeconds > elapsedSeconds);
}

export function recentCues(
  session: CoachSession,
  elapsedSeconds: number,
  limit = 3,
): CoachCue[] {
  const spoken = session.cues.filter((cue) => cue.offsetSeconds <= elapsedSeconds);
  return spoken.slice(Math.max(0, spoken.length - limit)).reverse();
}

/** 유형 목록을 밀도와 함께 요약합니다(검증·문서용). */
export function cueDensityReport(
  durationMinutes = 30,
  guidance: GuidanceLevel = 'standard',
): { id: RunningTypeId; title: CoachSessionKind; density: number; cues: number }[] {
  return runningTypes.map((type) => {
    const session = createCoachSession(type.id, Math.min(type.maxMinutes, durationMinutes), guidance);
    return {
      id: type.id,
      title: session.title,
      density: Number(cueDensityPerMinute(session).toFixed(2)),
      cues: session.cues.length,
    };
  });
}
