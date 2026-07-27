// 오늘 뭘 하면 좋을지 하나만 골라 줍니다.
//
// 왜 하나인가:
//   계획 40개, 훈련 103개, 도전 40개가 있습니다. 고를 것이 많다는 건 좋은 일이지만,
//   나가기 직전에 고민이 길어지면 그냥 안 나갑니다. 그래서 오늘은 하나만 보여 줍니다.
//
// 이 층이 절대 하지 않는 일:
//   **훈련량을 늘리라고 밀어붙이지 않습니다.**
//   최근에 많이 했으면 쉬라고 말합니다. 이틀 연속 뛰었으면 걷기를 권합니다.
//   "오늘도 뛰세요"만 반복하는 제안은 사람을 다치게 하고, 결국 그만두게 만듭니다.
//
// 계산은 전부 순수 함수입니다. 같은 입력이면 언제나 같은 결과가 나옵니다.
import type { ActivityRecord } from '../activities/types';
import { adjustReasons, type SuggestionAdjust } from '../activities/retrospect';

export type SuggestionKind =
  /** 하고 있는 계획의 다음 회차 */
  | 'planSession'
  /** 오늘 한 번만 하는 훈련 */
  | 'workout'
  /** 걷기 */
  | 'walk'
  /** 오늘은 쉬기 */
  | 'rest';

export type TodaySuggestion = {
  kind: SuggestionKind;
  /** 화면에 크게 쓰는 말입니다. */
  title: string;
  /** 왜 이걸 권하는지입니다. 근거 없는 제안은 신뢰를 잃습니다. */
  reason: string;
  /** kind가 workout이면 어떤 훈련인지입니다. */
  workoutId?: string;
};

export type TodayInput = {
  activities: ActivityRecord[];
  now: Date;
  /** 하고 있는 계획에 아직 남은 회차가 있는지입니다. */
  hasPlanSessionLeft: boolean;
  /**
   * 최근 회고에서 나온 조정입니다(`domains/activities/retrospect.ts`).
   *
   * 이 값이 실제로 제안을 바꿉니다. 안 그러면 회고는 그냥 설문이 됩니다.
   * 없으면 예전과 똑같이 동작합니다.
   */
  adjust?: SuggestionAdjust;
};

function dayKey(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * 최근에 며칠 연속으로 뛰었는지입니다.
 *
 * 오늘 아직 안 뛰었으면 **어제부터** 셉니다.
 * 오늘을 기준으로만 세면, 어제·그제 이틀 연속 뛰고 오늘 아침에 물어봤을 때 0이 나옵니다.
 * 그러면 "이틀 연속 뛰었으니 오늘은 걸어요"라는 판단 자체를 할 수 없습니다.
 */
export function consecutiveRunDays(activities: ActivityRecord[], now: Date): number {
  const runDays = new Set(
    activities
      .filter((record) => record.kind === 'run')
      .map((record) => dayKey(record.completedAt))
      .filter(Boolean),
  );
  const cursor = new Date(now);
  // 오늘 뛴 기록이 없으면 어제부터 셉니다.
  if (!runDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  for (let step = 0; step < 14; step += 1) {
    if (!runDays.has(dayKey(cursor))) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** 최근 며칠 동안 움직인 날의 수입니다. */
export function activeDaysWithin(
  activities: ActivityRecord[],
  now: Date,
  days: number,
): number {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (days - 1));
  const keys = new Set(
    activities
      .filter((record) => {
        const at = new Date(record.completedAt);
        return !Number.isNaN(at.getTime()) && at >= from && at <= now;
      })
      .map((record) => dayKey(record.completedAt))
      .filter(Boolean),
  );
  return keys.size;
}

/** 오늘 이미 움직였는지입니다. */
export function movedToday(activities: ActivityRecord[], now: Date): boolean {
  const today = dayKey(now);
  return activities.some((record) => dayKey(record.completedAt) === today);
}

/**
 * 오늘의 제안 하나입니다.
 *
 * 판단 순서가 곧 안전 규칙입니다. 위에 있는 조건일수록 먼저 지켜집니다.
 *   1) 오늘 이미 했으면 더 하라고 하지 않는다
 *   2) 사흘 연속 뛰었으면 쉬라고 한다
 *   3) 이틀 연속 뛰었으면 걷기를 권한다
 *   4) 이번 주에 많이 했으면 가볍게 간다
 *   5) 그 밖에는 계획의 다음 회차, 계획이 없으면 알맞은 훈련
 */
export function suggestToday(input: TodayInput): TodaySuggestion {
  const { activities, now, hasPlanSessionLeft, adjust } = input;

  if (movedToday(activities, now)) {
    return {
      kind: 'rest',
      title: '오늘은 이미 했어요',
      reason: '오늘 몫은 끝났어요. 더 하지 않아도 괜찮아요.',
    };
  }

  // 회고에서 아픈 신호가 이어졌으면 다른 무엇보다 먼저 쉬라고 말합니다.
  // 참고 뛰면 오래 못 뜁니다. 이 판단이 연속 일수보다 위에 있어야 하는 이유입니다.
  if (adjust === 'rest') {
    return {
      kind: 'rest',
      title: '오늘은 쉬어요',
      reason: adjustReasons.rest,
    };
  }

  const streak = consecutiveRunDays(activities, now);
  if (streak >= 3) {
    return {
      kind: 'rest',
      title: '오늘은 쉬어요',
      reason: `${streak}일 연속으로 뛰었어요. 쉬는 것도 훈련이에요. 회복은 자는 동안 일어나요.`,
    };
  }
  if (streak === 2) {
    return {
      kind: 'walk',
      title: '오늘은 걷기로',
      reason: '이틀 연속 뛰었어요. 오늘은 걸으면 내일이 훨씬 편해요.',
      workoutId: 'walk-30m',
    };
  }

  const recentDays = activeDaysWithin(activities, now, 7);
  if (recentDays >= 5) {
    return {
      kind: 'workout',
      title: '가볍게 20분',
      reason: `최근 7일 중 ${recentDays}일 움직였어요. 오늘은 늘리지 말고 가볍게 가요.`,
      workoutId: 'recovery-20m',
    };
  }

  // 힘들었다는 회고가 이어지면 계획 회차 대신 가벼운 것을 권합니다.
  // 계획을 계속 밀어붙이면 계획을 그만두게 됩니다.
  if (adjust === 'easier') {
    return {
      kind: 'workout',
      title: '오늘은 가볍게',
      reason: adjustReasons.easier,
      workoutId: 'recovery-20m',
    };
  }

  if (hasPlanSessionLeft) {
    return {
      kind: 'planSession',
      title: '오늘의 회차',
      reason:
        adjust === 'ready'
          ? adjustReasons.ready
          : '하고 있는 계획의 다음 회차예요. 순서대로만 따라가면 돼요.',
    };
  }

  if (activities.length === 0) {
    return {
      kind: 'walk',
      title: '20분 걷기부터',
      reason: '첫 기록을 남기는 것이 가장 어려워요. 걷기 한 번이면 충분해요.',
      workoutId: 'walk-20m',
    };
  }

  if (recentDays === 0) {
    return {
      kind: 'walk',
      title: '가볍게 다시 시작',
      reason: '최근 일주일은 쉬었네요. 오늘은 걷기로 몸을 깨워요.',
      workoutId: 'walk-30m',
    };
  }

  return {
    kind: 'workout',
    title: '편하게 30분',
    reason: '오늘은 특별히 챙길 게 없어요. 편한 속도로 30분이면 좋아요.',
    workoutId: 'easy-30m',
  };
}
