// 홈 화면이 쓰는 순수 규칙입니다. 화면은 이 파일이 만든 문장·묶음만 그립니다.
//
// 원칙
// 1) 홈 맨 위에는 "오늘 뭘 하면 되는지"가 한 문장으로 나옵니다(todayHeadline).
// 2) 숫자를 놓을 때는 반드시 비교나 의미를 붙입니다(weekInsight, recentActivityCards의 note).
// 3) 기록이 적을 때는 없는 비교를 지어내지 않습니다(homeStage로 판정).
// 4) 여기서는 화면을 만들지 않으므로 테스트로 상황별 문구를 그대로 확인할 수 있습니다.
import { averagePaceForActivities, activityPaceSecondsPerKm } from '../../../domains/activities/pace';
import type { RunPlan } from '../../../domains/activities/plans';
import {
  addDaysKey,
  currentWeekStart,
  formatDistance,
  formatDuration,
  kstDayKey,
  totalsForKeys,
} from '../../../domains/activities/summary';
import { suggestTodayRun } from '../../../domains/activities/trend';
import { activityCountsAsMovement, type ActivityRecord } from '../../../domains/activities/types';
import {
  currentWeekProgress,
  goalMetricUnits,
  goalValue,
  type WeeklyGoal,
} from '../../../domains/badges/goals';
import { goalRaceCountdown } from '../../../domains/races/goalRace';

const MILLIS_PER_DAY = 86_400_000;

/** 일요일부터 시작하는 요일 이름입니다. Intl 로케일에 기대지 않고 직접 계산합니다. */
const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'] as const;

const kindLabels: Record<ActivityRecord['kind'], string> = {
  run: '러닝',
  walk: '걷기',
  recovery: '회복',
};

