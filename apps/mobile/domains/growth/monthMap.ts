// 이번 달 지도입니다. 러닝라이프의 "알이 부화하는" 게임화를 대신합니다.
//
// 회장 지시: **"게임화는 하되 알(egg)은 따라 하지 마라."**
//
// 왜 알을 안 쓰는가:
//   알은 **깨지면 끝**입니다. 그래서 알을 쓰는 앱은 필연적으로 "연속으로 하지 않으면
//   잃는다"는 장치가 붙습니다. 그 장치는 아픈 날에도 뛰게 만듭니다.
//   러너를 다치게 하는 게임화는 성장이 아니라 이탈로 갑니다.
//
// 그래서 지도를 씁니다. **지도는 쉰다고 사라지지 않습니다.**
//   간 만큼 남고, 안 간 만큼 그대로입니다. 이번 달이 끝나면 그 달의 지도가 기록으로 남습니다.
//
// 이 파일은 순수합니다.
import type { ActivityRecord } from '../activities/types';

/** 지도의 다섯 구간입니다. 이번 달 움직인 시간이 어디까지 갔는지 나타냅니다. */
export type TerrainId = 'start' | 'park' | 'river' | 'hill' | 'ridge';

export type Terrain = {
  id: TerrainId;
  label: string;
  /** 여기까지 오는 데 필요한 이번 달 누적 분입니다. */
  minutes: number;
  /** 도착했을 때 보여 줄 한 줄입니다. */
  arrival: string;
};

/**
 * 왜 이 숫자인가:
 *   주 3회 × 30분이면 한 달에 약 360분입니다. 그게 '언덕'입니다.
 *   맨 끝(능선)은 그보다 조금 더 — 닿을 수 있지만 애써야 하는 곳입니다.
 *   **끝까지 못 가도 실패가 아닙니다.** 그래서 마지막 칸에도 '못 갔다'는 말을 쓰지 않습니다.
 */
export const terrains: Terrain[] = [
  { id: 'start', label: '출발점', minutes: 0, arrival: '여기서 시작해요' },
  { id: 'park', label: '동네 공원', minutes: 60, arrival: '이번 달 한 시간을 넘겼어요' },
  { id: 'river', label: '강변길', minutes: 150, arrival: '꾸준함이 눈에 보이기 시작했어요' },
  { id: 'hill', label: '언덕', minutes: 360, arrival: '주 3회를 한 달 내내 지킨 셈이에요' },
  { id: 'ridge', label: '능선', minutes: 600, arrival: '올해 기억에 남을 달이에요' },
];

export type MonthMap = {
  /** 이번 달 누적 분입니다. */
  minutes: number;
  /** 지금 서 있는 구간입니다. */
  current: Terrain;
  /** 다음 구간입니다. 마지막에 서 있으면 없습니다. */
  next?: Terrain;
  /** 다음 구간까지 남은 분입니다. */
  remainingMinutes: number;
  /** 다음 구간까지의 진행률 0~1. 마지막이면 1입니다. */
  ratio: number;
  /** 화면에 크게 쓰는 말입니다. */
  headline: string;
  /** 그 아래 한 줄입니다. */
  note: string;
  /** 이번 달 움직인 날 수입니다. */
  activeDays: number;
};

function monthKey(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth() + 1}`;
}

function dayKey(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** 이번 달 지도입니다. */
export function monthMap(activities: ActivityRecord[], now: Date): MonthMap {
  const key = monthKey(now);
  const thisMonth = activities.filter((record) => monthKey(record.completedAt) === key);

  const minutes = thisMonth.reduce((sum, record) => sum + Math.max(0, record.durationMinutes), 0);
  const activeDays = new Set(thisMonth.map((record) => dayKey(record.completedAt)).filter(Boolean))
    .size;

  // 넘어선 구간 중 가장 뒤에 있는 것이 지금 자리입니다.
  let current = terrains[0] as Terrain;
  for (const terrain of terrains) {
    if (minutes >= terrain.minutes) current = terrain;
  }
  const currentIndex = terrains.indexOf(current);
  const next = terrains[currentIndex + 1];

  const remainingMinutes = next ? Math.max(0, next.minutes - minutes) : 0;
  const span = next ? next.minutes - current.minutes : 0;
  const ratio = next && span > 0 ? Math.min(1, (minutes - current.minutes) / span) : 1;

  return {
    minutes,
    current,
    ...(next ? { next } : {}),
    remainingMinutes,
    ratio,
    headline: current.label,
    note: next
      ? `${next.label}까지 ${remainingMinutes}분 남았어요`
      : '이번 달 지도를 끝까지 걸었어요',
    activeDays,
  };
}

/**
 * 이번 달 지도에 대한 안내 문구입니다.
 *
 * **쉰 것을 벌하지 않습니다.** "3일 쉬었어요" 같은 말을 쓰지 않습니다.
 * 지도는 간 만큼 남고, 안 간 만큼 그대로일 뿐입니다.
 */
export const MONTH_MAP_NOTE =
  '쉬어도 지도는 그대로예요. 지운 적 없고, 지울 일도 없어요. 다음 달에 새 지도가 열려요.';
