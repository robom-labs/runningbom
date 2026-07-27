// 도전의 진행률과 "이 속도면 언제 끝나는지"를 계산하는 순수 함수 모음입니다.
// 화면도 저장소도 모르는 모듈이라 그대로 테스트할 수 있습니다.
import { kstDayKey } from '../activities/summary';
import { activityCountsAsMovement, type ActivityRecord } from '../activities/types';
import { daysBetween } from './catalog';
import {
  formatChallengeAmount,
  formatChallengeValue,
  type Challenge,
  type ChallengeGoal,
} from './types';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 이 기록이 도전의 셈에 들어가는 종류·길이인지 봅니다. */
export function activityMatchesGoal(activity: ActivityRecord, goal: ChallengeGoal): boolean {
  if (goal.kinds && !goal.kinds.includes(activity.kind)) return false;
  if (goal.minMinutes !== undefined && activity.durationMinutes < goal.minMinutes) return false;
  return true;
}

/**
 * 기간 안의 실제 기록만 모아 지금까지의 값을 냅니다.
 * distance는 km 합계, minutes는 분 합계, sessions는 횟수,
 * activeDays는 "움직였다"고 볼 만한 기록이 있는 날의 수입니다.
 */
export function challengeCurrent(
  activities: ActivityRecord[],
  challenge: Challenge,
): number {
  const { goal, startDay, endDay } = challenge;
  const days = new Set<string>();
  let total = 0;
  for (const activity of activities) {
    const day = kstDayKey(activity.completedAt);
    if (!day || day < startDay || day > endDay) continue;
    if (!activityMatchesGoal(activity, goal)) continue;
    if (goal.metric === 'distance') total += activity.distanceKm ?? 0;
    else if (goal.metric === 'minutes') total += activity.durationMinutes;
    else if (goal.metric === 'sessions') total += 1;
    else if (activityCountsAsMovement(activity)) days.add(day);
  }
  return goal.metric === 'activeDays' ? days.size : round2(total);
}

export type ChallengeState = 'upcoming' | 'active' | 'ended';

export type ChallengePeriod = {
  state: ChallengeState;
  /** 기간 전체의 날 수입니다(시작일과 마지막 날 포함). */
  totalDays: number;
  /** 시작일부터 오늘까지 지난 날 수입니다(오늘 포함). 시작 전이면 0입니다. */
  daysElapsed: number;
  /** 오늘부터 마지막 날까지 남은 날 수입니다(오늘 포함). 끝났으면 0입니다. */
  daysLeft: number;
  dDayLabel: string;
  remainingLabel: string;
};

export function challengePeriod(
  challenge: Challenge,
  now: number = Date.now(),
): ChallengePeriod {
  const today = kstDayKey(new Date(now));
  const totalDays = daysBetween(challenge.startDay, challenge.endDay) + 1;
  const toEnd = daysBetween(today, challenge.endDay);

  if (today < challenge.startDay) {
    const toStart = daysBetween(today, challenge.startDay);
    return {
      state: 'upcoming',
      totalDays,
      daysElapsed: 0,
      daysLeft: totalDays,
      dDayLabel: `D-${toEnd}`,
      remainingLabel: `${toStart}일 뒤에 시작해요`,
    };
  }
  if (today > challenge.endDay) {
    return {
      state: 'ended',
      totalDays,
      daysElapsed: totalDays,
      daysLeft: 0,
      dDayLabel: `D+${Math.abs(toEnd)}`,
      remainingLabel: '끝난 도전이에요',
    };
  }
  return {
    state: 'active',
    totalDays,
    daysElapsed: daysBetween(challenge.startDay, today) + 1,
    daysLeft: toEnd + 1,
    dDayLabel: toEnd === 0 ? 'D-DAY' : `D-${toEnd}`,
    remainingLabel: toEnd === 0 ? '오늘이 마지막 날이에요' : `${toEnd + 1}일 남았어요`,
  };
}

export type ChallengeForecast = {
  /** 지금까지의 하루 평균입니다. */
  perDaySoFar: number;
  /** 남은 날에 하루 얼마씩 하면 되는지입니다. 이미 다 했으면 0입니다. */
  perDayNeeded: number;
  /** 지금 속도 그대로 기간 끝까지 갔을 때의 예상 총량입니다. */
  projected: number;
  /** 지금 속도로 목표에 닿기까지 오늘부터 필요한 날 수입니다. 속도가 0이면 없습니다. */
  finishInDays?: number;
  /** 기간 마지막 날보다 며칠 일찍 끝나는지입니다. 일찍 못 끝내면 0입니다. */
  earlyByDays: number;
};

/**
 * "이 속도면" 예측입니다. 규칙은 딱 세 줄입니다.
 * 1) 하루 평균 = 지금까지 한 양 ÷ 지난 날 수
 * 2) 예상 총량 = 하루 평균 × 기간 전체 날 수
 * 3) 목표까지 남은 날 = 올림(남은 양 ÷ 하루 평균)
 */
export function challengeForecast(input: {
  current: number;
  target: number;
  totalDays: number;
  daysElapsed: number;
  daysLeft: number;
}): ChallengeForecast {
  const { current, target, totalDays, daysElapsed, daysLeft } = input;
  const remaining = Math.max(0, target - current);
  const perDaySoFar = daysElapsed > 0 ? round2(current / daysElapsed) : 0;
  const projected = round2(perDaySoFar * totalDays);
  const perDayNeeded = remaining > 0 && daysLeft > 0 ? round2(remaining / daysLeft) : 0;
  if (remaining <= 0 || perDaySoFar <= 0) {
    return { perDaySoFar, perDayNeeded, projected, earlyByDays: 0 };
  }
  const finishInDays = Math.ceil(remaining / perDaySoFar);
  const earlyByDays = finishInDays < daysLeft ? daysLeft - finishInDays : 0;
  return { perDaySoFar, perDayNeeded, projected, finishInDays, earlyByDays };
}

