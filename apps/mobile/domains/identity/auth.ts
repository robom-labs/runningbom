// 외부 비밀키를 앱에 넣지 않고 Supabase PKCE 로그인과 연결 상태를 처리합니다.
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { Provider, Session, UserIdentity } from '@supabase/supabase-js';

import { featureFlags } from '../../services/feature-flags/flags';
import { supabase } from '../../services/supabase/client';

WebBrowser.maybeCompleteAuthSession();

export type LoginProvider = 'google' | 'kakao' | 'naver' | 'apple';

export type ProviderAvailability = {
  provider: LoginProvider;
  enabled: boolean;
  blocker?: string;
};

export function providerMatrix(): ProviderAvailability[] {
  const appleApproved =
    process.env.EXPO_PUBLIC_APPLE_PROVIDER_APPROVED === '1' &&
    featureFlags.authApple;
  return [
    {
      provider: 'google',
      enabled: Boolean(supabase && featureFlags.authGoogle),
      blocker: supabase && featureFlags.authGoogle ? undefined : 'Supabase Google OAuth 설정 필요',
    },
    {
      provider: 'kakao',
      enabled: Boolean(supabase && featureFlags.authKakao),
      blocker: supabase && featureFlags.authKakao ? undefined : 'Kakao 앱과 Supabase provider 설정 필요',
    },
    {
      provider: 'naver',
      enabled: false,
      blocker: 'Naver Custom OAuth2 UserInfo Adapter 검증 전 비활성',
    },
    {
      provider: 'apple',
      enabled: Boolean(supabase && appleApproved),
      blocker:
        supabase && appleApproved
          ? undefined
          : 'Apple Developer 자격과 서비스 설정 확인 전 비활성',
    },
  ];
}

function builtInProvider(provider: LoginProvider): Provider {
  if (provider === 'google' || provider === 'kakao' || provider === 'apple') return provider;
  throw new Error('Naver custom OAuth2는 검증된 adapter가 필요합니다.');
}

async function finishPkce(url: string): Promise<Session> {
  if (!supabase) throw new Error('Supabase가 연결되지 않았습니다.');
  const parsed = Linking.parse(url);
  const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : undefined;
  if (!code) throw new Error('OAuth 응답에 인증 코드가 없습니다.');
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) throw error ?? new Error('세션을 만들지 못했습니다.');
  return data.session;
}

export async function signIn(provider: LoginProvider): Promise<Session> {
  const availability = providerMatrix().find((item) => item.provider === provider);
  if (!availability?.enabled) throw new Error(availability?.blocker ?? '로그인을 사용할 수 없습니다.');
  if (!supabase) throw new Error('Supabase가 연결되지 않았습니다.');
  if (provider === 'naver') throw new Error('Naver Custom OAuth2 Adapter 검증 전입니다.');

  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: builtInProvider(provider),
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw error ?? new Error('로그인 주소를 만들지 못했습니다.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new Error('로그인을 취소했습니다.');
  return finishPkce(result.url);
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function currentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function currentIdentities(): Promise<UserIdentity[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.identities ?? [];
}

export async function linkIdentity(provider: LoginProvider): Promise<UserIdentity[]> {
  const availability = providerMatrix().find((item) => item.provider === provider);
  if (!availability?.enabled) throw new Error(availability?.blocker ?? '연결할 수 없습니다.');
  if (!supabase) throw new Error('Supabase가 연결되지 않았습니다.');
  if (provider === 'naver') throw new Error('Naver Custom OAuth2 Adapter 검증 전입니다.');

  const redirectTo = Linking.createURL('auth/link-callback');
  const { data, error } = await supabase.auth.linkIdentity({
    provider: builtInProvider(provider),
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw error ?? new Error('로그인 수단 연결 주소를 만들지 못했습니다.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new Error('로그인 수단 연결을 취소했습니다.');
  return currentIdentities();
}

export async function unlinkIdentity(identity: UserIdentity, identities: UserIdentity[]): Promise<void> {
  if (!supabase) throw new Error('Supabase가 연결되지 않았습니다.');
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) throw userError ?? new Error('로그인이 필요합니다.');
  const currentIdentities = data.user.identities ?? identities;
  if (currentIdentities.length <= 1) throw new Error('마지막 로그인 수단은 해제할 수 없습니다.');
  if (!currentIdentities.some((candidate) => candidate.id === identity.id)) {
    throw new Error('현재 계정에 연결되지 않은 로그인 수단입니다.');
  }
  const { error } = await supabase.auth.unlinkIdentity(identity);
  if (error) throw error;
}