function dayDiff(fromDayKey: string, toDayKey: string): number {
  const from = Date.parse(`${fromDayKey}T00:00:00Z`);
  const to = Date.parse(`${toDayKey}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / MILLIS_PER_DAY);
}

export function weekdayLabel(dayKey: string): string {
  const parsed = Date.parse(`${dayKey}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return '';
  return weekdayNames[new Date(parsed).getUTCDay()] ?? '';
}

/** '7월 26일 일요일'처럼 오늘을 한국 날짜로 적습니다. */
export function todayLabel(now: number = Date.now()): string {
  const dayKey = kstDayKey(new Date(now));
  if (!dayKey) return '';
  return `${Number(dayKey.slice(5, 7))}월 ${Number(dayKey.slice(8, 10))}일 ${weekdayLabel(dayKey)}요일`;
}

/** 홈 상단에 붙는 인사입니다. 닉네임이 비어 있으면 기본값을 씁니다. */
export function greetingLine(nickname: string, now: number = Date.now()): string {
  const name = nickname.trim() || '러너';
  return `${todayLabel(now)} · ${name}님`;
}

// ── 1) 기록량 3단계 판정 ────────────────────────────────────────────────────
// 홈이 부실해 보이는 가장 큰 이유는 기록이 없을 때 숫자 카드가 텅 비기 때문입니다.
// 그래서 "무엇을 보여 줄지"를 기록 수로 먼저 나눕니다.

/** 지난주 비교·평균 페이스처럼 "쌓여야 뜻이 생기는" 값을 열어 주는 기준입니다. */
export const FULL_HOME_MIN_ACTIVITIES = 5;

export type HomeStage =
  /** 기록 0건. 숫자 카드를 아예 띄우지 않고 첫 러닝 권유로 재구성합니다. */
  | 'new'
  /** 기록 1~4건. 비교할 대상이 없으므로 "지난주 대비" 문구를 만들지 않습니다. */
  | 'early'
  /** 기록 5건 이상. 전체 카드를 노출합니다. */
  | 'steady';

export function homeStage(activities: ActivityRecord[]): HomeStage {
  if (activities.length === 0) return 'new';
  if (activities.length < FULL_HOME_MIN_ACTIVITIES) return 'early';
  return 'steady';
}

/** 전체 카드가 열리기까지 남은 기록 수입니다. 'steady'면 0입니다. */
export function activitiesUntilFullHome(activities: ActivityRecord[]): number {
  return Math.max(0, FULL_HOME_MIN_ACTIVITIES - activities.length);
}

// ── 2) 이번 주 진행과 해석 ──────────────────────────────────────────────────

function formatGoalAmount(goal: WeeklyGoal, value: number): string {
  const unit = goalMetricUnits[goal.metric];
  const rounded = goal.metric === 'distance' ? Math.round(value * 10) / 10 : Math.round(value);
  return `${rounded}${unit}`;
}

/** 이번 주 시작일부터 오늘까지 며칠이 지났는지입니다(월요일이면 1). */
function daysElapsedThisWeek(now: number): number {
  const today = kstDayKey(new Date(now));
  if (!today) return 1;
  return Math.min(7, Math.max(1, dayDiff(currentWeekStart(now), today) + 1));
}

function totalsForFirstDays(activities: ActivityRecord[], weekStart: string, days: number) {
  const end = addDaysKey(weekStart, Math.max(0, days - 1));
  return totalsForKeys(activities, (day) => day >= weekStart && day <= end);
}

export type WeekInsight = {
  /** '2회 / 3회'처럼 목표 대비 값입니다. 항상 meaning과 함께 그립니다. */
  valueLabel: string;
  ratio: number;
  met: boolean;
  /** 숫자 옆에 반드시 붙는 해석 한 줄입니다. */
  meaning: string;
  /** 지난주 같은 요일까지와 비교했는지 여부입니다. */
  compared: boolean;
};

/**
 * 이번 주 목표 진행에 "그래서 어떤 상태인지"를 붙입니다.
 * 비교는 지난주 전체가 아니라 "지난주 같은 요일까지"와만 합니다(부분 주를 전체 주와 견주지 않습니다).
 */
export function weekInsight(
  activities: ActivityRecord[],
  goal: WeeklyGoal,
  now: number = Date.now(),
): WeekInsight {
  const progress = currentWeekProgress(activities, goal, now);
  const base = {
    valueLabel: progress.label,
    ratio: progress.ratio,
    met: progress.met,
  };

  if (progress.met) {
    return {
      ...base,
      meaning: '이번 주 목표를 채웠어요. 남은 날은 몸 상태에 맞춰 정해도 돼요.',
      compared: false,
    };
  }

  const stage = homeStage(activities);
  if (stage === 'early') {
    const left = activitiesUntilFullHome(activities);
    return {
      ...base,
      meaning: `${left}번 더 기록하면 지난주와 비교해서 알려드릴 수 있어요.`,
      compared: false,
    };
  }

  const elapsed = daysElapsedThisWeek(now);
  const lastWeek = totalsForFirstDays(activities, addDaysKey(currentWeekStart(now), -7), elapsed);
  if (stage === 'steady' && lastWeek.sessions > 0) {
    const diff = progress.value - goalValue(goal.metric, lastWeek);
    const rounded = goal.metric === 'distance' ? Math.round(diff * 10) / 10 : Math.round(diff);
    if (rounded === 0) {
      return {
        ...base,
        meaning: `지난주 이맘때와 같아요. ${progress.remainingLabel}`,
        compared: true,
      };
    }
    const gap = formatGoalAmount(goal, Math.abs(diff));
    return {
      ...base,
      meaning:
        rounded > 0
          ? `지난주 이맘때보다 ${gap} 많아요. ${progress.remainingLabel}`
          : `지난주 이맘때보다 ${gap} 적어요. ${progress.remainingLabel}`,
      compared: true,
    };
  }

  return { ...base, meaning: progress.remainingLabel, compared: false };
}

// ── 3) 요일 7칸(연속 기록) ──────────────────────────────────────────────────

export type HomeDayMark = {
  key: string;
  /** '월'처럼 한 글자 요일입니다. */
  label: string;
  moved: boolean;
  isToday: boolean;
  isFuture: boolean;
};

/** 이번 주 월요일부터 일요일까지 7칸입니다. 움직인 날만 표시합니다. */
export function weekDayMarks(activities: ActivityRecord[], now: number = Date.now()): HomeDayMark[] {
  const today = kstDayKey(new Date(now));
  const weekStart = currentWeekStart(now);
  const movedDays = new Set(
    activities
      .filter(activityCountsAsMovement)
      .map((activity) => kstDayKey(activity.completedAt))
      .filter(Boolean),
  );
  return Array.from({ length: 7 }, (_, index) => {
    const key = addDaysKey(weekStart, index);
    return {
      key,
      label: weekdayLabel(key),
      moved: movedDays.has(key),
      isToday: key === today,
      isFuture: key > today,
    };
  });
}

/** 요일 7칸 아래에 붙는 한 줄입니다. 이어서 움직인 날은 '연속 기록'이라고만 부릅니다. */
export function weekMovementCaption(marks: HomeDayMark[], streakDays: number): string {
  const moved = marks.filter((mark) => mark.moved).length;
  if (streakDays >= 2) return `연속 기록 ${streakDays}일째예요. 오늘도 이어 볼까요?`;
  if (moved === 0) return '이번 주는 아직 쉬는 중이에요. 오늘이 첫 날이 될 수 있어요.';
  return `이번 주 ${moved}일 움직였어요.`;
}

// ── 4) 오늘 한 문장 ────────────────────────────────────────────────────────

export type TodayHeadlineTone =
  | 'first'
  | 'done'
  | 'race'
  | 'planned'
  | 'comeback'
  | 'goalMet'
  | 'almost'
  | 'rest'
  | 'easy'
  | 'tomorrow'
  | 'early'
  | 'blankWeek'
  | 'steady';

export type TodayHeadline = {
  tone: TodayHeadlineTone;
  /** 홈 맨 위에 가장 크게 놓는 한 문장입니다. */
  text: string;
};

export type TodayHeadlineInput = {
  activities: ActivityRecord[];
  weeklyGoal: WeeklyGoal;
  plans: RunPlan[];
  /** 설정에 저장된 기본 러닝 시간입니다. 추천 시간의 출발값으로만 씁니다. */
  coachMinutes: number;
  goalRace?: { name: string; raceDate: string };
  now?: number;
};

/**
 * 실제 상태(주간 목표, 계획, 마지막 기록, 목표 대회)를 읽어 상황별로 다른 한 문장을 만듭니다.
 * 위에서부터 먼저 맞는 규칙이 이깁니다. 숫자만 나열하지 않고 항상 "그래서 오늘 뭘 하면 되는지"로 끝냅니다.
 */
export function todayHeadline(input: TodayHeadlineInput): TodayHeadline {
  const now = input.now ?? Date.now();
  const today = kstDayKey(new Date(now));
  const { activities, plans, weeklyGoal } = input;
  const suggestion = suggestTodayRun(activities, input.coachMinutes, now);
  const minutes = suggestion.minutes;
  const stage = homeStage(activities);
  const todayPlan = plans.find((plan) => plan.date === today);
  const tomorrowPlan = plans.find((plan) => plan.date === addDaysKey(today, 1));

  // 1. 기록이 하나도 없을 때는 숫자를 말하지 않고 첫 러닝만 권합니다.
  if (stage === 'new') {
    if (todayPlan) {
      return {
        tone: 'first',
        text: `오늘 첫 러닝이 잡혀 있어요. ${minutes}분만 해도 충분한 시작이에요.`,
      };
    }
    return {
      tone: 'first',
      text: `아직 기록이 없어요. 오늘 ${minutes}분만 편하게 달리면 첫 기록이 남아요.`,
    };
  }

  // 2. 오늘 이미 움직였다면 그 사실이 가장 정확한 상태입니다.
  const todayRecords = activities.filter((activity) => kstDayKey(activity.completedAt) === today);
  if (todayRecords.length > 0) {
    const distanceKm = todayRecords.reduce((total, item) => total + (item.distanceKm ?? 0), 0);
    const totalMinutes = todayRecords.reduce((total, item) => total + item.durationMinutes, 0);
    const amount = distanceKm > 0 ? formatDistance(distanceKm) : formatDuration(totalMinutes);
    return { tone: 'done', text: `오늘 ${amount} 움직였어요. 오늘 몫은 다 했어요.` };
  }

  // 3. 목표 대회가 코앞이면 그 주의 방향이 바뀝니다.
  if (input.goalRace) {
    const countdown = goalRaceCountdown(input.goalRace.raceDate, now);
    if (countdown.days === 0) {
      return {
        tone: 'race',
        text: `오늘이 ${input.goalRace.name} 날이에요. 무리하지 말고 즐기고 오세요.`,
      };
    }
    if (countdown.days > 0 && countdown.days <= 7) {
      return {
        tone: 'race',
        text: `${input.goalRace.name}까지 ${countdown.days}일 남았어요. 이번 주는 짧고 가볍게만 달려요.`,
      };
    }
  }

  // 4. 오늘 하기로 적어 둔 운동이 있으면 그대로 안내합니다.
  if (todayPlan) {
    return { tone: 'planned', text: `오늘은 ${todayPlan.title} 예정이에요. 준비되면 바로 시작해요.` };
  }

  // 5. 오래 쉬었다면 목표보다 "다시 시작"이 먼저입니다.
  const lastDay = activities
    .map((activity) => kstDayKey(activity.completedAt))
    .filter(Boolean)
    .sort()
    .at(-1);
  if (lastDay) {
    const restedDays = dayDiff(lastDay, today);
    if (restedDays >= 14) {
      return {
        tone: 'comeback',
        text: `${restedDays}일 쉬었어요. 오늘 ${minutes}분만 걸어도 다시 시작이에요.`,
      };
    }
  }

  const progress = currentWeekProgress(activities, weeklyGoal, now);

  // 6. 이번 주 목표를 이미 채웠을 때
  if (progress.met) {
    return {
      tone: 'goalMet',
      text: '이번 주 목표를 채웠어요. 오늘은 몸이 편한 만큼만 달려도 좋아요.',
    };
  }

  // 7. 목표가 코앞일 때는 남은 양을 구체적으로 말해 줍니다.
  const remaining = Math.max(0, weeklyGoal.target - progress.value);
  if (weeklyGoal.metric === 'sessions' && Math.round(remaining) === 1) {
    return {
      tone: 'almost',
      text: `이번 주 ${Math.round(progress.value)}번 뛰었어요. 한 번만 더 하면 목표 달성이에요.`,
    };
  }
  if (remaining > 0 && remaining <= weeklyGoal.target / 4) {
    return {
      tone: 'almost',
      text: `이번 주 ${formatGoalAmount(weeklyGoal, progress.value)} 채웠어요. ${formatGoalAmount(weeklyGoal, remaining)}만 더 하면 목표 달성이에요.`,
    };
  }

  // 8. 최근 7일을 많이 움직였다면 쉬는 것도 계획입니다.
  const activeDays = new Set(
    activities
      .filter(activityCountsAsMovement)
      .map((activity) => kstDayKey(activity.completedAt))
      .filter((day) => Boolean(day) && day >= addDaysKey(today, -6) && day <= today),
  ).size;
  if (activeDays >= 5) {
    return {
      tone: 'rest',
      text: `최근 7일 중 ${activeDays}일 움직였어요. 오늘은 쉬는 게 더 도움이 돼요.`,
    };
  }

  // 9. 어제 달렸다면 오늘은 짧게
  if (lastDay && dayDiff(lastDay, today) === 1) {
    return { tone: 'easy', text: `어제 달렸어요. 오늘은 ${minutes}분 편한 러닝이면 충분해요.` };
  }

  // 10. 오늘은 비었지만 내일 계획이 있을 때
  if (tomorrowPlan) {
    return { tone: 'tomorrow', text: `오늘은 쉬는 날이에요. 내일은 ${tomorrowPlan.title} 예정이에요.` };
  }

  // 11. 기록이 아직 적을 때는 비교 대신 "얼마나 더 모으면 되는지"를 말합니다.
  if (stage === 'early') {
    return {
      tone: 'early',
      text: `지금까지 ${activities.length}번 기록했어요. 오늘 ${minutes}분 달리면 리듬이 잡히기 시작해요.`,
    };
  }

  // 12. 이번 주 첫 기록이 아직 없을 때
  if (progress.value <= 0) {
    return {
      tone: 'blankWeek',
      text: `이번 주는 아직 첫 기록이 없어요. 오늘 ${minutes}분이면 시작하기 좋아요.`,
    };
  }

  // 13. 그 밖의 평소 상태
  return {
    tone: 'steady',
    text: `이번 주 ${formatGoalAmount(weeklyGoal, progress.value)} 채웠어요. 오늘 ${minutes}분 달리면 목표에 더 가까워져요.`,
  };
}

/** 오늘 계획이 있으면 시작 버튼에 그 이름을 넣습니다. */
export function startActionLabel(todayPlan?: RunPlan): string {
  if (!todayPlan) return '달리기 시작';
  return `오늘의 운동: ${todayPlan.title} 시작`;
}

/** 오늘 날짜에 잡힌 계획 1건입니다. */
export function planForToday(plans: RunPlan[], now: number = Date.now()): RunPlan | undefined {
  const today = kstDayKey(new Date(now));
  return plans.find((plan) => plan.date === today);
}

// ── 5) 다가오는 것 ─────────────────────────────────────────────────────────

/** 'D-12' · '내일' · '오늘'처럼 남은 날을 짧게 적습니다. */
export function dayCountLabel(dayKey: string, now: number = Date.now()): string {
  const today = kstDayKey(new Date(now));
  if (!today || !dayKey) return '';
  const diff = dayDiff(today, dayKey);
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff < 0) return `D+${Math.abs(diff)}`;
  return `D-${diff}`;
}

