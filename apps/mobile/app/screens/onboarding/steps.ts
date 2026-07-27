// 첫 실행 온보딩의 단계 순서와 입력 규칙입니다.
// 화면(React)과 저장소(AsyncStorage)를 모르는 순수 모듈이라 그대로 테스트할 수 있습니다.
import {
  closingCues,
  generalCues,
  openingCues,
  phaseScripts,
  typeCues,
} from '../../../domains/coaching/cueLibrary';
import type { VoiceGender } from '../../../domains/coaching/voice';
import {
  recommendWeeklyGoal,
  type WeeklyGoal,
} from '../../../domains/badges/goals';
import type { ActivityRecord } from '../../../domains/activities/types';
import {
  onboardingDoneCopy,
  onboardingLoginCopy,
  permissionPriming,
} from '../../permissions/copy';

export type OnboardingStepId =
  | 'intro'
  | 'goal'
  | 'voice'
  | 'login'
  | 'notification'
  | 'location'
  | 'battery'
  | 'done';

/**
 * 첫 실행의 실제 순서입니다.
 * 소개 → 목표 → 음성 → 알림 → 위치(Preview) → 배터리 → 완료.
 *
 * 계정 연결은 핵심 가치를 경험하기 전의 필수 단계가 아닙니다. 실제 로그인 제공자가 준비된 뒤에도
 * 설정에서 선택적으로 연결할 수 있으므로 첫 실행에서는 빼고, 가능한 한 빨리 첫 러닝으로 보냅니다.
 */
export const onboardingStepIds: OnboardingStepId[] = [
  'intro',
  'goal',
  'voice',
  'notification',
  'location',
  'battery',
  'done',
];

export const onboardingStepCount = onboardingStepIds.length;

/** 사전 설명이 붙는 세 단계입니다. 이 단계에서는 아래 버튼이 "허용하고 계속 / 나중에"가 됩니다. */
export const permissionStepIds = ['notification', 'location', 'battery'] as const;

export type PermissionStepId = (typeof permissionStepIds)[number];

export function isPermissionStep(step: OnboardingStepId): step is PermissionStepId {
  return (permissionStepIds as readonly string[]).includes(step);
}

export type OnboardingFlowOptions = {
  /** 위치 단계는 Preview 빌드에서만 보여 줍니다. */
  locationStep: boolean;
  /** 배터리 아끼기 설정이 있는 기기(안드로이드)에서만 보여 줍니다. */
  batteryStep: boolean;
};

/**
 * 이 빌드·이 기기에서 실제로 보여 줄 단계만 남깁니다.
 * 진행 점(StepDots)은 언제나 이 배열의 길이와 위치를 그대로 씁니다.
 */
export function buildOnboardingSteps(options: OnboardingFlowOptions): OnboardingStepId[] {
  return onboardingStepIds.filter((step) => {
    if (step === 'location') return options.locationStep;
    if (step === 'battery') return options.batteryStep;
    return true;
  });
}

export const onboardingStepTitles: Record<OnboardingStepId, string> = {
  intro: '오늘부터 달리기 쉽게 시작해요',
  goal: '이번 주 목표를 정해 볼까요',
  voice: '어떤 목소리로 들을까요',
  login: onboardingLoginCopy.title,
  notification: permissionPriming.notification.title,
  location: permissionPriming.location.title,
  battery: permissionPriming.battery.title,
  done: onboardingDoneCopy.title,
};

export const onboardingStepSubtitles: Record<OnboardingStepId, string> = {
  intro: '로그인 없이 바로 쓸 수 있어요. 기록은 이 기기에 저장돼요.',
  goal: '처음부터 무리하지 않도록, 지킬 수 있는 목표 하나만 고르면 돼요.',
  voice: '달리는 동안 들을 한국어 코치예요. 설정에서 언제든 바꿀 수 있어요.',
  login: onboardingLoginCopy.body,
  notification: permissionPriming.notification.body,
  location: permissionPriming.location.body,
  battery: permissionPriming.battery.body,
  done: onboardingDoneCopy.body,
};

export function onboardingStepIndex(
  step: OnboardingStepId,
  steps: OnboardingStepId[] = onboardingStepIds,
): number {
  const index = steps.indexOf(step);
  return index < 0 ? 0 : index;
}

export function nextOnboardingStep(
  step: OnboardingStepId,
  steps: OnboardingStepId[] = onboardingStepIds,
): OnboardingStepId | undefined {
  return steps[onboardingStepIndex(step, steps) + 1];
}

export function previousOnboardingStep(
  step: OnboardingStepId,
  steps: OnboardingStepId[] = onboardingStepIds,
): OnboardingStepId | undefined {
  if (onboardingStepIndex(step, steps) === 0) return undefined;
  return steps[onboardingStepIndex(step, steps) - 1];
}

