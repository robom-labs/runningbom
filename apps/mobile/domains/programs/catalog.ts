// 어떤 계획들이 있고, 누구에게 보여 줘도 되는지를 정하는 목록입니다.
//
// 두 가지를 분리했습니다.
//   - 계획이 무엇인가(제목·기간·생성 규칙)
//   - 지금 이 사람에게 보여 줘도 되는가(자격조건·공개 단계)
//
// 자격조건을 계획 안에 넣어 둔 이유는, 화면이 깜빡 잊고 걸러 주지 않아도
// 목록 자체가 안전해야 하기 때문입니다.
import { PROGRAM_ID as START9_ID } from './beginnerProgram';
import { generatePlan, validatePlan, type PlanRecipe } from './generator';
import { isAtLeast, levelRank, type RunnerCapability, type UserLevelId } from './level';
import type { RunProgram } from './types';

/** 사용자에게 보여 주는 큰 갈래입니다. 화면의 카테고리와 짝을 이룹니다. */
export type ProgramCategory =
  | 'START'
  | 'FIVE_TEN_K'
  | 'BASE'
  | 'RETURN'
  | 'INDOOR'
  | 'LIFESTYLE'
  | 'IMPROVE'
  | 'RECOVERY';

export const categoryLabels: Record<ProgramCategory, string> = {
  START: '처음 시작',
  FIVE_TEN_K: '5km·10km',
  BASE: '기초 쌓기',
  RETURN: '쉬었다가 다시',
  INDOOR: '실내·러닝머신',
  LIFESTYLE: '생활에 맞춰',
  IMPROVE: '기록 다듬기',
  RECOVERY: '대회 뒤 회복',
};

/**
 * 언제 사용자에게 열어도 되는지입니다.
 *  - NOW: 조건만 맞으면 바로
 *  - ELIGIBILITY: 조건이 더 까다로움(자격조건을 반드시 확인)
 *  - EXPERT_REQUIRED: 전문가 검수 전에는 절대 노출하지 않음
 */
export type ReleaseGate = 'NOW' | 'ELIGIBILITY' | 'EXPERT_REQUIRED';

export type ProgramEligibility = {
  /** 이 수준 아래로는 시작할 수 없습니다. */
  minLevel: UserLevelId;
  /** 최근 주간 거리(km) 최소치입니다. */
  minRecentWeeklyKm?: number;
  /** 최근 가장 길게 달린 거리(km) 최소치입니다. */
  minLongestRunKm?: number;
};

export type ProgramFamily = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: ProgramCategory;
  eligibility: ProgramEligibility;
  releaseGate: ReleaseGate;
  /**
   * 계획을 만들어 내는 규칙입니다.
   * start9처럼 손으로 쓴 정본이 있는 계획은 비워 둡니다.
   */
  recipe?: Omit<PlanRecipe, 'id' | 'name' | 'subtitle' | 'description'>;
};

/**
 * 계획 목록입니다.
 * 여기 숫자를 고칠 때는 반드시 안전 검증기를 다시 돌립니다.
 * (테스트가 모든 계획을 만들어 보고 검증기에 통과하는지 확인합니다.)
 */
