// 카카오·네이버·구글·애플로 가입하는 흐름을 "체험(미리 보기)"으로만 보여 주는 규칙입니다.
//
// 아주 중요한 두 가지:
// 1) 진짜 로그인이 아닙니다. 실제 계정 정보를 묻지도, 밖으로 보내지도 않습니다.
//    네트워크 호출이 하나도 없고, 이 파일은 화면·저장소·설정을 전혀 모릅니다.
// 2) Preview 빌드에서만 열립니다. 판정 값은 previewGate.ts가 읽어서 넘겨 줍니다.
//    정식 빌드에서는 beginTrialLogin이 항상 막습니다.
import { experienceLevels, type ExperienceLevel } from '../badges/goals';

export type TrialProvider = 'kakao' | 'naver' | 'google' | 'apple';

/** 화면에 보여 줄 순서입니다. */
export const trialProviders: TrialProvider[] = ['kakao', 'naver', 'google', 'apple'];

/**
 * 이름만 한글로 씁니다. 각 회사의 로고나 공식 색을 흉내 내지 않습니다(상표 문제).
 * 버튼 색은 러닝봄 팔레트만 씁니다.
 */
export const trialProviderNames: Record<TrialProvider, string> = {
  kakao: '카카오',
  naver: '네이버',
  google: '구글',
  apple: '애플',
};

export function trialProviderButtonLabel(provider: TrialProvider): string {
  return `${trialProviderNames[provider]}로 시작하기`;
}

// ── 정직하게 알리는 문구 ─────────────────────────────────────────────────────
/** 체험 흐름의 모든 화면에 작지만 분명하게 붙는 한 줄입니다. */
export const trialModeNotice = '체험 모드 · 실제 계정과 연결되지 않아요';

export const trialModeDetail =
  '지금은 미리 보기예요. 아래 버튼을 눌러도 카카오·네이버·구글·애플 계정에는 아무 일도 일어나지 않아요.';

export const trialBlockedMessage =
  '이 빌드에서는 체험 로그인을 열 수 없어요. 로그인 없이 바로 시작할 수 있어요.';

export const noLoginLabel = '로그인 없이 시작';

export const noLoginHint = '로그인 없이도 모든 기능을 쓸 수 있어요. 기록은 이 기기에만 저장돼요.';

export function trialLoadingMessage(provider: TrialProvider): string {
  return `${trialProviderNames[provider]} 체험 화면을 여는 중이에요`;
}

export const trialConsentTitle = '체험용 로그인 화면';

export function trialConsentBody(provider: TrialProvider): string {
  return `실제 ${trialProviderNames[provider]} 로그인 화면이 아니에요. 진짜 계정 정보는 묻지 않고, 아무 정보도 밖으로 보내지 않아요.`;
}

/** 실제 서비스라면 무엇을 물어보는지 미리 보여 주는 목록입니다. 가짜 개인정보는 만들지 않습니다. */
export const trialConsentItems = [
  '앱에서 쓸 이름(닉네임) — 잠시 뒤에 직접 정해요',
  '러닝 기록을 이 기기에 저장해도 되는지',
];

export const trialConsentApproveLabel = '체험으로 계속하기';
export const trialConsentCancelLabel = '취소';

export const trialProfileTitle = '거의 다 됐어요';
export const trialProfileSubtitle = '세 가지만 물어볼게요. 나중에 설정에서 바꿀 수 있어요.';
export const trialProfileNicknameLabel = '닉네임 (꼭 필요해요)';
export const trialProfileExperienceLabel = '러닝 경력 (안 골라도 돼요)';
export const trialProfileWeeklyLabel = '이번 주 목표 (안 골라도 돼요)';
export const trialProfileSubmitLabel = '시작하기';

// ── Preview 전용 문지기 ──────────────────────────────────────────────────────
/**
 * Preview 빌드 표시가 정확히 true일 때만 체험 흐름을 엽니다.
 * 문자열 'true'나 1처럼 비슷하게 생긴 값은 전부 막습니다.
 */
export function trialLoginAllowed(previewEnabled: unknown): boolean {
  return previewEnabled === true;
}

export type TrialLoginStart =
  | { ok: true; provider: TrialProvider }
  | { ok: false; message: string };

/**
 * 체험 로그인 진입점입니다. 화면은 이 함수를 거치지 않고 다음 단계로 갈 수 없습니다.
 * 정식 빌드(allowed=false)에서는 언제나 막힙니다.
 */
