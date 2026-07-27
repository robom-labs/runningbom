// 목표 대회에 맞춰 주차별 훈련 계획을 만드는 규칙 생성기입니다. 전부 순수 함수예요.
//
// 지키는 규칙(러닝 코치들이 공통으로 쓰는 기준입니다)
//  1. 권장 준비 기간: 5킬로 8~9주, 10킬로 8~10주, 하프 12~16주, 풀 18~20주.
//     남은 주가 짧아도 계획은 만들되 경고를 함께 돌려줍니다.
//  2. 주 3회면 길게 달리기 1회 + 편한 러닝 1회 + 조금 빠르게 1회. 주 4회면 편한 러닝을 1회 더.
//  3. 길게 달리기는 주당 5~10%만 늘립니다.
//  4. 3주 늘리면 1주는 20% 줄입니다(회복 주). 처음 달리는 사람은 2주 늘리고 1주 줄입니다.
//  5. 길게 달리기는 최근 4주 최장 거리의 110%를 절대 넘기지 않습니다.
//  6. 가장 길게 달리는 주는 대회 3주 전입니다.
//  7. 대회 전에는 거리를 40~60% 줄이되, 빠르기와 달리는 날 수는 그대로 둡니다.
//  8. 전체 거리의 80% 이상은 편한 강도로 채웁니다.

export type RacePlanDistance = '5k' | '10k' | 'half' | 'full';

export const racePlanDistances: RacePlanDistance[] = ['5k', '10k', 'half', 'full'];

export const racePlanDistanceLabels: Record<RacePlanDistance, string> = {
  '5k': '5킬로미터',
  '10k': '10킬로미터',
  half: '하프(21.1킬로미터)',
  full: '풀코스(42.195킬로미터)',
};

export const racePlanDistanceKm: Record<RacePlanDistance, number> = {
  '5k': 5,
  '10k': 10,
  half: 21.1,
  full: 42.195,
};

export type RacePlanGuide = {
  /** 권장 준비 기간(주) */
  minWeeks: number;
  maxWeeks: number;
  /** 대회 전 거리를 줄이는 기간(주). 대회가 있는 주도 여기에 들어갑니다. */
  taperWeeks: number;
  /** 사람에게 보여 주는 줄이기 안내입니다. */
  taperLabel: string;
  /** 가장 길게 달리는 날의 목표 거리(km) */
  peakLongKm: number;
  /** 이만큼도 못 늘리면 완주가 힘들 수 있다고 알려 주는 기준(km) */
  minPeakLongKm: number;
};

export const racePlanGuides: Record<RacePlanDistance, RacePlanGuide> = {
  '5k': {
    minWeeks: 8,
    maxWeeks: 9,
    taperWeeks: 1,
    taperLabel: '대회 3~7일 전부터 줄여요',
    peakLongKm: 8,
    minPeakLongKm: 5,
  },
  '10k': {
    minWeeks: 8,
    maxWeeks: 10,
    taperWeeks: 2,
    taperLabel: '대회 7~10일 전부터 줄여요',
    peakLongKm: 13,
    minPeakLongKm: 10,
  },
  half: {
    minWeeks: 12,
    maxWeeks: 16,
    taperWeeks: 2,
    taperLabel: '대회 2주 전부터 줄여요',
    peakLongKm: 18,
    minPeakLongKm: 15,
  },
  full: {
    minWeeks: 18,
    maxWeeks: 20,
    taperWeeks: 3,
    taperLabel: '대회 2~3주 전부터 줄여요',
    peakLongKm: 32,
    minPeakLongKm: 26,
  },
};

/** 주당 늘리는 비율입니다. 처음 달리는 사람은 더 천천히 늘립니다. */
export const GROWTH_RATE = 0.08;
export const BEGINNER_GROWTH_RATE = 0.05;
/** 회복 주에 줄이는 비율입니다. */
export const CUTBACK_RATE = 0.2;
/** 최근 4주 최장 거리 대비 절대 상한입니다. */
export const LONG_RUN_CAP_RATE = 1.1;
/** 편한 강도로 채워야 하는 최소 비율입니다. */
export const EASY_SHARE_TARGET = 0.8;
/** 대회 주간의 연습 러닝은 이 거리를 넘기지 않습니다. 다리를 아껴 두려고요. */
export const RACE_WEEK_MAX_RUN_KM = 4;

export type PlanRunKind = 'long' | 'easy' | 'fast' | 'race';

