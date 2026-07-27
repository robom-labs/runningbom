// 훈련 탭을 네 칸으로 나누는 규칙입니다.
//
// 왜 나누는가:
//   지금 훈련 화면 하나에 계획 고르기 · 오늘 제안 · 도전 · 훈련 103개 · 9주 진행 ·
//   대회 계획 · 보조 프로젝트가 **세로로 전부** 쌓여 있습니다. 회장 표현 그대로 "너무 길다".
//   길다는 건 스크롤이 힘들다는 뜻이 아니라, **무엇이 중요한지 화면이 말해 주지 않는다**는 뜻입니다.
//
// 규칙:
//   1. 한 번에 **한 칸만** 펼칩니다. 두 개가 열려 있으면 다시 길어집니다.
//   2. 처음 열었을 때 펼쳐 있을 칸은 **상황에 따라 다릅니다**(아래 defaultOpenSection).
//   3. 접힌 칸도 **한 줄 요약**은 보입니다. 접힌 게 빈 상자로 보이면 아무도 안 엽니다.
//
// 이 파일은 순수합니다. react-native를 import하지 않습니다.

export const trainingSectionKeys = ['plan', 'today', 'challenge', 'project'] as const;
export type TrainingSectionKey = (typeof trainingSectionKeys)[number];

export type TrainingSectionDefinition = {
  key: TrainingSectionKey;
  title: string;
  /** 접혀 있을 때 제목 아래 한 줄입니다. 무엇이 들었는지 알려 줍니다. */
  hint: string;
};

export const trainingSections: TrainingSectionDefinition[] = [
  { key: 'plan', title: '지금 하는 계획', hint: '순서대로 따라가는 여러 주짜리 계획이에요' },
  { key: 'today', title: '오늘 한 번만', hint: '계획과 상관없이 오늘만 하는 훈련이에요' },
  { key: 'challenge', title: '도전', hint: '이번 주·이번 달에 채우는 작은 목표예요' },
  { key: 'project', title: '챙길 것', hint: '자세·호흡·장비처럼 달리기를 돕는 것들이에요' },
];

export type TrainingSectionState = {
  /** 지금 하는 계획에 남은 회차가 있는지입니다. */
  hasActivePlan: boolean;
  /** 진행 중인 도전 수입니다. */
  activeChallengeCount: number;
  /** 하던 보조 프로젝트가 있는지입니다. */
  hasStartedProject: boolean;
};

/**
 * 훈련 탭을 열었을 때 어느 칸이 펼쳐져 있을지입니다.
 *
 * 순서가 곧 판단입니다.
 *   1) 하던 계획이 있으면 그것부터 — 이어서 하는 사람이 가장 많습니다
 *   2) 계획이 없으면 "오늘 한 번만" — 계획 없이 온 사람에게 당장 할 것을 줍니다
 *
 * 도전·챙길 것을 기본으로 열지 않는 이유: 둘 다 **오늘 나가는 것과 무관**합니다.
 * 나가기 직전에 먼저 보이면 나가는 것을 늦춥니다.
 */
export function defaultOpenSection(state: TrainingSectionState): TrainingSectionKey {
  if (state.hasActivePlan) return 'plan';
  return 'today';
}

/**
 * 접힌 칸 오른쪽에 붙는 숫자입니다. 없으면 undefined입니다.
 *
 * 0은 배지로 만들지 않습니다. "0개"라고 써 붙이면 없는 것을 강조하는 꼴이 됩니다.
 */
export function sectionBadge(
  key: TrainingSectionKey,
  state: TrainingSectionState,
): string | undefined {
  if (key === 'challenge' && state.activeChallengeCount > 0) {
    return `${state.activeChallengeCount}개`;
  }
  if (key === 'plan' && state.hasActivePlan) return '진행 중';
  if (key === 'project' && state.hasStartedProject) return '하던 것';
  return undefined;
}

/**
 * 칸을 눌렀을 때의 다음 상태입니다.
 *
 * 열려 있는 칸을 다시 누르면 **닫힙니다**(전부 접힌 상태가 됩니다).
 * 전부 접을 수 있어야 화면 전체를 한눈에 훑을 수 있습니다.
 */
export function toggleSection(
  open: TrainingSectionKey | undefined,
  pressed: TrainingSectionKey,
): TrainingSectionKey | undefined {
  return open === pressed ? undefined : pressed;
}
