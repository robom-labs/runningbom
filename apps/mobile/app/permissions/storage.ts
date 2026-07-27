// 허락 장부를 AsyncStorage에 읽고 씁니다. 판단 규칙은 rules.ts가 갖고 있습니다.
// 기존 저장 키는 건드리지 않고 새 키 하나만 씁니다.
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  PERMISSION_LEDGER_KEY,
  emptyPermissionLedger,
  parsePermissionLedger,
} from './rules';
import type { PermissionLedger } from './types';

export async function loadPermissionLedger(): Promise<PermissionLedger> {
  try {
    const raw = await AsyncStorage.getItem(PERMISSION_LEDGER_KEY);
    if (!raw) return emptyPermissionLedger;
    return parsePermissionLedger(JSON.parse(raw));
  } catch {
    return emptyPermissionLedger;
  }
}

export async function savePermissionLedger(ledger: PermissionLedger): Promise<void> {
  try {
    await AsyncStorage.setItem(PERMISSION_LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    // 저장 실패가 온보딩을 막지 않도록 조용히 넘어갑니다.
  }
}