/** 접수 마감이 2주 안으로 다가온 대회에만 붙이는 꼬리표입니다. 아니면 undefined입니다. */
export function registrationDeadlineLabel(
  closesAt: string | undefined,
  now: number = Date.now(),
): string | undefined {
  if (!closesAt) return undefined;
  const closes = Date.parse(closesAt);
  if (!Number.isFinite(closes)) return undefined;
  // 시각 차이가 아니라 한국 날짜 차이로 셉니다(오늘 밤 마감을 '1일 전'이라고 부르지 않도록).
  const closesDay = kstDayKey(new Date(closes));
  const today = kstDayKey(new Date(now));
  if (!closesDay || !today) return undefined;
  const days = dayDiff(today, closesDay);
  if (days < 0) return undefined;
  if (days === 0) return '오늘 접수 마감';
  if (days <= 14) return `접수 마감 ${days}일 전`;
  return undefined;
}

// ── 6) 최근 기록 ───────────────────────────────────────────────────────────

export type HomeRecentActivity = {
  id: string;
  /** '러닝 32분 · 5.2km' */
  title: string;
  /** '7월 24일 · 6\'09" 페이스' */
  meta: string;
  /** 숫자만 두지 않기 위한 그때의 한 줄 평입니다. */
  note: string;
};