export const programFamilies: ProgramFamily[] = [
  {
    id: 'move-14d',
    title: '14일 움직임 시작',
    subtitle: '2주 · 주 3회',
    description: '달리기 전에 몸을 움직이는 습관부터 만들어요. 걷기 위주라 부담이 적어요.',
    category: 'START',
    eligibility: { minLevel: 'L0_MOVE' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 30,
      endRunSeconds: 60,
      startTotalRunSeconds: 120,
      endTotalRunSeconds: 180,
      walkRatio: 2,
      weeks: 2,
      daysPerWeek: 3,
    },
  },
  {
    id: 'first-run-10m',
    title: '처음 10분 달리기',
    subtitle: '4주 · 주 3회',
    description: '10분을 쉬지 않고 달리는 것이 목표예요. 걷기를 섞어 천천히 늘려요.',
    category: 'START',
    eligibility: { minLevel: 'L0_MOVE' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 60,
      endRunSeconds: 600,
      startTotalRunSeconds: 480,
      endTotalRunSeconds: 600,
      walkRatio: 1,
      weeks: 4,
      daysPerWeek: 3,
    },
  },
  {
    id: 'continuous-20m',
    title: '20분 이어 달리기',
    subtitle: '6주 · 주 3회',
    description: '9주가 길게 느껴진다면 여기서 시작해요. 20분 연속이 목표예요.',
    category: 'START',
    eligibility: { minLevel: 'L1_RUN_WALK' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 120,
      endRunSeconds: 1200,
      startTotalRunSeconds: 720,
      endTotalRunSeconds: 1200,
      walkRatio: 1,
      weeks: 6,
      daysPerWeek: 3,
    },
  },
  {
    id: START9_ID,
    title: '9주 달리기 시작',
    subtitle: '9주 · 주 3회',
    description: '걷기부터 시작해 30분을 쉬지 않고 달리는 것이 목표예요.',
    category: 'START',
    eligibility: { minLevel: 'L0_MOVE' },
    releaseGate: 'NOW',
    // 손으로 쓴 정본이 있습니다. 생성기로 다시 만들지 않습니다.
  },
  {
    id: 'first-5k',
    title: '처음 5km 완주',
    subtitle: '8주 · 주 3회',
    description: '걷기를 섞어도 괜찮아요. 5km를 끝까지 가는 것이 목표예요.',
    category: 'FIVE_TEN_K',
    eligibility: { minLevel: 'L2_RUN_10' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 300,
      endRunSeconds: 1800,
      startTotalRunSeconds: 900,
      endTotalRunSeconds: 1800,
      walkRatio: 0.5,
      weeks: 8,
      daysPerWeek: 3,
    },
  },
  {
    id: 'steady-5k',
    title: '편하게 5km 만들기',
    subtitle: '6주 · 주 3회',
    description: '5km를 완주해 봤다면, 이제 힘들지 않게 달리는 것이 목표예요.',
    category: 'FIVE_TEN_K',
    eligibility: { minLevel: 'L4_5K' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 900,
      endRunSeconds: 1800,
      startTotalRunSeconds: 1500,
      endTotalRunSeconds: 2100,
      walkRatio: 0.3,
      weeks: 6,
      daysPerWeek: 3,
    },
  },
  {
    id: 'first-10k',
    title: '처음 10km 완주',
    subtitle: '10주 · 주 3회',
    description: '5km를 편하게 달릴 수 있다면 거리를 두 배로 늘려 볼 때예요.',
    category: 'FIVE_TEN_K',
    eligibility: { minLevel: 'L4_5K', minLongestRunKm: 4 },
    releaseGate: 'ELIGIBILITY',
    recipe: {
      startRunSeconds: 1200,
      endRunSeconds: 3600,
      startTotalRunSeconds: 1800,
      endTotalRunSeconds: 3600,
      walkRatio: 0.2,
      weeks: 10,
      daysPerWeek: 3,
    },
  },
  {
    id: 'base-builder',
    title: '편하게 기초 쌓기',
    subtitle: '6주 · 주 3회',
    description: '대회 목표 없이, 편한 속도로 달리는 기반을 만들어요.',
    category: 'BASE',
    eligibility: { minLevel: 'L3_RUN_30' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 900,
      endRunSeconds: 1800,
      startTotalRunSeconds: 1200,
      endTotalRunSeconds: 1800,
      walkRatio: 0.3,
      weeks: 6,
      daysPerWeek: 3,
    },
  },
  {
    id: 'return-short-break',
    title: '잠깐 쉬었다가 다시',
    subtitle: '4주 · 주 3회',
    description: '2~4주 쉬었다면 예전 수준부터 시작하지 않아요. 낮춰서 다시 올려요.',
    category: 'RETURN',
    eligibility: { minLevel: 'L2_RUN_10' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 300,
      endRunSeconds: 1200,
      startTotalRunSeconds: 600,
      endTotalRunSeconds: 1200,
      walkRatio: 0.5,
      weeks: 4,
      daysPerWeek: 3,
    },
  },
  {
    id: 'treadmill-beginner',
    title: '러닝머신으로 시작',
    subtitle: '6주 · 주 3회',
    description: '밖에 나가기 어려운 날에도 할 수 있어요. 거리 대신 시간으로 해요.',
    category: 'INDOOR',
    eligibility: { minLevel: 'L0_MOVE' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 60,
      endRunSeconds: 1200,
      startTotalRunSeconds: 480,
      endTotalRunSeconds: 1200,
      walkRatio: 1,
      weeks: 6,
      daysPerWeek: 3,
    },
  },
  {
    id: 'busy-2days',
    title: '주 2번만 달리기',
    subtitle: '8주 · 주 2회',
    description: '시간이 많지 않아도 괜찮아요. 주 2번으로 꾸준히 가요.',
    category: 'LIFESTYLE',
    eligibility: { minLevel: 'L1_RUN_WALK' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 120,
      endRunSeconds: 1500,
      startTotalRunSeconds: 600,
      endTotalRunSeconds: 1500,
      walkRatio: 1,
      weeks: 8,
      daysPerWeek: 2,
    },
  },
  {
    id: 'morning-20',
    title: '아침 20분 만들기',
    subtitle: '4주 · 주 3회',
    description: '출근 전에 짧게 달리는 습관을 만들어요. 20분 안에 끝나요.',
    category: 'LIFESTYLE',
    eligibility: { minLevel: 'L1_RUN_WALK' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 120,
      endRunSeconds: 600,
      startTotalRunSeconds: 480,
      endTotalRunSeconds: 720,
      walkRatio: 0.5,
      weeks: 4,
      daysPerWeek: 3,
    },
  },
  {
    id: 'walk-5k',
    title: '5km 걷기 완주',
    subtitle: '6주 · 주 3회',
    description: '달리기 없이 걷기만으로 5km를 완주해요. 달리기는 그 다음이에요.',
    category: 'START',
    eligibility: { minLevel: 'L0_MOVE' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 60,
      endRunSeconds: 300,
      startTotalRunSeconds: 300,
      endTotalRunSeconds: 600,
      walkRatio: 2,
      weeks: 6,
      daysPerWeek: 3,
    },
  },
  {
    id: 'run-ready-4w',
    title: '달리기 준비 4주',
    subtitle: '4주 · 주 3회',
    description: '걷기에 익숙해졌다면, 아주 짧게 뛰는 것부터 섞어 봐요.',
    category: 'START',
    eligibility: { minLevel: 'L0_MOVE' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 30,
      endRunSeconds: 120,
      startTotalRunSeconds: 180,
      endTotalRunSeconds: 360,
      walkRatio: 2,
      weeks: 4,
      daysPerWeek: 3,
    },
  },
  {
    id: 'continuous-30m',
    title: '30분 이어 달리기',
    subtitle: '10주 · 주 3회',
    description: '9주 프로그램보다 조금 더 여유 있게 30분까지 가요.',
    category: 'START',
    eligibility: { minLevel: 'L1_RUN_WALK' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 300,
      endRunSeconds: 1800,
      startTotalRunSeconds: 900,
      endTotalRunSeconds: 1800,
      walkRatio: 0.5,
      weeks: 10,
      daysPerWeek: 3,
    },
  },
  {
    id: 'five-k-improve',
    title: '5km 기록 다듬기',
    subtitle: '8주 · 주 3회',
    description: '5km를 편하게 달릴 수 있다면, 이제 조금 더 빠르게 가 봐요.',
    category: 'IMPROVE',
    eligibility: { minLevel: 'L4_5K',
      minLongestRunKm: 4 },
    releaseGate: 'ELIGIBILITY',
    recipe: {
      startRunSeconds: 600,
      endRunSeconds: 1800,
      startTotalRunSeconds: 1800,
      endTotalRunSeconds: 2400,
      walkRatio: 0.3,
      weeks: 8,
      daysPerWeek: 3,
    },
  },
  {
    id: 'steady-10k',
    title: '편하게 10km 만들기',
    subtitle: '8주 · 주 3회',
    description: '10km를 완주해 봤다면, 힘들지 않게 달리는 것이 목표예요.',
    category: 'FIVE_TEN_K',
    eligibility: { minLevel: 'L5_10K' },
    releaseGate: 'ELIGIBILITY',
    recipe: {
      startRunSeconds: 1800,
      endRunSeconds: 3600,
      startTotalRunSeconds: 2400,
      endTotalRunSeconds: 3600,
      walkRatio: 0.2,
      weeks: 8,
      daysPerWeek: 3,
    },
  },
  {
    id: 'run-further',
    title: '조금 더 멀리',
    subtitle: '8주 · 주 3회',
    description: '대회 목표 없이 한 번에 달리는 거리를 조금씩 늘려요.',
    category: 'BASE',
    eligibility: { minLevel: 'L4_5K' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 1200,
      endRunSeconds: 2400,
      startTotalRunSeconds: 1800,
      endTotalRunSeconds: 2700,
      walkRatio: 0.2,
      weeks: 8,
      daysPerWeek: 3,
    },
  },
  {
    id: 'maintain-three',
    title: '주 3번 체력 유지',
    subtitle: '8주 · 주 3회',
    description: '새로 늘리지 않고 지금 상태를 지켜요. 바쁜 기간에 좋아요.',
    category: 'BASE',
    eligibility: { minLevel: 'L3_RUN_30' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 1200,
      endRunSeconds: 1800,
      startTotalRunSeconds: 1500,
      endTotalRunSeconds: 1800,
      walkRatio: 0.2,
      weeks: 8,
      daysPerWeek: 3,
    },
  },
  {
    id: 'return-medium',
    title: '한두 달 쉬었다가 다시',
    subtitle: '6주 · 주 3회',
    description: '예전 수준부터 시작하지 않아요. 낮춰서 다시 올려요.',
    category: 'RETURN',
    eligibility: { minLevel: 'L1_RUN_WALK' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 180,
      endRunSeconds: 900,
      startTotalRunSeconds: 600,
      endTotalRunSeconds: 1200,
      walkRatio: 0.8,
      weeks: 6,
      daysPerWeek: 3,
    },
  },
  {
    id: 'post-race-reset',
    title: '대회 뒤 가볍게',
    subtitle: '2주 · 주 3회',
    description: '대회가 끝났으면 쉬는 것도 훈련이에요. 아주 가볍게 몸을 풀어요.',
    category: 'RECOVERY',
    eligibility: { minLevel: 'L2_RUN_10' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 300,
      endRunSeconds: 600,
      startTotalRunSeconds: 600,
      endTotalRunSeconds: 720,
      walkRatio: 1,
      weeks: 2,
      daysPerWeek: 3,
    },
  },
  {
    id: 'no-gps-time',
    title: '거리 없이 시간으로',
    subtitle: '6주 · 주 3회',
    description: 'GPS가 안 잡히는 곳에서도 괜찮아요. 시간만 보고 달려요.',
    category: 'INDOOR',
    eligibility: { minLevel: 'L1_RUN_WALK' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 300,
      endRunSeconds: 1500,
      startTotalRunSeconds: 900,
      endTotalRunSeconds: 1500,
      walkRatio: 0.4,
      weeks: 6,
      daysPerWeek: 3,
    },
  },
  {
    id: 'evening-light',
    title: '퇴근 뒤 가볍게',
    subtitle: '4주 · 주 3회',
    description: '하루가 끝난 뒤 짧게 달려요. 무리하지 않는 것이 목표예요.',
    category: 'LIFESTYLE',
    eligibility: { minLevel: 'L1_RUN_WALK' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 180,
      endRunSeconds: 900,
      startTotalRunSeconds: 600,
      endTotalRunSeconds: 900,
      walkRatio: 0.6,
      weeks: 4,
      daysPerWeek: 3,
    },
  },
  {
    id: 'travel-maintain',
    title: '출장 중에도 유지',
    subtitle: '4주 · 주 2회',
    description: '장비 없이 어디서든 할 수 있어요. 주 2번이면 충분해요.',
    category: 'LIFESTYLE',
    eligibility: { minLevel: 'L2_RUN_10' },
    releaseGate: 'NOW',
    recipe: {
      startRunSeconds: 300,
      endRunSeconds: 1200,
      startTotalRunSeconds: 600,
      endTotalRunSeconds: 1200,
      walkRatio: 0.5,
      weeks: 4,
      daysPerWeek: 2,
    },
  },
];

