// 러닝 세션 동안 포그라운드 GPS를 구독해 거리·페이스·구간·경로를 화면에 공급하는 훅입니다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ActivityRoutePoint, ActivitySplit } from '../activities/types';
import {
  AUTO_PAUSE_SIGNAL_GAP_MILLIS,
  autoPauseStatus,
  initialAutoPauseState,
  sameAutoPauseState,
  speedKmhFromFixes,
  updateAutoPause,
  type AutoPauseEvent,
  type AutoPauseLevel,
  type AutoPauseState,
  type AutoPauseStatus,
} from './autoPause';
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
  activateRunKeepAwake,
  deactivateRunKeepAwake,
  keepAwakeNotice,
} from './keepAwake';
import {
  appendRouteFix,
  emptyRouteState,
  routePointsForActivity,
  type RouteState,
} from './route';
import {
  trackedDistanceForActivity,
  trackingNotice,
  trackingSnapshot,
  type TrackingNotice,
  type TrackingPermissionState,
  type TrackingSnapshot,
} from './session';
import {
  advanceSplits,
  finalSplits,
  initialSplitState,
  trailingSplit,
  type SplitState,
} from './splits';
import {
  requestForegroundTracking,
  watchForegroundPosition,
  type LocationSubscriptionLike,
} from './tracker';

/** 세션이 끝났을 때 활동 기록에 덧붙일 선택 필드입니다. 값이 없으면 아예 넣지 않습니다. */
export type TrackedActivityExtras = {
  distanceKm?: number;
  splits?: ActivitySplit[];
  routePoints?: ActivityRoutePoint[];
};

/** 자동 멈춤이 지금 어떤 상태인지 화면에 그대로 넘겨 주는 값입니다. */
export type RunAutoPause = {
  level: AutoPauseLevel;
  state: AutoPauseState;
  /** 지금 자동으로 멈춘 상태인지. */
  paused: boolean;
  /** 신호가 없어 판정을 쉬는 중인지. */
  searching: boolean;
  /** 화면에 보여 줄 한 줄. 보여 줄 것이 없으면 undefined. */
  status?: AutoPauseStatus;
  /** 방금 일어난 변화입니다. atMillis가 바뀔 때만 화면이 반응합니다. */
  change?: { event: AutoPauseEvent; atMillis: number };
};

export type RunTracking = {
  /** 이 빌드에서 GPS UI를 보여도 되는지 (Preview 전용) */
  supported: boolean;
  permission: TrackingPermissionState;
  snapshot: TrackingSnapshot;
  /** 빈 상태·오류 안내. 정상이면 undefined입니다. */
  notice?: TrackingNotice;
  /** 새로 도달한 거리 안내 문장. 화면이 코치 멘트 옆에 덧붙여 보여 줍니다. */
  distanceCueText?: string;
  /** 확정된 1km 구간들(오래된 순). 화면은 최근 구간부터 뒤집어 보여 줍니다. */
  splits: ActivitySplit[];
  /** 아직 1km를 채우지 못한 진행 중 구간입니다. */
  currentSplit?: ActivitySplit;
  /** 지금까지 저장한 경로 좌표 수입니다(지도 없이 개수만 표시). */
  routePointCount: number;
  /** 화면 꺼짐 방지가 켜져 있는지. */
  screenAwake: boolean;
  /** 화면이 꺼지지 않는다는 안내. 세션당 한 번만 값이 생깁니다. */
  screenAwakeNotice?: string;
  /** 신호등에서 멈췄을 때 스스로 기록을 멈추는 기능의 지금 상태입니다. */
  autoPause: RunAutoPause;
  /** 세션 종료 시 활동 기록에 넣을 거리(km). 신뢰할 수 없으면 undefined. */
  distanceKmForActivity: () => number | undefined;
  /** 세션 종료 시 활동 기록에 덧붙일 거리·구간·경로입니다. */
  activityExtras: () => TrackedActivityExtras;
  reset: () => void;
};

export type RunTrackingOptions = {
  /** 자동 멈춤 단계입니다. 'off'면 판정 자체를 하지 않습니다. */
  autoPauseLevel?: AutoPauseLevel;
};

/**
 * @param active 세션이 살아 있는지(진행 중 + 일시정지). GPS 구독 여부를 정합니다.
 * @param running 지금 실제로 달리는 중인지. 화면 꺼짐 방지는 이 값에만 반응합니다.
 * @param options 자동 멈춤 같은 사용자 설정입니다.
 */
