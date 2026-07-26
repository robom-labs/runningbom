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

export type OnboardingStepId = 'intro' | 'goal' | 'voice';

/** 3화면 순서입니다. 화면을 늘리면 이 배열만 바꾸면 됩니다. */
export const onboardingStepIds: OnboardingStepId[] = ['intro', 'goal', 'voice'];

export const onboardingStepCount = onboardingStepIds.length;

export const onboardingStepTitles: Record<OnboardingStepId, string> = {
  intro: '러닝봄이 이렇게 도와드려요',
  goal: '이번 주 목표를 정해 볼까요',
  voice: '어떤 목소리로 들을까요',
};

export const onboardingStepSubtitles: Record<OnboardingStepId, string> = {
  intro: '로그인 없이 바로 쓸 수 있어요. 기록은 이 기기에 저장돼요.',
  goal: '지금 고른 값은 나중에 기록·통계에서 언제든 바꿀 수 있어요.',
  voice: '설정에서 언제든 바꿀 수 있어요.',
};

export function onboardingStepIndex(step: OnboardingStepId): number {
  const index = onboardingStepIds.indexOf(step);
  return index < 0 ? 0 : index;
}

export function nextOnboardingStep(step: OnboardingStepId): OnboardingStepId | undefined {
  return onboardingStepIds[onboardingStepIndex(step) + 1];
}

export function previousOnboardingStep(step: OnboardingStepId): OnboardingStepId | undefined {
  if (onboardingStepIndex(step) === 0) return undefined;
  return onboardingStepIds[onboardingStepIndex(step) - 1];
}

export function isLastOnboardingStep(step: OnboardingStepId): boolean {
  return onboardingStepIndex(step) === onboardingStepIds.length - 1;
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

/** 1화면 소개 문구입니다. 숫자는 호출부가 실제 데이터에서 세어 넘깁니다. */
export function introHighlights(counts: {
  coachSentences: number;
  shoes: number;
  races: number;
}): IntroHighlight[] {
  return [
    {
      id: 'coach',
      title: '코치가 러닝 내내 말해 줘요',
      body: `준비 문장 ${counts.coachSentences}개로 워밍업부터 마무리까지 이어서 안내해요. 기기 음성으로 읽어 주기 때문에 데이터 요금이 들지 않아요.`,
    },
    {
      id: 'shoes',
      title: `러닝화 ${counts.shoes}종을 비교해요`,
      body: '목적과 국내 구매 경로를 정리해 뒀어요. 지금 신는 러닝화를 저장해 둘 수도 있어요.',
    },
    {
      id: 'races',
      title: `국내 대회 ${counts.races}개를 모아 뒀어요`,
      body: '접수 일정과 지역을 확인하고, 원하는 대회는 접수 시작 알림을 예약할 수 있어요.',
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
