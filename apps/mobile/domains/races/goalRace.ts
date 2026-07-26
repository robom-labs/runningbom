// 사용자가 "이 대회를 목표로 삼겠다"고 지정한 대회 1건과, 남은 기간 계산·준비 체크리스트 규칙입니다.
// 저장은 새 키에만 하고 기존 키는 건드리지 않습니다. 데이터에 없는 대회는 만들지 않습니다.
import { daysUntilRace } from './aggregate';

export const GOAL_RACE_KEY = 'runningbom:vnext:goal-race:v1';

export type GoalRace = {
  /** 대회 집계 그룹의 대표 대회 id입니다. 기존 대회 데이터의 id를 그대로 씁니다. */
  raceId: string;
  groupKey: string;
  name: string;
  raceDate: string;
  region: string;
  savedAt: string;
};

export function isGoalRace(value: unknown): value is GoalRace {
  if (!value || typeof value !== 'object') return false;
  const goal = value as Partial<GoalRace>;
  return (
    typeof goal.raceId === 'string' &&
    typeof goal.groupKey === 'string' &&
    typeof goal.name === 'string' &&
    typeof goal.region === 'string' &&
    typeof goal.savedAt === 'string' &&
    typeof goal.raceDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(goal.raceDate)
  );
}

export type GoalRacePhase =
  | 'base'
  | 'build'
  | 'sharpen'
  | 'taper'
  | 'raceWeek'
  | 'raceDay'
  | 'past';

export type GoalRaceCountdown = {
  days: number;
  /** 남은 주차입니다. 대회 당일과 지난 대회는 0입니다. */
  weeks: number;
  phase: GoalRacePhase;
  dDayLabel: string;
  remainingLabel: string;
};

export function goalRacePhase(days: number): GoalRacePhase {
  if (days < 0) return 'past';
  if (days === 0) return 'raceDay';
  if (days <= 7) return 'raceWeek';
  if (days <= 14) return 'taper';
  if (days <= 28) return 'sharpen';
  if (days <= 56) return 'build';
  return 'base';
}

export const goalRacePhaseLabels: Record<GoalRacePhase, string> = {
  base: '기초 쌓기',
  build: '거리 늘리기',
  sharpen: '리듬 다듬기',
  taper: '양 줄이기',
  raceWeek: '대회 주간',
  raceDay: '대회 당일',
  past: '지난 대회',
};

export function goalRaceCountdown(raceDate: string, now: number = Date.now()): GoalRaceCountdown {
  const days = daysUntilRace(raceDate, now);
  const phase = goalRacePhase(days);
  const weeks = days > 0 ? Math.ceil(days / 7) : 0;
  const dDayLabel = days === 0 ? 'D-DAY' : days < 0 ? `D+${Math.abs(days)}` : `D-${days}`;
  const remainingLabel =
    days < 0
      ? `${Math.abs(days)}일 지났어요`
      : days === 0
        ? '오늘이 대회 날이에요'
        : days <= 7
          ? `${days}일 남았어요`
          : `${days}일 · 약 ${weeks}주 남았어요`;
  return { days, weeks, phase, dDayLabel, remainingLabel };
}

export type ChecklistItem = { id: string; text: string };

const checklistByPhase: Record<GoalRacePhase, ChecklistItem[]> = {
  base: [
    { id: 'base-rhythm', text: '주간 리듬을 먼저 정해요. 이번 주에 달릴 요일을 캘린더에 넣어 두기' },
    { id: 'base-easy', text: '대부분의 러닝은 대화가 가능한 속도로 채우기' },
    { id: 'base-shoes', text: '지금 신발 상태 확인하기. 바꿀 거라면 대회 전 충분히 신어 보기' },
    { id: 'base-longrun', text: '롱런 거리를 2~3주에 한 번씩만 조금 늘리기' },
  ],
  build: [
    { id: 'build-longrun', text: '롱런을 대회 거리 쪽으로 조금씩 붙여 가기' },
    { id: 'build-recovery', text: '3주 늘렸으면 1주는 줄여서 회복 주 만들기' },
    { id: 'build-registration', text: '접수 일정과 준비물(배번 수령 방법) 확인하기' },
    { id: 'build-nutrition', text: '롱런 날에 대회 당일과 같은 아침 식사 미리 시험해 보기' },
  ],
  sharpen: [
    { id: 'sharpen-pace', text: '목표 페이스를 최근 연습 기록 기준으로 현실적으로 잡기' },
    { id: 'sharpen-gear', text: '대회에 입을 옷·양말·신발을 실제 러닝에서 미리 써 보기' },
    { id: 'sharpen-course', text: '코스 지도와 급수대 위치 확인하기' },
    { id: 'sharpen-travel', text: '대회장까지 이동 방법과 소요 시간 알아보기' },
  ],
  taper: [
    { id: 'taper-volume', text: '달리는 양을 줄이고 새로운 훈련은 넣지 않기' },
    { id: 'taper-sleep', text: '잠을 충분히 자는 걸 이번 주 목표로 두기' },
    { id: 'taper-nothing-new', text: '새 신발·새 음식은 대회 당일에 처음 쓰지 않기' },
    { id: 'taper-plan', text: '출발 시각에서 역산해 기상·이동 시간 정하기' },
  ],
  raceWeek: [
    { id: 'week-pack', text: '배번호·핀·신분증·교통편 미리 챙겨 두기' },
    { id: 'week-clothes', text: '전날 밤에 입을 옷과 신발 전부 꺼내 두기' },
    { id: 'week-easy', text: '남은 러닝은 짧고 가볍게만' },
    { id: 'week-weather', text: '당일 기온을 확인하고 겹쳐 입을 옷 정하기' },
  ],
  raceDay: [
    { id: 'day-meal', text: '평소 익숙한 음식으로 가볍게 먹기' },
    { id: 'day-warmup', text: '출발 전에 가볍게 몸 풀기' },
    { id: 'day-start', text: '초반에 휩쓸리지 않게 목표 페이스보다 살짝 여유 있게 출발하기' },
    { id: 'day-water', text: '급수대에서는 무리하지 않기. 필요하면 걸으면서 마셔도 괜찮아요' },
  ],
  past: [
    { id: 'past-recovery', text: '며칠은 가볍게. 몸 상태를 보고 다음 계획 잡기' },
    { id: 'past-record', text: '기록·통계에 이번 대회 기록을 직접 입력해 남기기' },
    { id: 'past-next', text: '다음 목표 대회를 정하고 싶다면 대회 목록에서 다시 지정하기' },
  ],
};

/** 남은 기간에 맞는 준비 체크리스트입니다. 의료적 지시가 아닌 준비 항목만 담습니다. */
export function goalRaceChecklist(raceDate: string, now: number = Date.now()): ChecklistItem[] {
  return checklistByPhase[goalRaceCountdown(raceDate, now).phase];
}

export const goalRaceDisclaimer =
  '체크리스트는 준비를 돕는 참고 목록이에요. 몸 상태에 대한 판단은 의료 전문가와 상의해 주세요.';