export type EligibilityResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * 이 사람이 이 계획을 시작해도 되는지 봅니다.
 * 막을 때는 반드시 쉬운 말로 이유를 돌려줍니다. "불가"만 알려 주지 않습니다.
 */
export function checkEligibility(
  family: ProgramFamily,
  level: UserLevelId,
  capability: RunnerCapability,
): EligibilityResult {
  if (family.releaseGate === 'EXPERT_REQUIRED') {
    return { allowed: false, reason: '전문가 검수를 마친 뒤에 열 계획이에요.' };
  }
  if (!isAtLeast(level, family.eligibility.minLevel)) {
    return {
      allowed: false,
      reason: '지금 단계에는 아직 부담이 커요. 한 단계 낮은 계획을 먼저 해요.',
    };
  }
  const { minLongestRunKm, minRecentWeeklyKm } = family.eligibility;
  if (minLongestRunKm !== undefined && (capability.longestRecentKm ?? 0) < minLongestRunKm) {
    return {
      allowed: false,
      reason: `최근에 ${minLongestRunKm}km 정도는 달려 본 뒤에 시작하는 게 안전해요.`,
    };
  }
  if (minRecentWeeklyKm !== undefined && (capability.recentWeeklyKm ?? 0) < minRecentWeeklyKm) {
    return {
      allowed: false,
      reason: `일주일에 ${minRecentWeeklyKm}km 정도 달리게 된 뒤에 시작해요.`,
    };
  }
  return { allowed: true };
}

