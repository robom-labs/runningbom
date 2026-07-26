// 러닝봄의 선택적 로그인 토큰과 마지막 로그인 제공자만 SecureStore에 보존합니다.
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN = 'runningbom:auth:access';
const REFRESH_TOKEN = 'runningbom:auth:refresh';
const LAST_PROVIDER = 'runningbom:auth:last-provider';

export async function saveSession(
  accessToken: string,
  refreshToken: string,
  provider: string,
): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN, accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN, refreshToken),
    SecureStore.setItemAsync(LAST_PROVIDER, provider),
  ]);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN),
    SecureStore.deleteItemAsync(REFRESH_TOKEN),
    SecureStore.deleteItemAsync(LAST_PROVIDER),
  ]);
}

export async function lastLoginProvider(): Promise<string | null> {
  return SecureStore.getItemAsync(LAST_PROVIDER);
}