export function useRunTracking(
  active: boolean,
  running: boolean = active,
  options: RunTrackingOptions = {},
): RunTracking {
  const autoPauseLevel: AutoPauseLevel = options.autoPauseLevel ?? 'off';
  const supported = useMemo(() => gpsTrackingEnabled(), []);
  const [permission, setPermission] = useState<TrackingPermissionState>(
    supported ? 'undetermined' : 'unsupported',
  );
  const [accumulator, setAccumulator] = useState<TrackAccumulator>(emptyTrackAccumulator);
  const [nowMillis, setNowMillis] = useState(() => Date.now());
  const [distanceCueText, setDistanceCueText] = useState<string>();
  const [splits, setSplits] = useState<ActivitySplit[]>([]);
  const [currentSplit, setCurrentSplit] = useState<ActivitySplit>();
  const [routePointCount, setRoutePointCount] = useState(0);
  const [screenAwake, setScreenAwake] = useState(false);
  const [screenAwakeNotice, setScreenAwakeNotice] = useState<string>();
  const [autoPauseState, setAutoPauseState] = useState<AutoPauseState>(initialAutoPauseState);
  const [autoPauseChange, setAutoPauseChange] = useState<{
    event: AutoPauseEvent;
    atMillis: number;
  }>();
  const autoPauseStateRef = useRef<AutoPauseState>(initialAutoPauseState);
  /** 스스로 멈춰 있던 시간입니다. 평균 페이스가 신호등 때문에 나빠지지 않도록 빼 줍니다. */
  const autoPausedMillisRef = useRef(0);
  const previousFixRef = useRef<LocationFix | undefined>(undefined);
  const speedSampleRef = useRef<{ kmh: number; atMillis: number } | undefined>(undefined);
  const cueStateRef = useRef<DistanceCueState>(initialDistanceCueState);
  const splitStateRef = useRef<SplitState>(initialSplitState);
  const routeStateRef = useRef<RouteState>(emptyRouteState);
  const startedAtRef = useRef<number | undefined>(undefined);
  const awakeNoticeShownRef = useRef(false);

  const reset = useCallback(() => {
    setAccumulator(emptyTrackAccumulator);
    setDistanceCueText(undefined);
    setSplits([]);
    setCurrentSplit(undefined);
    setRoutePointCount(0);
    setAutoPauseState(initialAutoPauseState);
    setAutoPauseChange(undefined);
    autoPauseStateRef.current = initialAutoPauseState;
    autoPausedMillisRef.current = 0;
    previousFixRef.current = undefined;
    speedSampleRef.current = undefined;
    cueStateRef.current = initialDistanceCueState;
    splitStateRef.current = initialSplitState;
    routeStateRef.current = emptyRouteState;
    startedAtRef.current = undefined;
    awakeNoticeShownRef.current = false;
    setScreenAwakeNotice(undefined);
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
        // 자동 멈춤은 걸러지기 전 좌표에서 속도만 따로 봅니다(거리 누적 규칙은 그대로 둡니다).
        const speedKmh = speedKmhFromFixes(previousFixRef.current, fix);
        previousFixRef.current = fix;
        if (speedKmh !== undefined) {
          speedSampleRef.current = { kmh: speedKmh, atMillis: Date.now() };
        }
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

  // 러닝이 실제로 진행 중일 때만 화면을 깨워 둡니다.
  // 일시정지·종료·언마운트 어느 쪽으로 빠져나가도 정리 함수가 반드시 해제합니다(잠금 누수 금지).
  useEffect(() => {
    if (!running) return;

    let cancelled = false;
    void activateRunKeepAwake().then((activated) => {
      if (cancelled) {
        // 켜지는 사이에 세션이 끝났다면 바로 되돌립니다.
        if (activated) deactivateRunKeepAwake();
        return;
      }
      setScreenAwake(activated);
      if (activated && !awakeNoticeShownRef.current) {
        awakeNoticeShownRef.current = true;
        setScreenAwakeNotice(keepAwakeNotice);
      }
    });

    return () => {
      cancelled = true;
      deactivateRunKeepAwake();
      setScreenAwake(false);
    };
  }, [running]);

  // 자동 멈춤은 1초마다 판정합니다. 좌표가 끊겨도 판정이 멈추지 않도록 시계로 돌립니다.
  useEffect(() => {
    if (!supported || !active || permission !== 'granted' || autoPauseLevel === 'off') {
      if (autoPauseStateRef.current !== initialAutoPauseState) {
        autoPauseStateRef.current = initialAutoPauseState;
        setAutoPauseState(initialAutoPauseState);
      }
      return;
    }

    const timer = setInterval(() => {
      const now = Date.now();
      // 이미 멈춰 있던 1초는 달린 시간에서 뺍니다(평균 페이스 보호).
      if (autoPauseStateRef.current.phase === 'paused') {
        autoPausedMillisRef.current += 1_000;
      }
      const sample = speedSampleRef.current;
      // 마지막 속도가 너무 오래됐으면 "멈춤"이 아니라 "신호를 찾는 중"으로 다룹니다.
      const fresh = sample !== undefined && now - sample.atMillis <= AUTO_PAUSE_SIGNAL_GAP_MILLIS;
      const result = updateAutoPause(
        autoPauseStateRef.current,
        { timestampMillis: now, ...(fresh && sample ? { speedKmh: sample.kmh } : {}) },
        autoPauseLevel,
      );
      if (!sameAutoPauseState(autoPauseStateRef.current, result.state)) {
        autoPauseStateRef.current = result.state;
        setAutoPauseState(result.state);
      }
      if (result.event) setAutoPauseChange({ event: result.event, atMillis: now });
    }, 1_000);

    return () => clearInterval(timer);
  }, [active, autoPauseLevel, permission, supported]);

  // 좌표가 한동안 안 들어와도 신호 표시가 낡지 않도록 주기적으로 시각을 갱신합니다.
  useEffect(() => {
    if (!supported || !active || permission !== 'granted') return;
    const timer = setInterval(() => setNowMillis(Date.now()), 2_000);
    return () => clearInterval(timer);
  }, [active, permission, supported]);

  const elapsedSeconds = startedAtRef.current
    ? Math.max(
        0,
        Math.floor((nowMillis - startedAtRef.current - autoPausedMillisRef.current) / 1_000),
      )
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

  // 구간(랩)과 경로 좌표는 잡음 필터를 통과한 좌표(anchor)만 기준으로 쌓습니다.
  useEffect(() => {
    if (!supported || permission !== 'granted') return;
    const startedAt = startedAtRef.current;
    if (!startedAt) return;

    const anchor = accumulator.anchor;
    if (anchor) {
      const nextRoute = appendRouteFix(routeStateRef.current, anchor);
      if (nextRoute !== routeStateRef.current) {
        routeStateRef.current = nextRoute;
        setRoutePointCount(nextRoute.points.length);
      }
    }

    // 마지막으로 인정된 좌표가 찍힌 시각을 기준으로 구간 시간을 확정합니다.
    const atMillis = anchor?.timestampMillis ?? Date.now();
    // 구간 시간도 스스로 멈춰 있던 시간을 뺀 값으로 셉니다.
    const measuredSeconds = Math.max(
      0,
      (atMillis - startedAt - autoPausedMillisRef.current) / 1_000,
    );
    const nextSplitState = advanceSplits(
      splitStateRef.current,
      accumulator.distanceMeters,
      measuredSeconds,
    );
    if (nextSplitState !== splitStateRef.current) {
      const changed = nextSplitState.completed !== splitStateRef.current.completed;
      splitStateRef.current = nextSplitState;
      if (changed) setSplits(nextSplitState.completed);
    }
    setCurrentSplit(
      trailingSplit(splitStateRef.current, accumulator.distanceMeters, measuredSeconds),
    );
  }, [accumulator, permission, supported]);

  const notice = useMemo(
    () => trackingNotice({ supported, permission, signal: snapshot.signal }),
    [permission, snapshot.signal, supported],
  );

  const autoPause = useMemo<RunAutoPause>(() => {
    const status = autoPauseStatus(autoPauseState, autoPauseLevel, nowMillis);
    return {
      level: autoPauseLevel,
      state: autoPauseState,
      paused: autoPauseLevel !== 'off' && autoPauseState.phase === 'paused',
      searching: autoPauseLevel !== 'off' && autoPauseState.searching,
      ...(status === undefined ? {} : { status }),
      ...(autoPauseChange === undefined ? {} : { change: autoPauseChange }),
    };
  }, [autoPauseChange, autoPauseLevel, autoPauseState, nowMillis]);

  const distanceKmForActivity = useCallback(
    () => trackedDistanceForActivity(snapshot),
    [snapshot],
  );

  const activityExtras = useCallback((): TrackedActivityExtras => {
    if (!snapshot.measuring) return {};
    const distanceKm = trackedDistanceForActivity(snapshot);
    const splitList = finalSplits(
      splitStateRef.current,
      snapshot.distanceMeters,
      splitStateRef.current.sampleSeconds,
    );
    const routePoints = routePointsForActivity(routeStateRef.current);
    return {
      ...(distanceKm === undefined ? {} : { distanceKm }),
      ...(splitList === undefined ? {} : { splits: splitList }),
      ...(routePoints === undefined ? {} : { routePoints }),
    };
  }, [snapshot]);

  return {
    supported,
    permission,
    snapshot,
    ...(notice === undefined ? {} : { notice }),
    ...(distanceCueText === undefined ? {} : { distanceCueText }),
    splits,
    ...(currentSplit === undefined ? {} : { currentSplit }),
    routePointCount,
    screenAwake,
    ...(screenAwakeNotice === undefined ? {} : { screenAwakeNotice }),
    autoPause,
    distanceKmForActivity,
    activityExtras,
    reset,
  };
}