/** 같은 기록을 다시 봐도 뜻이 생기도록 붙이는 한 줄 평입니다. */
export function recentActivityNote(
  activity: ActivityRecord,
  activities: ActivityRecord[],
): string {
  if (activity.kind === 'recovery') return '몸을 풀며 회복에 쓴 날이에요.';
  if (activity.kind === 'walk') return '걸으면서 리듬을 이어 간 날이에요.';

  const distanceKm = activity.distanceKm ?? 0;
  const longest = Math.max(0, ...activities.map((item) => item.distanceKm ?? 0));
  if (distanceKm > 0 && distanceKm >= longest) return '지금까지 가장 멀리 달린 날이에요.';

  const pace = activityPaceSecondsPerKm(activity);
  const average = averagePaceForActivities(activities);
  if (pace !== undefined && average !== undefined) {
    if (pace <= average - 10) return '평소보다 빠르게 달린 날이에요.';
    if (pace >= average + 10) return '평소보다 여유 있게 달린 날이에요.';
    return '평소 리듬 그대로 달린 날이에요.';
  }
  if (activity.durationMinutes >= 60) return '한 시간을 채운 긴 러닝이었어요.';
  return '짧아도 기록으로 남긴 하루예요.';
}

function activityDateLabel(dayKey: string): string {
  if (!dayKey) return '';
  return `${Number(dayKey.slice(5, 7))}월 ${Number(dayKey.slice(8, 10))}일`;
}