export const planRunLabels: Record<PlanRunKind, string> = {
  long: '길게 달리기',
  easy: '편한 러닝',
  fast: '조금 빠르게',
  race: '대회 당일',
};

export type PlanPhase = 'build' | 'recovery' | 'peak' | 'sharpen' | 'cutback' | 'raceWeek';

export const planPhaseLabels: Record<PlanPhase, string> = {
  build: '거리 늘리기',
  recovery: '회복 주',
  peak: '가장 길게 달리는 주',
  sharpen: '리듬 다듬기',
  cutback: '대회 전 줄이기',
  raceWeek: '대회 주간',
};

export type PlanRun = {
  id: string;
  kind: PlanRunKind;
  /** 예: "길게 달리기" */
  label: string;
  km: number;
  /** 어떻게 달리면 되는지 한 줄 안내입니다. */
  note: string;
  /** 편한 강도로 달리는 회차인지입니다. 길게 달리기도 편한 강도로 봅니다. */
  easy: boolean;
};

export type PlanWeek = {
  week: number;
  /** 대회까지 남은 주 수입니다. 대회가 있는 주는 0이에요. */
  weeksToRace: number;
  phase: PlanPhase;
  phaseLabel: string;
  /** 그 주에 가장 길게 달리는 거리(km) */
  longKm: number;
  /** 연습으로 달리는 거리 합계(대회 거리는 빼고) */
  trainingKm: number;
  /** 대회 거리까지 더한 합계 */
  totalKm: number;
  runs: PlanRun[];
  note: string;
};

export type PlanWarning = { id: string; text: string };

export type TrainingPlan = {
  distance: RacePlanDistance;
  distanceLabel: string;
  weeks: PlanWeek[];
  warnings: PlanWarning[];
  summary: {
    weeksLeft: number;
    runsPerWeek: number;
    /** 가장 길게 달리는 거리(km) */
    peakLongKm: number;
    /** 가장 길게 달리는 주가 몇 번째 주인지 */
    peakWeek: number;
    /** 대회 전에 줄이는 기간(주) */
    taperWeeks: number;
    taperLabel: string;
    /** 편한 강도가 전체에서 차지하는 비율(0~1) */
    easyShare: number;
    beginner: boolean;
  };
};