/** 지금 시작할 수 있는 계획만 골라 줍니다. */
export function availableFamilies(
  level: UserLevelId,
  capability: RunnerCapability,
): ProgramFamily[] {
  return programFamilies.filter((family) => checkEligibility(family, level, capability).allowed);
}

/**
 * 가장 잘 맞는 계획 세 개를 고릅니다.
 * 100개를 한꺼번에 보여 주지 않기 위한 규칙입니다.
 * 지금 수준에 가장 가까운(=조건이 가장 높은) 계획부터 보여 줍니다.
 */
export function recommendFamilies(
  level: UserLevelId,
  capability: RunnerCapability,
  limit = 3,
): ProgramFamily[] {
  return availableFamilies(level, capability)
    .slice()
    .sort(
      (left, right) =>
        levelRank(right.eligibility.minLevel) - levelRank(left.eligibility.minLevel),
    )
    .slice(0, limit);
}

/** 계획 정의에서 실제 회차를 만들어 냅니다. start9처럼 정본이 있는 계획은 undefined입니다. */
export function buildPlan(family: ProgramFamily): RunProgram | undefined {
  if (!family.recipe) return undefined;
  return generatePlan({
    id: family.id,
    name: family.title,
    subtitle: family.subtitle,
    description: family.description,
    ...family.recipe,
  });
}

/** 목록 전체가 안전 규칙을 지키는지 확인합니다. 테스트와 CI가 이 함수를 씁니다. */
export function validateCatalog(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const family of programFamilies) {
    if (seen.has(family.id)) problems.push(`계획 ID가 겹칩니다: ${family.id}`);
    seen.add(family.id);
    const plan = buildPlan(family);
    if (!plan) continue;
    for (const problem of validatePlan(plan)) {
      problems.push(`${family.id}: ${problem}`);
    }
  }
  return problems;
}
