// 외부 계정과 법률 검토가 끝나기 전 위험 기능을 기본적으로 닫아 둡니다.
import Constants from 'expo-constants';

export type FeatureFlags = {
  social: boolean;
  authGoogle: boolean;
  authKakao: boolean;
  authNaver: boolean;
  authApple: boolean;
  neighborhoodDeviceConfirmation: boolean;
};

function enabled(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

const runtimePolicy = Constants.expoConfig?.extra?.runtimePolicy as
  | {
      productionOauthRedirectsEnabled?: boolean;
      productionSocialWriteEnabled?: boolean;
    }
  | undefined;
const oauthRuntimeAllowed = runtimePolicy?.productionOauthRedirectsEnabled !== false;
const socialRuntimeAllowed = runtimePolicy?.productionSocialWriteEnabled !== false;

export const featureFlags: FeatureFlags = {
  social: socialRuntimeAllowed && enabled(process.env.EXPO_PUBLIC_SOCIAL_ENABLED),
  authGoogle: oauthRuntimeAllowed && enabled(process.env.EXPO_PUBLIC_AUTH_GOOGLE_ENABLED),
  authKakao: oauthRuntimeAllowed && enabled(process.env.EXPO_PUBLIC_AUTH_KAKAO_ENABLED),
  authNaver: oauthRuntimeAllowed && enabled(process.env.EXPO_PUBLIC_AUTH_NAVER_ENABLED),
  authApple: oauthRuntimeAllowed && enabled(process.env.EXPO_PUBLIC_AUTH_APPLE_ENABLED),
  neighborhoodDeviceConfirmation: enabled(
    process.env.EXPO_PUBLIC_NEIGHBORHOOD_DEVICE_CONFIRMATION_ENABLED,
  ),
};

export const supabaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL &&
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);
