// 코치 설정(성격·말투·밀도·오늘 챙길 곳·매운맛)을 보관합니다.
//
// 공용 preferences 저장소를 건드리지 않고 별도 키를 씁니다.
// 목소리 설정(voicePreference.ts)과 같은 방식입니다.
//
// 판단은 전부 personaNormalize.ts에 있고 여기는 읽고 쓰기만 합니다.
// 그래야 판단을 Node에서 테스트할 수 있습니다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { defaultCoachSettings, type CoachSettings } from './persona';
import { normalizeCoachSettings } from './personaNormalize';

const KEY = 'runningbom:coaching:settings:v1';

export async function loadCoachSettings(legacyGuidance?: string): Promise<CoachSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return normalizeCoachSettings({
      ...(raw ? { stored: JSON.parse(raw) } : {}),
      ...(legacyGuidance ? { legacyGuidance } : {}),
    });
  } catch {
    return defaultCoachSettings;
  }
}

export async function saveCoachSettings(settings: CoachSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // 저장 실패가 러닝을 막지 않습니다.
  }
}

/**
 * 화면에서 쓰는 훅입니다.
 *
 * `ready`가 왜 있는가: 읽어 오기 전에는 기본값이 잠깐 보입니다.
 * 그 사이에 화면이 "전문 코치·존댓말"을 그려 두면, 매운맛을 골라 둔 사람은
 * 자기 설정이 날아간 줄 압니다. 다 읽기 전에는 그리지 않게 알려 줍니다.
 */
export function useCoachSettings(legacyGuidance?: string) {
  const [settings, setSettings] = useState<CoachSettings>(defaultCoachSettings);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadCoachSettings(legacyGuidance).then((value) => {
      if (cancelled) return;
      setSettings(value);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [legacyGuidance]);

  /** 한 항목만 바꿉니다. 저장은 기다리지 않습니다 — 화면이 먼저 반응해야 합니다. */
  function update(patch: Partial<CoachSettings>) {
    setSettings((current) => {
      const next = { ...current, ...patch };
      void saveCoachSettings(next);
      return next;
    });
  }

  return { settings, ready, update };
}