export type ChallengeProgress = {
  challenge: Challenge;
  current: number;
  target: number;
  /** 0~1로 자른 진행률입니다. */
  ratio: number;
  percent: number;
  done: boolean;
  amountLabel: string;
  insight: string;
} & ChallengePeriod &
  ChallengeForecast;

function monthDayLabel(day: string): string {
  return `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`;
}

/**
 * 카드에 한 줄로 붙는 해석입니다. 지어낸 응원 대신 계산된 사실만 말합니다.
 * 순서: 완료 → 시작 전 → 끝남 → 일찍 끝날 속도 → 딱 맞는 속도 → 앞으로 얼마나 하면 되는지.
 */
export function challengeInsight(input: {
  challenge: Challenge;
  current: number;
  done: boolean;
  period: ChallengePeriod;
  forecast: ChallengeForecast;
}): string {
  const { challenge, current, done, period, forecast } = input;
  const metric = challenge.goal.metric;
  const remaining = Math.max(0, challenge.goal.target - current);

  if (done) return '목표를 다 채웠어요. 축하해요!';
  if (period.state === 'upcoming') return `${monthDayLabel(challenge.startDay)}에 시작해요.`;
  if (period.state === 'ended') {
    return `${formatChallengeValue(metric, current)}에서 기간이 끝났어요. 다음 기간에 다시 도전해요.`;
  }
  if (forecast.earlyByDays >= 1) return `이 속도면 ${forecast.earlyByDays}일 일찍 끝나요.`;
  if (forecast.perDaySoFar > 0 && forecast.projected >= challenge.goal.target) {
    return '이 속도면 딱 맞게 끝나요.';
  }
  if (metric === 'distance' || metric === 'minutes') {
    const perDay = Math.max(metric === 'distance' ? 0.1 : 1, forecast.perDayNeeded);
    return `하루 ${formatChallengeValue(metric, perDay)}씩이면 됩니다.`;
  }
  return `남은 ${period.daysLeft}일 동안 ${formatChallengeValue(metric, remaining)} 더 하면 됩니다.`;
}

export function challengeProgress(
  challenge: Challenge,
  activities: ActivityRecord[],
  now: number = Date.now(),
): ChallengeProgress {
  const current = challengeCurrent(activities, challenge);
  const target = challenge.goal.target;
  const period = challengePeriod(challenge, now);
  const forecast = challengeForecast({
    current,
    target,
    totalDays: period.totalDays,
    daysElapsed: period.daysElapsed,
    daysLeft: period.daysLeft,
  });
  const done = current >= target;
  const ratio = target > 0 ? Math.max(0, Math.min(1, current / target)) : 0;
  return {
    challenge,
    current,
    target,
    ratio,
    percent: Math.round(ratio * 100),
    done,
    amountLabel: formatChallengeAmount(challenge.goal.metric, current, target),
    insight: challengeInsight({ challenge, current, done, period, forecast }),
    ...period,
    ...forecast,
  };
}

export type ChallengeSections = {
  /** 참가했고 아직 기간이 남은 도전입니다. */
  mine: ChallengeProgress[];
  /** 아직 참가하지 않은, 지금 참가할 수 있는 도전입니다. */
  available: ChallengeProgress[];
  /** 기간이 끝난 도전입니다(참가했던 것만 남깁니다). */
  past: ChallengeProgress[];
};

export function challengeSections(
  all: ChallengeProgress[],
  joinedIds: string[],
): ChallengeSections {
  const joined = new Set(joinedIds);
  const mine = all.filter((item) => joined.has(item.challenge.id) && item.state !== 'ended');
  const available = all.filter((item) => !joined.has(item.challenge.id) && item.state !== 'ended');
  const past = all.filter((item) => joined.has(item.challenge.id) && item.state === 'ended');

  // 내 도전은 아직 못 끝낸 것부터, 그중에서도 남은 날이 적은 것부터 보여 줍니다.
  mine.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
    return b.ratio - a.ratio;
  });
  // 참가할 수 있는 도전은 이미 많이 채워 둔 것부터 보여 줍니다.
  available.sort((a, b) => {
    if (b.ratio !== a.ratio) return b.ratio - a.ratio;
    return a.target - b.target;
  });
  past.sort((a, b) => b.challenge.endDay.localeCompare(a.challenge.endDay));
  return { mine, available, past };
}

/** 참가한 게 하나도 없을 때 크게 보여 줄 추천 1개입니다. 이미 가장 많이 채워 둔 도전을 고릅니다. */
export function recommendChallenge(
  available: ChallengeProgress[],
): ChallengeProgress | undefined {
  return available.find((item) => item.state === 'active') ?? available[0];
}

/** 참가했지만 아직 축하를 보지 않은 완료 도전입니다. */
export function pendingCelebration(
  mine: ChallengeProgress[],
  celebratedIds: string[],
): ChallengeProgress | undefined {
  const seen = new Set(celebratedIds);
  return mine.find((item) => item.done && !seen.has(item.challenge.id));
}