export type RacePlanInput = {
  distance: RacePlanDistance;
  /** 대회까지 남은 주 수 */
  weeksLeft: number;
  /** 지금 일주일에 달리는 거리(km) */
  weeklyKm: number;
  /** 일주일에 달리는 횟수 */
  runsPerWeek: number;
  /** 최근 4주 안에서 가장 길게 달린 거리(km). 모르면 주간 거리에서 어림잡습니다. */
  longestRecentKm?: number;
  /** 이제 막 달리기 시작한 사람인지입니다. 비우면 주간 거리로 판단합니다. */
  beginner?: boolean;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** 주 몇 회일 때 어떤 러닝을 넣을지입니다. 규칙 2번을 그대로 옮긴 표예요. */
export function weekRunKinds(runsPerWeek: number, beginner: boolean): PlanRunKind[] {
  const runs = clampInt(runsPerWeek, 1, 6);
  const kinds: PlanRunKind[] = ['long'];
  for (let index = 1; index < runs; index += 1) kinds.push('easy');
  // 조금 빠르게는 주 3회 이상일 때만 넣습니다. 이제 막 시작한 사람은 전부 편한 러닝으로 둡니다.
  if (runs >= 3 && !beginner) kinds[kinds.length - 1] = 'fast';
  return kinds;
}

function runNote(kind: PlanRunKind, phase: PlanPhase): string {
  if (kind === 'race') return '대회 날이에요. 처음 1~2킬로미터는 목표보다 조금 여유 있게 가요.';
  if (kind === 'long') {
    if (phase === 'cutback' || phase === 'raceWeek') {
      return '거리만 줄이고 편하게 달려요. 여기서 더 늘리지 않아요.';
    }
    if (phase === 'peak') return '가장 긴 날이에요. 옆 사람과 이야기할 수 있는 속도로 가요.';
    return '천천히, 끝까지 갈 수 있는 속도로 달려요.';
  }
  if (kind === 'fast') {
    return '앞뒤로 가볍게 풀고, 가운데만 숨이 조금 찰 정도로 달려요. 빠르기는 대회 때까지 그대로 둬요.';
  }
  return '숨이 편한 속도로 달려요. 힘들면 걸어도 괜찮아요.';
}

function weekNote(phase: PlanPhase, guide: RacePlanGuide): string {
  switch (phase) {
    case 'recovery':
      return '이번 주는 일부러 20% 줄여요. 몸이 자라는 건 쉬는 주예요.';
    case 'peak':
      return '가장 길게 달리는 주예요. 여기가 지나면 거리를 줄여 가요.';
    case 'sharpen':
      return '거리를 조금 낮추고 몸을 가볍게 만들어요.';
    case 'cutback':
      return `${guide.taperLabel}. 거리는 줄이고 빠르기와 달리는 날 수는 그대로 둬요.`;
    case 'raceWeek':
      return '대회가 있는 주예요. 짧고 가볍게만 달리고 잘 자요.';
    default:
      return '지난주보다 조금만 늘려요. 무리해서 크게 늘리지 않아요.';
  }
}

/** 대회 전 줄이기에서 몇 퍼센트를 줄일지입니다. 40%에서 시작해 대회 주에 60%까지 갑니다. */
export function taperCutRate(indexFromStart: number, taperWeeks: number): number {
  if (taperWeeks <= 1) return 0.5;
  const step = 0.2 / (taperWeeks - 1);
  return Math.round((0.4 + step * indexFromStart) * 100) / 100;
}

function buildRuns(input: {
  week: number;
  phase: PlanPhase;
  kinds: PlanRunKind[];
  longKm: number;
  weekKm: number;
}): PlanRun[] {
  const { week, phase, kinds, longKm, weekKm } = input;
  const rest = Math.max(0, weekKm - longKm);
  const others = kinds.length - 1;
  const fastCount = kinds.filter((kind) => kind === 'fast').length;
  // 조금 빠르게는 주간 거리의 18%를 넘지 않게 잡습니다(전체의 80%를 편한 강도로 두려고요).
  const fastKm = fastCount > 0 ? round1(Math.min(weekKm * 0.18, rest * 0.4)) : 0;
  const easyCount = others - fastCount;
  const easyKm = easyCount > 0 ? round1(Math.max(1, (rest - fastKm) / easyCount)) : 0;
  return kinds.map((kind, index) => {
    const km = kind === 'long' ? longKm : kind === 'fast' ? Math.max(1, fastKm) : easyKm;
    return {
      id: `w${week}-r${index + 1}`,
      kind,
      label: planRunLabels[kind],
      km: round1(km),
      note: runNote(kind, phase),
      easy: kind !== 'fast',
    };
  });
}

function raceWeekRuns(input: {
  week: number;
  kinds: PlanRunKind[];
  trainingKm: number;
  raceKm: number;
}): PlanRun[] {
  const { week, kinds, trainingKm, raceKm } = input;
  // 대회 자체가 그 주의 길게 달리기입니다. 나머지 날은 짧고 가볍게 둡니다.
  const others = Math.max(0, kinds.length - 1);
  const perRun =
    others > 0
      ? round1(Math.min(RACE_WEEK_MAX_RUN_KM, Math.max(2, trainingKm / others)))
      : 0;
  const runs: PlanRun[] = [];
  for (let index = 0; index < others; index += 1) {
    const isFast = index === others - 1 && kinds.includes('fast');
    runs.push({
      id: `w${week}-r${index + 1}`,
      kind: isFast ? 'fast' : 'easy',
      label: planRunLabels[isFast ? 'fast' : 'easy'],
      km: perRun,
      note: isFast
        ? '아주 짧게만 빠르게 달려 몸을 깨워요. 힘을 다 쓰지 않아요.'
        : '짧고 편하게 달려요. 다리를 아껴 둬요.',
      easy: !isFast,
    });
  }
  runs.push({
    id: `w${week}-race`,
    kind: 'race',
    label: planRunLabels.race,
    km: round1(raceKm),
    note: runNote('race', 'raceWeek'),
    easy: true,
  });
  return runs;
}

function buildWarnings(input: {
  distance: RacePlanDistance;
  guide: RacePlanGuide;
  weeksLeft: number;
  runsPerWeek: number;
  weeklyKm: number;
  beginner: boolean;
  peakLongKm: number;
  peakWeeklyKm: number;
}): PlanWarning[] {
  const { distance, guide, weeksLeft, runsPerWeek, weeklyKm, beginner, peakLongKm, peakWeeklyKm } =
    input;
  const label = racePlanDistanceLabels[distance];
  const warnings: PlanWarning[] = [];
  if (weeksLeft < guide.minWeeks) {
    warnings.push({
      id: 'short-prep',
      text: `${label} 대회는 보통 ${guide.minWeeks}~${guide.maxWeeks}주 준비해요. 지금은 ${weeksLeft}주뿐이라 계획을 짧게 눌러 담았어요. 기록보다 완주를 목표로 잡고, 아프면 바로 쉬어요.`,
    });
  }
  if (weeksLeft > guide.maxWeeks + 6) {
    warnings.push({
      id: 'long-prep',
      text: '준비 기간이 아주 넉넉해요. 앞쪽 몇 주는 거리를 늘리기보다 달리는 습관을 만드는 데 써도 좋아요.',
    });
  }
  if (runsPerWeek < 3) {
    warnings.push({
      id: 'few-runs',
      text: '일주일에 세 번은 달려야 계획대로 늘리기 좋아요. 지금은 횟수가 적어서 거리가 천천히 늘어요.',
    });
  }
  if (runsPerWeek > 5) {
    warnings.push({
      id: 'many-runs',
      text: '일주일에 다섯 번이 넘으면 다치기 쉬워요. 최소 하루는 완전히 쉬어요.',
    });
  }
  if (weeklyKm <= 0) {
    warnings.push({
      id: 'no-history',
      text: '지금 일주일에 얼마나 달리는지 모르면 계획이 대충 잡혀요. 2주만 기록을 남기고 다시 만들어 보세요.',
    });
  }
  if (peakLongKm < guide.minPeakLongKm) {
    warnings.push({
      id: 'short-peak',
      text: `계획대로 해도 가장 긴 날이 ${round1(peakLongKm)}킬로미터에 그쳐요. 대회에서 중간중간 걸어도 괜찮다고 생각하고 나가요.`,
    });
  }
  if (weeklyKm > 0 && peakWeeklyKm > weeklyKm * 2) {
    warnings.push({
      id: 'big-jump',
      text: `계획 끝에는 주간 거리가 약 ${round1(peakWeeklyKm)}킬로미터까지 늘어요. 지금의 두 배가 넘으니 힘들면 늘리는 속도를 늦추고 회복 주를 한 번 더 넣어요.`,
    });
  }
  if (beginner && distance === 'full') {
    warnings.push({
      id: 'beginner-full',
      text: '풀코스는 하프를 한 번 달려 본 뒤에 잡으면 훨씬 안전해요. 이번에는 짧은 대회를 먼저 골라도 좋아요.',
    });
  }
  return warnings;
}

/** 목표 대회에 맞춘 주차별 훈련 계획을 만듭니다. */
export function buildTrainingPlan(input: RacePlanInput): TrainingPlan {
  const guide = racePlanGuides[input.distance];
  const weeksLeft = clampInt(input.weeksLeft, 1, 40);
  const runsPerWeek = clampInt(input.runsPerWeek, 1, 6);
  const weeklyKm = clampNumber(input.weeklyKm, 0, 200);
  const beginner = input.beginner ?? weeklyKm < 15;
  const growth = beginner ? BEGINNER_GROWTH_RATE : GROWTH_RATE;
  // 3주 늘리고 1주 줄이기(처음 달리는 사람은 2주 늘리고 1주 줄이기)
  const cycle = beginner ? 3 : 4;

  const seedLong = round1(
    Math.max(1, input.longestRecentKm ?? Math.max(2, weeklyKm * 0.35)),
  );
  const longShare = runsPerWeek >= 4 ? 0.35 : 0.4;
  const seedWeekly = Math.max(round1(weeklyKm), round1(seedLong / longShare));

  const taperWeeks = Math.min(guide.taperWeeks, Math.max(0, weeksLeft - 1));
  const taperStart = weeksLeft - taperWeeks + 1;
  // 가장 길게 달리는 주는 대회 3주 전입니다. 줄이기 기간과 겹치면 그 앞으로 당깁니다.
  const peakWeek = Math.max(1, Math.min(weeksLeft - 3, taperStart - 1));

  const kinds = weekRunKinds(runsPerWeek, beginner);
  const raceKm = racePlanDistanceKm[input.distance];

  const history: number[] = [seedLong];
  let buildLong = seedLong;
  let peakLongKm = seedLong;
  let peakWeeklyKm = seedWeekly;
  const weeks: PlanWeek[] = [];

  for (let week = 1; week <= weeksLeft; week += 1) {
    const isRaceWeek = week === weeksLeft;
    const isTaper = week >= taperStart;
    const isPeak = week === peakWeek && !isTaper;
    const isRecovery = !isTaper && !isPeak && week < peakWeek && week % cycle === 0;
    const isSharpen = !isTaper && !isPeak && week > peakWeek;

    let phase: PlanPhase = 'build';
    let longKm = buildLong;
    let weekKm = seedWeekly;

    if (isRaceWeek) {
      phase = 'raceWeek';
      const cut = taperWeeks > 0 ? taperCutRate(taperWeeks - 1, taperWeeks) : 0.5;
      weekKm = round1(peakWeeklyKm * (1 - cut));
      longKm = 0;
    } else if (isTaper) {
      phase = 'cutback';
      const cut = taperCutRate(week - taperStart, taperWeeks);
      weekKm = round1(peakWeeklyKm * (1 - cut));
      longKm = round1(peakLongKm * (1 - cut));
    } else if (isSharpen) {
      phase = 'sharpen';
      weekKm = round1(peakWeeklyKm * 0.9);
      longKm = round1(peakLongKm * 0.9);
    } else if (isRecovery) {
      phase = 'recovery';
      longKm = round1(buildLong * (1 - CUTBACK_RATE));
      weekKm = round1(seedWeekly * (longKm / seedLong));
    } else {
      // 늘리는 주입니다. 5~10%만 늘리고, 최근 4주 최장의 110%를 절대 넘기지 않습니다.
      const target = Math.min(buildLong * (1 + growth), guide.peakLongKm);
      const recentMax = Math.max(...history.slice(-4));
      const capped = Math.min(target, recentMax * LONG_RUN_CAP_RATE);
      longKm = round1(Math.max(buildLong, capped));
      buildLong = longKm;
      weekKm = round1(seedWeekly * (longKm / seedLong));
      phase = isPeak ? 'peak' : 'build';
      peakLongKm = Math.max(peakLongKm, longKm);
      peakWeeklyKm = Math.max(peakWeeklyKm, weekKm);
    }

    history.push(longKm > 0 ? longKm : buildLong);

    const runs = isRaceWeek
      ? raceWeekRuns({ week, kinds, trainingKm: weekKm, raceKm })
      : buildRuns({ week, phase, kinds, longKm, weekKm });

    const trainingKm = round1(
      runs.filter((item) => item.kind !== 'race').reduce((sum, item) => sum + item.km, 0),
    );
    const totalKm = round1(runs.reduce((sum, item) => sum + item.km, 0));

    weeks.push({
      week,
      weeksToRace: weeksLeft - week,
      phase,
      phaseLabel: planPhaseLabels[phase],
      longKm: isRaceWeek ? round1(raceKm) : round1(longKm),
      trainingKm,
      totalKm,
      runs,
      note: weekNote(phase, guide),
    });
  }

  const allKm = weeks.reduce((sum, week) => sum + week.totalKm, 0);
  const easyKm = weeks.reduce(
    (sum, week) =>
      sum + week.runs.filter((run) => run.easy).reduce((inner, run) => inner + run.km, 0),
    0,
  );

  return {
    distance: input.distance,
    distanceLabel: racePlanDistanceLabels[input.distance],
    weeks,
    warnings: buildWarnings({
      distance: input.distance,
      guide,
      weeksLeft,
      runsPerWeek,
      weeklyKm,
      beginner,
      peakLongKm,
      peakWeeklyKm,
    }),
    summary: {
      weeksLeft,
      runsPerWeek,
      peakLongKm: round1(peakLongKm),
      peakWeek,
      taperWeeks,
      taperLabel: guide.taperLabel,
      easyShare: allKm > 0 ? easyKm / allKm : 1,
      beginner,
    },
  };
}

/** 대회 이름에서 목표 거리를 짐작합니다. 틀릴 수 있어서 화면에서 바꿀 수 있게 둡니다. */
export function guessRaceDistance(name: string): RacePlanDistance {
  const text = name.normalize('NFKC').toLocaleLowerCase('ko-KR');
  if (/풀코스|풀마라톤|42/.test(text)) return 'full';
  if (/하프|21\.1|21km|21 km/.test(text)) return 'half';
  if (/10\s*(k|km|킬로)/.test(text)) return '10k';
  if (/5\s*(k|km|킬로)/.test(text)) return '5k';
  if (/마라톤/.test(text)) return '10k';
  return '10k';
}
