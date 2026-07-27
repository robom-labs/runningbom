// 회고를 이 기기에 저장합니다.
//
// 활동 기록 자체는 건드리지 않습니다. **새 열쇠에 따로 담습니다.**
// 기존 저장 값을 마이그레이션 없이 바꾸지 않는다는 회사 규칙 때문이고,
// 실제로도 회고는 없어도 모든 화면이 그대로 동작해야 합니다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import {
  adjustFromRetrospects,
  bodyTags,
  effortChoices,
  type BodyTagId,
  type EffortId,
  type Retrospect,
  type SuggestionAdjust,
} from './retrospect';

export const RETROSPECT_STORE_KEY = 'runningbom.retrospect.v1';

/** 최근 것만 씁니다. 다 쌓아 두면 저장만 늘고 판단은 그대로입니다. */
export const MAX_RETROSPECTS = 30;

export type StoredRetrospect = Retrospect & {
  /** 어느 활동에 대한 회고인지입니다. 없으면 그냥 그날의 회고입니다. */
  activityId?: string;
  savedAt: string;
};

const effortIds = new Set<string>(effortChoices.map((choice) => choice.id));
const tagIds = new Set<string>(bodyTags.map((tag) => tag.id));

/** 저장 값이 깨졌거나 옛날 형식이어도 앱이 죽지 않게 걸러 냅니다. */
export function parseRetrospects(raw: unknown): StoredRetrospect[] {
  if (!Array.isArray(raw)) return [];
  const parsed: StoredRetrospect[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const value = item as Record<string, unknown>;
    if (typeof value.effort !== 'string' || !effortIds.has(value.effort)) continue;
    const tags = Array.isArray(value.bodyTagIds)
      ? value.bodyTagIds.filter(
          (tag): tag is BodyTagId => typeof tag === 'string' && tagIds.has(tag),
        )
      : [];
    parsed.push({
      effort: value.effort as EffortId,
      bodyTagIds: tags,
      savedAt: typeof value.savedAt === 'string' ? value.savedAt : '',
      ...(typeof value.activityId === 'string' ? { activityId: value.activityId } : {}),
    });
  }
  return parsed.slice(0, MAX_RETROSPECTS);
}

/** 새 회고를 앞에 넣습니다. 같은 활동에 두 번 쓰면 뒤엣것으로 바꿉니다. */
export function addRetrospect(
  current: StoredRetrospect[],
  next: StoredRetrospect,
): StoredRetrospect[] {
  const without = next.activityId
    ? current.filter((item) => item.activityId !== next.activityId)
    : current;
  return [next, ...without].slice(0, MAX_RETROSPECTS);
}

export type RetrospectState = {
  ready: boolean;
  items: StoredRetrospect[];
  /** 최근 회고에서 나온 오늘 제안 조정입니다. */
  adjust: SuggestionAdjust;
  save: (value: Retrospect & { activityId?: string }) => Promise<void>;
};

export function useRetrospects(): RetrospectState {
  const [items, setItems] = useState<StoredRetrospect[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(RETROSPECT_STORE_KEY)
      .then((raw) => {
        if (!active) return;
        if (raw) {
          try {
            setItems(parseRetrospects(JSON.parse(raw)));
          } catch {
            // 깨졌으면 회고가 없는 상태로 둡니다. 앱은 그대로 돌아갑니다.
          }
        }
        setReady(true);
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = useCallback(async (value: Retrospect & { activityId?: string }) => {
    const entry: StoredRetrospect = {
      effort: value.effort,
      bodyTagIds: value.bodyTagIds,
      savedAt: new Date().toISOString(),
      ...(value.activityId ? { activityId: value.activityId } : {}),
    };
    let next: StoredRetrospect[] = [];
    setItems((current) => {
      next = addRetrospect(current, entry);
      return next;
    });
    try {
      await AsyncStorage.setItem(RETROSPECT_STORE_KEY, JSON.stringify(next));
    } catch {
      // 저장이 안 돼도 이번 실행 동안은 반영됩니다. 회고 하나 때문에 화면이 막히면 안 됩니다.
    }
  }, []);

  return {
    ready,
    items,
    adjust: adjustFromRetrospects({ recent: items }),
    save,
  };
}
