// 네이버 공식 UserInfo 응답을 네이티브 런타임과 분리해 안전하게 검증합니다.
import { z } from 'zod';

export const naverUserInfoAdapterContract = {
  authorizationEndpoint: 'https://nid.naver.com/oauth2.0/authorize',
  tokenEndpoint: 'https://nid.naver.com/oauth2.0/token',
  userInfoEndpoint: 'https://openapi.naver.com/v1/nid/me',
  requiredResponseField: 'response.id',
  syntheticEmailAllowed: false,
  serviceRoleSessionMintingAllowed: false,
} as const;

const naverProfileSchema = z.object({
  resultcode: z.string().optional(),
  message: z.string().optional(),
  response: z.object({
    id: z.string().trim().min(1),
    email: z.string().trim().email().optional(),
    name: z.string().trim().min(1).optional(),
    nickname: z.string().trim().min(1).optional(),
    profile_image: z.string().url().optional(),
  }),
});

export type NaverNormalizedUserInfo = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

/**
 * Naver 공식 UserInfo 응답을 Custom OAuth2 adapter가 사용할 표준 필드로만 줄입니다.
 * 이메일이 없을 때 가짜 주소를 만들지 않으며, 앱 세션도 여기서 발급하지 않습니다.
 */
export function normalizeNaverUserInfo(input: unknown): NaverNormalizedUserInfo {
  const parsed = naverProfileSchema.parse(input);
  if (parsed.resultcode && parsed.resultcode !== '00') {
    throw new Error(parsed.message || 'Naver UserInfo 응답이 성공 상태가 아닙니다.');
  }
  const profile = parsed.response;
  const name = profile.name ?? profile.nickname;
  return {
    sub: profile.id,
    ...(profile.email ? { email: profile.email } : {}),
    ...(name ? { name } : {}),
    ...(profile.profile_image ? { picture: profile.profile_image } : {}),
  };
}