/** 홈에 보여 줄 최근 기록 1~2건입니다. 거리·시간·페이스와 한 줄 평을 함께 만듭니다. */
export function recentActivityCards(
  activities: ActivityRecord[],
  limit = 2,
): HomeRecentActivity[] {
  return activities.slice(0, Math.max(0, limit)).map((activity) => {
    const distanceKm = activity.distanceKm ?? 0;
    const paceSeconds = activityPaceSecondsPerKm(activity);
    const paceLabel =
      paceSeconds === undefined
        ? undefined
        : `${Math.floor(Math.round(paceSeconds) / 60)}'${String(Math.round(paceSeconds) % 60).padStart(2, '0')}" 페이스`;
    const meta = [activityDateLabel(kstDayKey(activity.completedAt)), paceLabel]
      .filter(Boolean)
      .join(' · ');
    return {
      id: activity.id,
      title: `${kindLabels[activity.kind]} ${formatDuration(activity.durationMinutes)}${
        distanceKm > 0 ? ` · ${formatDistance(distanceKm)}` : ''
      }`,
      meta,
      note: recentActivityNote(activity, activities),
    };
  });
}

// ── 7) 발견 ────────────────────────────────────────────────────────────────

/** 날짜에서 만든 안정적인 정수입니다. 같은 날에는 같은 추천이 나옵니다. */
function dayHash(dayKey: string): number {
  let hash = 7;
  for (let index = 0; index < dayKey.length; index += 1) {
    hash = (hash * 31 + dayKey.charCodeAt(index)) % 100_003;
  }
  return hash;
}

/** 목록에서 오늘의 한 개를 고릅니다. 무작위가 아니라 날짜로 정해져 매번 같습니다. */
export function pickForToday<T>(values: readonly T[], now: number = Date.now()): T | undefined {
  if (values.length === 0) return undefined;
  const dayKey = kstDayKey(new Date(now));
  return values[dayHash(dayKey) % values.length];
}

/**
 * 홈은 러닝화 목록·Q&A처럼 다른 화면의 문구를 그대로 가져와 보여 줍니다.
 * 그중 초등학생이 읽기 어려운 낱말이 섞인 항목은 홈의 '발견' 자리에서 거릅니다.
 * (해당 낱말을 없애는 게 아니라, 홈에서는 더 쉬운 항목을 먼저 고른다는 뜻입니다.)
 */
const hardWords = ['스트릭', 'RPE', '인터벌', '파틀렉', '세션', '액티비티', '템포'] as const;

export function isPlainKorean(text: string): boolean {
  return hardWords.every((word) => !text.includes(word));
}
