// 소셜 기능이 설정된 환경에서만 Supabase 익명 키 클라이언트를 생성합니다.
import 'react-native-url-polyfill/auto';

import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { supabaseConfigured } from '../feature-flags/flags';
import { secureAuthStorageKey } from './storageKey';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const secureAuthStorage = {
  getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(secureAuthStorageKey(key));
  },
  setItem(key: string, value: string): Promise<void> {
    return SecureStore.setItemAsync(secureAuthStorageKey(key), value);
  },
  removeItem(key: string): Promise<void> {
    return SecureStore.deleteItemAsync(secureAuthStorageKey(key));
  },
};

export const supabase: SupabaseClient | null =
  supabaseConfigured && url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: secureAuthStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      })
    : null;

export type CommunityMode = 'NORMAL' | 'LIMITED_WRITE' | 'READ_ONLY_COMMUNITY' | 'CORE_ONLY';

export function communityMode(): CommunityMode {
  if (!supabase) return 'CORE_ONLY';
  const configured = process.env.EXPO_PUBLIC_COMMUNITY_MODE;
  if (
    configured === 'NORMAL' ||
    configured === 'LIMITED_WRITE' ||
    configured === 'READ_ONLY_COMMUNITY'
  ) {
    return configured;
  }
  return 'READ_ONLY_COMMUNITY';
}
