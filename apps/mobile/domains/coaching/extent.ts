// 이번 러닝이 **언제 끝나는가**를 나타냅니다.
//
// V6가 바로잡는 오해:
//   "50분짜리 코치를 만들어라"가 아닙니다. 50분은 예 하나일 뿐입니다.
//   몇 분, 사용자가 고른 시간, 프로그램이 정한 시간, 목표 거리, 몇 시간,
//   그리고 **끝을 정하지 않은 자유 러닝**까지 전부 같은 엔진으로 돌아야 합니다.
//
// 그래서 이 파일이 하는 일은 하나입니다 —
//   **"지금 어디쯤인지"를 길이에 묶지 않고 판단합니다.**
//
// 그 전에는 `Math.min(120, Math.max(10, 분))`이 있었습니다.
// 10분 미만도, 2시간 초과도 조용히 잘려 나갔습니다. 사용자는 이유를 모른 채
// 자기가 고른 시간과 다른 러닝을 하게 됩니다. 그 clamp를 없앱니다.
//
// 이 파일은 순수합니다.

/** 이번 러닝이 끝나는 방식입니다. */
export type SessionExtent =
  /** 시간을 정해 두고 뜁니다. */
  | { type: 'fixed-time'; seconds: number }
  /** 거리를 정해 두고 뜁니다. 시간은 참고로만 씁니다. */
  | { type: 'fixed-distance'; meters: number; timeFallbackSeconds?: number }
  /** 계획의 회차를 따릅니다. 길이는 회차가 정합니다. */
  | { type: 'program'; sessionId: string; seconds: number }
  /** 끝을 정하지 않았습니다. 사용자가 멈출 때까지 갑니다. */
  | { type: 'open-ended' }
  /** 사용자가 "마무리 시작"을 누르면 그때부터 정리합니다. */
  | { type: 'until-user-cooldown' };

/** 시간이 정해진 방식인지입니다. 정해지지 않았으면 남은 시간을 말하면 안 됩니다. */
export function hasKnownEnd(extent: SessionExtent): boolean {
  return extent.type === 'fixed-time' || extent.type === 'program';
}

/** 정해진 전체 시간(초)입니다. 모르면 undefined입니다. */
export function totalSeconds(extent: SessionExtent): number | undefined {
  if (extent.type === 'fixed-time') return extent.seconds;
  if (extent.type === 'program') return extent.seconds;
  if (extent.type === 'fixed-distance') return extent.timeFallbackSeconds;
  return undefined;
}

/**
 * 러닝의 단계입니다. **길이에 묶이지 않습니다.**
 *
 * 예전에는 "전체 길이의 20%까지가 워밍업" 같은 식이었습니다.
 * 그러면 12분 러닝에서는 워밍업이 끝나지 않고, 3시간 러닝에서는 10분 만에 본 운동이 됩니다.
 */
export type SessionStage =
  /** 막 시작해서 몸이 아직 안 풀렸습니다. */
  | 'warmup'
  /** 안정 구간. 대부분의 시간이 여기입니다. */
  | 'steady'
  /** 힘들어지는 구간. 시간이 정해진 러닝에만 있습니다. */
  | 'late'
  /** 정리 중입니다. */
  | 'cooldown';

/**
 * 워밍업으로 보는 시간입니다.
 *
 * **비율이 아니라 실제 시간으로 정합니다.** 몸이 풀리는 데 걸리는 시간은
 * 그 러닝이 10분이든 3시간이든 비슷합니다. 비율로 하면 3시간 러닝에서
 * 워밍업만 27분이 되고, 10분 러닝에서는 90초 만에 끝납니다. 둘 다 틀립니다.
 */
export const WARMUP_SECONDS = 8 * 60;

/** 아주 짧은 러닝에서는 워밍업이 전체를 잡아먹지 않게 줄입니다. */
export const SHORT_SESSION_SECONDS = 15 * 60;
export const SHORT_WARMUP_SECONDS = 3 * 60;

/** 끝이 정해진 러닝에서 "막바지"로 보는 구간입니다. */
const LATE_RATIO = 0.8;

export type StageInput = {
  extent: SessionExtent;
  elapsedSeconds: number;
  /** 사용자가 "마무리 시작"을 눌렀는지입니다. */
  cooldownRequested?: boolean;
};

