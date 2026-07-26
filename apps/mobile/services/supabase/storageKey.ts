// Supabase 세션 키를 SecureStore에서 사용할 수 있는 안정적인 이름으로 변환합니다.
export function secureAuthStorageKey(key: string): string {
  return `runningbom.auth.${key.replaceAll(/[^A-Za-z0-9._-]/g, '_')}`;
}
