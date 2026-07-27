// 사용자가 직접 만드는 도전의 입력 검사입니다. 화면은 이 결과의 message만 그대로 보여 줍니다.
import { kstDayKey } from '../activities/summary';
import { daysBetween } from './catalog';
import {
  challengeMetricUnits,
  challengeTargetLimits,
  formatChallengeValue,
  isDayKey,
  type Challenge,
  type ChallengeMetric,
} from './types';

/** 한 번에 만들 수 있는 가장 긴 기간입니다. */
export const MAX_CUSTOM_DAYS = 366;
export const MAX_CUSTOM_TITLE = 24;

export type CustomChallengeInput = {
  title: string;
  startDay: string;
  endDay: string;
  metric: ChallengeMetric;
  targetText: string;
};

export type CustomChallengeResult =
  | { ok: true; value: Challenge }
  | { ok: false; message: string };

/** 기간 종류를 고르면 날짜를 대신 채워 줍니다. */
export function defaultCustomInput(now: number = Date.now()): CustomChallengeInput {
  const today = kstDayKey(new Date(now));
  const endDay = new Date(Date.parse(`${today}T00:00:00Z`) + 29 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return { title: '', startDay: today, endDay, metric: 'distance', targetText: '' };
}

export function parseCustomChallenge(
  input: CustomChallengeInput,
  now: number = Date.now(),
): CustomChallengeResult {
  const title = input.title.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (title.length === 0) return { ok: false, message: '도전 이름을 적어 주세요.' };
  if (title.length > MAX_CUSTOM_TITLE) {
    return { ok: false, message: `도전 이름은 ${MAX_CUSTOM_TITLE}자까지 적을 수 있어요.` };
  }
  if (!isDayKey(input.startDay) || !isDayKey(input.endDay)) {
    return { ok: false, message: '날짜는 2026-08-01처럼 적어 주세요.' };
  }
  if (input.endDay < input.startDay) {
    return { ok: false, message: '끝나는 날이 시작하는 날보다 빨라요.' };
  }
  const days = daysBetween(input.startDay, input.endDay) + 1;
  if (days > MAX_CUSTOM_DAYS) {
    return { ok: false, message: '기간은 최대 1년까지 정할 수 있어요.' };
  }

  const target = Number(input.targetText.trim());
  if (!Number.isFinite(target) || target <= 0) {
    return { ok: false, message: '목표 값을 숫자로 적어 주세요.' };
  }
  const limit = challengeTargetLimits[input.metric];
  if (target > limit) {
    return {
      ok: false,
      message: `목표는 ${limit}${challengeMetricUnits[input.metric]}까지 정할 수 있어요.`,
    };
  }
  if (input.metric === 'activeDays' && target > days) {
    return { ok: false, message: `기간이 ${days}일이라 그보다 많은 날을 채울 수는 없어요.` };
  }
  const rounded = input.metric === 'distance' ? Math.round(target * 10) / 10 : Math.round(target);
  if (rounded <= 0) return { ok: false, message: '목표 값을 숫자로 적어 주세요.' };

  return {
    ok: true,
    value: {
      id: `custom:${now}`,
      title,
      summary: `${days}일 동안 ${formatChallengeValue(input.metric, rounded)}`,
      startDay: input.startDay,
      endDay: input.endDay,
      goal: { metric: input.metric, target: rounded },
      origin: 'custom',
    },
  };
}
