// 러닝 세션 동안 포그라운드 GPS를 구독해 거리·페이스 스냅샷을 화면에 공급하는 훅입니다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { gpsTrackingEnabled } from './availability';
import {
  advanceDistanceCueState,
  initialDistanceCueState,
  nextDistanceCue,
  type DistanceCueState,
} from './cues';
import {
  acceptFix,
  defaultTrackFilterOptions,
  emptyTrackAccumulator,
  type LocationFix,
  type TrackAccumulator,
} from './filter';
import {
  trackedDistanceForActivity,
  trackingSnapshot,
  type TrackingPermissionState,
  type TrackingSnapshot,
} from './session';
import {
  requestForegroundTracking,
  watchForegroundPosition,
  type LocationSubscriptionLike,
} from './tracker';

export type RunTracking = {
  /** 이 빌드에서 GPS UI를 보여도 되는지 (Preview 전용) */
  supported: boolean;
  permission: TrackingPermissionState;
  snapshot: TrackingSnapshot;
  /** 새로 도달한 거리 안내 문장. 화면이 코치 멘트 옆에 덧붙여 보여 줍니다. */
  distanceCueText?: string;
  /** 세션 종료 시 활동 기록에 넣을 거리(km). 신뢰할 수 없으면 undefined. */
  distanceKmForActivity: () => number | undefined;
  reset: () => void;
};

export function useRunTracking(active: boolean): RunTracking {
  const supported = useMemo(() => gpsTrackingEnabled(), []);
  const [permission, setPermission] = useState<TrackingPermissionState>(
    supported ? 'undetermined' : 'unsupported',
  );
  const [accumulator, setAccumulator] = useState<TrackAccumulator>(emptyTrackAccumulator);
  const [nowMillis, setNowMillis] = useState(() => Date.now());
  const [distanceCueText, setDistanceCueText] = useState<string>();
  const cueStateRef = useRef<DistanceCueState>(initialDistanceCueState);
  const startedAtRef = useRef<number | undefined>(undefined);

  const reset = useCallback(() => {
    setAccumulator(emptyTrackAccumulator);
    setDistanceCueText(undefined);
    cueStateRef.current = initialDistanceCueState;
    startedAtRef.current = undefined;
    setPermission(supported ? 'undetermined' : 'unsupported');
  }, [supported]);

  useEffect(() => {
    if (!supported || !active) return;

    let cancelled = false;
    let subscription: LocationSubscriptionLike | undefined;

    setPermission('requesting');
    startedAtRef.current = Date.now();

    void (async () => {
      const granted = await requestForegroundTracking();
      if (cancelled) return;
      setPermission(granted);
      // 권한 거부·위치 서비스 꺼짐은 오류가 아니라 "거리 측정 없음"으로만 이어집니다.
      if (granted !== 'granted') return;

      subscription = await watchForegroundPosition((fix: LocationFix) => {
        setAccumulator((current) => acceptFix(current, fix, defaultTrackFilterOptions));
        setNowMillis(Date.now());
      });
      if (cancelled) {
        subscription?.remove();
        subscription = undefined;
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [active, supported]);

  // 좌표가 한동안 안 들어와도 신호 표시가 낡지 않도록 주기적으로 시각을 갱신합니다.
  useEffect(() => {
    if (!supported || !active || permission !== 'granted') return;
    const timer = setInterval(() => setNowMillis(Date.now()), 2_000);
    return () => clearInterval(timer);
  }, [active, permission, supported]);

  const elapsedSeconds = startedAtRef.current
    ? Math.max(0, Math.floor((nowMillis - startedAtRef.current) / 1_000))
    : 0;

  const snapshot = useMemo(
    () =>
      trackingSnapshot({
        permission,
        accumulator,
        elapsedSeconds,
        nowMillis,
      }),
    [accumulator, elapsedSeconds, nowMillis, permission],
  );

  useEffect(() => {
    if (!snapshot.measuring) return;
    const cue = nextDistanceCue(
      cueStateRef.current,
      snapshot.distanceMeters,
      snapshot.currentPaceSecondsPerKm,
    );
    if (!cue) return;
    cueStateRef.current = advanceDistanceCueState(cueStateRef.current, cue);
    setDistanceCueText(cue.text);
  }, [snapshot]);

  const distanceKmForActivity = useCallback(
    () => trackedDistanceForActivity(snapshot),
    [snapshot],
  );

  return {
    supported,
    permission,
    snapshot,
    ...(distanceCueText === undefined ? {} : { distanceCueText }),
    distanceKmForActivity,
    reset,
  };
}