export function sessionStage(input: StageInput): SessionStage {
  const { extent, elapsedSeconds, cooldownRequested } = input;

  // 사용자가 누른 것이 무엇보다 먼저입니다.
  if (cooldownRequested) return 'cooldown';

  const total = totalSeconds(extent);
  const warmup =
    total !== undefined && total <= SHORT_SESSION_SECONDS ? SHORT_WARMUP_SECONDS : WARMUP_SECONDS;

  if (elapsedSeconds < warmup) return 'warmup';

  // 끝을 모르면 막바지라는 게 없습니다. 영원히 안정 구간입니다.
  if (total === undefined) return 'steady';

  if (elapsedSeconds >= total) return 'cooldown';
  if (elapsedSeconds >= total * LATE_RATIO) return 'late';
  return 'steady';
}

/**
 * 진행을 말해도 되는지입니다.
 *
 * **이게 이 파일에서 가장 중요한 규칙입니다.**
 * 끝을 정하지 않은 러닝에서 "거의 다 왔어요", "마지막 몇 분입니다" 같은 말이 나오면
 * 사용자는 코치가 뭔가 알고 있다고 믿게 됩니다. 우리는 모릅니다.
 */
export function mayMentionRemaining(extent: SessionExtent): boolean {
  return hasKnownEnd(extent);
}

/** 거리를 말해도 되는지입니다. 거리 목표가 있거나 실제 거리를 재고 있을 때만입니다. */
export function mayMentionDistance(extent: SessionExtent, hasDistanceSignal: boolean): boolean {
  if (extent.type === 'fixed-distance') return true;
  return hasDistanceSignal;
}

export type ProgressView = {
  stage: SessionStage;
  /** 0~1. 끝을 모르면 undefined입니다. */
  ratio?: number;
  /** 남은 초. 끝을 모르면 undefined입니다. */
  remainingSeconds?: number;
  /** 화면·음성에 쓸 한 줄입니다. 끝을 모르면 흘러간 시간만 말합니다. */
  label: string;
};

function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분`;
  return `${total}초`;
}

export function progressView(input: StageInput): ProgressView {
  const stage = sessionStage(input);
  const total = totalSeconds(input.extent);

  if (total === undefined) {
    // 끝을 모릅니다. **남은 것을 말하지 않고 지나온 것만 말합니다.**
    return { stage, label: `${clock(input.elapsedSeconds)}째 달리는 중` };
  }

  const remaining = Math.max(0, total - input.elapsedSeconds);
  return {
    stage,
    ratio: total > 0 ? Math.min(1, input.elapsedSeconds / total) : 0,
    remainingSeconds: remaining,
    label: remaining > 0 ? `${clock(remaining)} 남음` : '거의 다 왔어요',
  };
}

/**
 * 실행 중에 시간을 늘립니다.
 *
 * 끝을 정하지 않은 러닝에는 늘릴 것이 없으므로 그대로 둡니다.
 * 늘리는 것은 언제나 안전하므로 상한을 두지 않습니다 — 그게 예전 clamp의 문제였습니다.
 */
export function extendExtent(extent: SessionExtent, addSeconds: number): SessionExtent {
  if (addSeconds <= 0) return extent;
  if (extent.type === 'fixed-time') {
    return { type: 'fixed-time', seconds: extent.seconds + addSeconds };
  }
  if (extent.type === 'program') {
    return { ...extent, seconds: extent.seconds + addSeconds };
  }
  return extent;
}

/**
 * 끝이 정해져 있다고 전제하는 말인지입니다.
 *
 * 큐 종류가 'progress'나 'completion'이 아니어도 새어 나옵니다.
 * "남은 구간을 생각하며 힘을 배분해요" 같은 격려는 시간이 정해진 러닝에서는
 * 좋은 말이지만, 끝을 정하지 않은 러닝에서는 **없는 것을 있다고 말하는 것**입니다.
 * 사용자는 코치가 자기 계획을 안다고 믿게 됩니다.
 */
export function presumesKnownEnd(text: string): boolean {
  return /남은|남았|얼마\s*안\s*남|곧\s*끝|거의\s*다\s*왔|마무리하겠|수고했/.test(text);
}

/** 화면에 쓰는 이름입니다. */
export function extentLabel(extent: SessionExtent): string {
  if (extent.type === 'fixed-time') return `${Math.round(extent.seconds / 60)}분`;
  if (extent.type === 'program') return '계획대로';
  if (extent.type === 'fixed-distance') {
    const km = extent.meters / 1000;
    return km >= 1 ? `${Number(km.toFixed(1))}km` : `${extent.meters}m`;
  }
  if (extent.type === 'until-user-cooldown') return '끝낼 때까지';
  return '자유롭게';
}

/** 빠른 선택 버튼입니다. 5분 단위 + 자주 쓰는 길이. 여기 없는 값은 직접 입력합니다. */
export const quickMinutes = [5, 10, 15, 20, 30, 40, 50, 60, 90, 120] as const;

/** 실행 중 늘리기 버튼입니다. */
export const extendMinutes = [5, 10, 30] as const;
