// 온보딩에서 받은 답으로 **어떤 계획을 깔아 줄지** 정합니다.
//
// 왜 이게 필요한가:
//   지금 온보딩은 이름·목표·목소리를 묻고 끝납니다. 그러고 나면 홈에서
//   계획 40개가 그대로 펼쳐집니다. 처음 온 사람은 무엇을 골라야 할지 모릅니다.
//   묻기만 하고 아무것도 해 주지 않으면, 물어본 것이 오히려 부담이 됩니다.
//
//   그래서 온보딩이 끝나는 순간 **계획 하나가 이미 깔려 있어야** 합니다.
//   "다음 회차 시작하기" 버튼 하나만 남는 상태가 목표입니다.
//
// 안전 규칙 (여기서 절대 어기지 않습니다):
//   - 스스로 밝힌 수준보다 **위쪽 계획을 깔지 않습니다.** 다치는 쪽은 되돌릴 수 없습니다.
//   - 기록이 없으면 걷기부터 시작하는 계획을 깝니다.
//   - 자격 조건·검수가 걸린 계획(하프·마라톤·부상 복귀)은 온보딩에서 절대 고르지 않습니다.
//
// 이 파일은 순수합니다.
import { programFamilies, type ProgramFamily } from './catalog';

/** 온보딩에서 스스로 고르는 지금 상태입니다. 시험이 아니라 자기 신고입니다. */
export type StartingPointId = 'walking' | 'shortRuns' | 'regular' | 'returning';

export type StartingPoint = {
  id: StartingPointId;
  label: string;
  /** 고를 때 보이는 한 줄. 잘하고 못하고를 가르는 말을 쓰지 않습니다. */
  description: string;
  /** 이 답을 고르면 깔릴 계획입니다. */
  planId: string;
};

/**
 * 네 갈래뿐인 이유:
 *   다섯 개가 넘으면 자기가 어디에 속하는지 고민이 길어집니다.
 *   그리고 이 네 갈래면 온보딩 직후에 필요한 판단이 다 됩니다.
 */
export const startingPoints: StartingPoint[] = [
  {
    id: 'walking',
    label: '거의 안 뛰어요',
    description: '걷기부터 천천히 시작할게요',
    // 걷기 → 짧은 달리기로 이어지는 가장 낮은 시작점입니다.
    planId: 'move-14d',
  },
  {
    id: 'shortRuns',
    label: '가끔 짧게 뛰어요',
    description: '10분쯤은 쉬지 않고 뛸 수 있어요',
    planId: 'continuous-20m',
  },
  {
    id: 'regular',
    label: '꾸준히 뛰고 있어요',
    description: '30분쯤은 이어서 뛸 수 있어요',
    planId: 'first-5k',
  },
  {
    id: 'returning',
    label: '쉬었다 다시 시작해요',
    description: '예전에 뛰었는데 한동안 쉬었어요',
    // 복귀는 예전 실력이 아니라 지금 몸에 맞춰야 합니다. 그래서 짧은 복귀 계획입니다.
    planId: 'return-short-break',
  },
];

export function startingPoint(id: StartingPointId): StartingPoint {
  return startingPoints.find((item) => item.id === id) ?? (startingPoints[0] as StartingPoint);
}

/**
 * 온보딩이 끝날 때 깔 계획 id입니다.
 *
 * 카탈로그에 없는 id가 나오면 **가장 낮은 계획으로 떨어집니다.**
 * 못 찾았을 때 위쪽으로 떨어지면 처음 온 사람이 다칩니다.
 */
export function onboardingPlanId(id: StartingPointId): string {
  const wanted = startingPoint(id).planId;
  const found = programFamilies.find((plan: ProgramFamily) => plan.id === wanted);
  return found ? found.id : 'move-14d';
}

/** 계획을 깔고 나서 보여 줄 한 줄입니다. 무엇이 준비됐는지 말해 줘야 시작합니다. */
export function onboardingPlanNote(id: StartingPointId): string {
  const plan = programFamilies.find((item: ProgramFamily) => item.id === onboardingPlanId(id));
  if (!plan) return '계획을 준비해 뒀어요.';
  return `"${plan.title}"을 준비해 뒀어요. 순서대로 따라가기만 하면 돼요.`;
}