export function isLastOnboardingStep(
  step: OnboardingStepId,
  steps: OnboardingStepId[] = onboardingStepIds,
): boolean {
  return onboardingStepIndex(step, steps) === steps.length - 1;
}

/** 코치가 실제로 갖고 있는 문장 수입니다(중복 제거). 화면에서 지어내지 않고 이 값을 씁니다. */
export function coachSentenceTotal(): number {
  const lines = new Set<string>();
  for (const pool of Object.values(generalCues)) {
    for (const line of pool) lines.add(line);
  }
  for (const byCategory of Object.values(typeCues)) {
    for (const pool of Object.values(byCategory)) {
      for (const line of pool ?? []) lines.add(line);
    }
  }
  for (const script of Object.values(phaseScripts)) {
    for (const line of [...script.pre, ...script.start, ...script.settle]) lines.add(line);
  }
  for (const line of [...openingCues, ...closingCues]) lines.add(line);
  return lines.size;
}

export type IntroHighlight = {
  id: string;
  title: string;
  body: string;
};

/**
 * 첫 화면은 기능 개수 자랑보다 사용자가 얻게 될 결과를 먼저 말합니다.
 * 숫자는 실제 데이터에서 받은 값만 보조 근거로 씁니다.
 */
export function introHighlights(counts: {
  coachSentences: number;
  shoes: number;
  races: number;
}): IntroHighlight[] {
  return [
    {
      id: 'plan',
      title: '오늘 할 운동 하나만 골라 드려요',
      body: '처음이라면 9주 달리기 시작을 따라가고, 목표 대회가 있다면 날짜에 맞춘 준비 계획을 볼 수 있어요.',
    },
    {
      id: 'coach',
      title: '달리는 동안 한국어 코치가 함께해요',
      body: `준비된 안내 ${counts.coachSentences}개에서 상황에 맞는 말을 골라 워밍업부터 마무리까지 이어 줘요. 기기 음성을 써서 데이터 요금이 들지 않아요.`,
    },
    {
      id: 'discover',
      title: '국내 대회와 러닝화도 한곳에서 찾아요',
      body: `검증된 국내 대회 ${counts.races}개와 러닝화 ${counts.shoes}종을 목적에 맞게 찾고, 관심 항목을 저장할 수 있어요.`,
    },
  ];
}

export type GoalPresetId = 'light' | 'steady' | 'active' | 'auto';

export type GoalPreset = {
  id: GoalPresetId;
  label: string;
  description: string;
  sessions?: number;
};

/** 2화면 목표 선택지입니다. auto는 최근 기록 평균으로 추천값을 계산합니다. */
export const goalPresets: GoalPreset[] = [
  { id: 'light', label: '주 2회', description: '가볍게 습관부터 만들래요.', sessions: 2 },
  { id: 'steady', label: '주 3회', description: '꾸준히 이어 가고 싶어요.', sessions: 3 },
  { id: 'active', label: '주 4회', description: '이미 달리고 있어요.', sessions: 4 },
  { id: 'auto', label: '자동 추천', description: '기록을 보고 러닝봄이 정해 주세요.' },
];

export const defaultGoalPresetId: GoalPresetId = 'steady';

export function goalFromPreset(
  presetId: GoalPresetId,
  activities: ActivityRecord[] = [],
  now: Date | number = Date.now(),
): WeeklyGoal {
  if (presetId === 'auto') return recommendWeeklyGoal(activities, now);
  const preset = goalPresets.find((item) => item.id === presetId);
  const sessions = preset?.sessions ?? 3;
  return { metric: 'sessions', target: sessions, auto: false };
}

const reservedNicknames = /^(운영자|관리자|로봄|runningbom|러닝봄)$/iu;

export type NicknameCheck =
  | { ok: true; value: string }
  | { ok: false; message: string };

/** 닉네임은 선택 입력입니다. 비워 두면 기본 닉네임을 그대로 씁니다. */
export function checkNickname(raw: string): NicknameCheck {
  const value = raw.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (value.length === 0) return { ok: true, value: '' };
  if (value.length < 2 || value.length > 16) {
    return { ok: false, message: '닉네임은 2자부터 16자까지 입력해 주세요.' };
  }
  if (reservedNicknames.test(value)) {
    return { ok: false, message: '운영 주체로 오해할 수 있는 닉네임은 사용할 수 없어요.' };
  }
  return { ok: true, value };
}

export type OnboardingResult = {
  /** 건너뛰기로 끝냈는지 여부입니다. 건너뛰어도 완료로 저장해 다시 뜨지 않게 합니다. */
  skipped: boolean;
  goalPresetId?: GoalPresetId;
  nickname?: string;
  voiceGender?: VoiceGender;
};

export const voiceChoiceNote = '설정에서 언제든 바꿀 수 있어요.';