export function beginTrialLogin(provider: TrialProvider, allowed: boolean): TrialLoginStart {
  if (!allowed) return { ok: false, message: trialBlockedMessage };
  if (!trialProviders.includes(provider)) {
    return { ok: false, message: trialBlockedMessage };
  }
  return { ok: true, provider };
}

// ── 정보 입력(딱 3개) ────────────────────────────────────────────────────────
export const trialWeeklySessionOptions = [2, 3, 4] as const;
export type TrialWeeklySessions = (typeof trialWeeklySessionOptions)[number];

export function isTrialWeeklySessions(value: unknown): value is TrialWeeklySessions {
  return (
    typeof value === 'number' &&
    (trialWeeklySessionOptions as readonly number[]).includes(value)
  );
}

const reservedNicknames = /^(운영자|관리자|로봄|runningbom|러닝봄)$/iu;

export type TrialNicknameCheck = { ok: true; value: string } | { ok: false; message: string };

/** 닉네임은 사용자가 직접 적습니다. 가짜 이름을 대신 지어 넣지 않습니다. */
export function checkTrialNickname(raw: string): TrialNicknameCheck {
  const value = raw.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (value.length === 0) return { ok: false, message: '앱에서 쓸 이름을 적어 주세요.' };
  if (value.length < 2 || value.length > 16) {
    return { ok: false, message: '이름은 2자부터 16자까지 적을 수 있어요.' };
  }
  if (reservedNicknames.test(value)) {
    return { ok: false, message: '운영자로 오해할 수 있는 이름은 쓸 수 없어요.' };
  }
  return { ok: true, value };
}

/** 어떤 길로 들어왔는지입니다. trial-login은 체험 로그인, no-login은 로그인 없이 시작입니다. */
export type TrialEntryKind = 'trial-login' | 'no-login';

export type TrialProfile = {
  nickname: string;
  entry: TrialEntryKind;
  /** 체험 로그인으로 들어왔을 때만 있습니다. */
  provider?: TrialProvider;
  /** 이 프로필이 체험 모드에서 만들어졌는지입니다. 실제 계정과 연결된 적이 없다는 표시입니다. */
  trialMode: boolean;
  experience?: ExperienceLevel;
  weeklySessions?: TrialWeeklySessions;
  createdAt: string;
};

export type TrialProfileInput = {
  nickname: string;
  entry: TrialEntryKind;
  provider?: TrialProvider;
  experience?: ExperienceLevel;
  weeklySessions?: number;
  now?: number;
};

export type TrialProfileResult = { ok: true; value: TrialProfile } | { ok: false; message: string };

export function buildTrialProfile(input: TrialProfileInput): TrialProfileResult {
  const nickname = checkTrialNickname(input.nickname);
  if (!nickname.ok) return { ok: false, message: nickname.message };
  const experience =
    input.experience && experienceLevels.includes(input.experience) ? input.experience : undefined;
  const weeklySessions = isTrialWeeklySessions(input.weeklySessions)
    ? input.weeklySessions
    : undefined;
  return {
    ok: true,
    value: {
      nickname: nickname.value,
      entry: input.entry,
      ...(input.entry === 'trial-login' && input.provider ? { provider: input.provider } : {}),
      // 체험 로그인으로 만든 프로필은 언제나 체험 모드 표시를 답니다.
      trialMode: input.entry === 'trial-login',
      ...(experience ? { experience } : {}),
      ...(weeklySessions ? { weeklySessions } : {}),
      createdAt: new Date(input.now ?? Date.now()).toISOString(),
    },
  };
}

/** 프로필 카드 밑에 붙는 한 줄입니다. 어떤 방법으로 들어왔는지 사용자가 볼 수 있게 씁니다. */
export function trialProfileSummary(profile: TrialProfile): string {
  if (profile.entry === 'no-login') return '로그인 없이 시작했어요.';
  const name = profile.provider ? trialProviderNames[profile.provider] : '체험';
  return `${name} 체험 로그인으로 만들었어요. 실제 계정과 연결되지 않아요.`;
}

export const TRIAL_PROFILE_KEY = 'runningbom:vnext:trial-profile:v1';

export function isTrialProfile(value: unknown): value is TrialProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<TrialProfile>;
  return (
    typeof profile.nickname === 'string' &&
    profile.nickname.length > 0 &&
    (profile.entry === 'trial-login' || profile.entry === 'no-login') &&
    typeof profile.trialMode === 'boolean' &&
    typeof profile.createdAt === 'string'
  );
}
