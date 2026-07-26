// 대회 원격 데이터와 로컬 접수 알림 상태를 한 번만 초기화해 모든 화면에 제공합니다.
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Constants from 'expo-constants';

import {
  bundledRevision,
  formatRegistrationTime,
  raceFeedFromRecords,
  races,
  shouldReplaceRaceFeed,
} from '../../src/races';
import {
  cancelRegistrationNotification,
  configureNotificationChannel,
  getScheduledRegistrationAlerts,
  reconcileRegistrationNotifications,
  scheduleRegistrationNotification,
} from '../../src/notifications';
import type { Race } from '../../src/types';
import { loadRunningbomStaticData } from '../../services/static-data';

const appVersion = Constants.expoConfig?.version ?? '0.19.0';
const staticDataBaseUrl =
  process.env.EXPO_PUBLIC_STATIC_DATA_URL ??
  'https://robom-labs.github.io/runningbom/data/';

type RaceStateValue = {
  feed: { revision: string; races: Race[] };
  notice: string;
  loading: boolean;
  scheduledRaceIds: Record<string, string>;
  busyRaceId: string | null;
  refresh: () => Promise<void>;
  scheduleAlert: (race: Race) => Promise<void>;
  cancelAlert: (race: Race) => Promise<void>;
};

const defaultNotice =
  '알림 권한이 없어도 지역·거리 선택과 공식 대회 링크는 계속 사용할 수 있어요.';

const RaceStateContext = createContext<RaceStateValue>({
  feed: { revision: bundledRevision, races },
  notice: defaultNotice,
  loading: false,
  scheduledRaceIds: {},
  busyRaceId: null,
  refresh: async () => undefined,
  scheduleAlert: async () => undefined,
  cancelAlert: async () => undefined,
});

function scheduledMap(
  values: Awaited<ReturnType<typeof getScheduledRegistrationAlerts>>,
): Record<string, string> {
  return Object.fromEntries(values.map((notification) => [
    notification.raceId,
    notification.identifier,
  ]));
}

export function RaceStateProvider({ children }: PropsWithChildren) {
  const [feed, setFeed] = useState({ revision: bundledRevision, races });
  const [notice, setNotice] = useState(defaultNotice);
  const [loading, setLoading] = useState(false);
  const [scheduledRaceIds, setScheduledRaceIds] = useState<Record<string, string>>({});
  const [busyRaceId, setBusyRaceId] = useState<string | null>(null);

  const loadLatest = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const snapshot = await loadRunningbomStaticData({
        appVersion,
        baseUrl: staticDataBaseUrl,
        signal,
      });
      const raceDataset = snapshot.datasets['races.json'];
      const latest = raceFeedFromRecords(raceDataset.contentVersion, raceDataset.records);
      if (signal?.aborted) return;
      setFeed((current) => (shouldReplaceRaceFeed(current, latest) ? latest : current));
      const scheduled = await reconcileRegistrationNotifications(latest.races);
      if (signal?.aborted) return;
      setScheduledRaceIds(scheduledMap(scheduled));
      if (snapshot.source === 'remote') {
        setNotice('운영 데이터로 최신 접수 상태를 확인했어요.');
      } else if (snapshot.source === 'lkg') {
        setNotice('마지막으로 검증된 저장 데이터로 접수 상태를 확인했어요.');
      } else {
        setNotice('설치된 검증 데이터로 접수 상태를 확인했어요.');
      }
    } catch {
      if (signal?.aborted) return;
      setNotice('최신 데이터를 불러오지 못해 설치된 검증 데이터를 사용하고 있어요.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void configureNotificationChannel().catch(() => {
      setNotice('알림 채널을 준비하지 못했지만 대회 탐색은 계속 사용할 수 있어요.');
    });
    void getScheduledRegistrationAlerts()
      .then((scheduled) => {
        if (!controller.signal.aborted) setScheduledRaceIds(scheduledMap(scheduled));
      })
      .catch(() => undefined);
    void loadLatest(controller.signal);
    return () => controller.abort();
  }, [loadLatest]);

  const scheduleAlert = useCallback(async (race: Race) => {
    setBusyRaceId(race.id);
    try {
      const result = await scheduleRegistrationNotification(race);
      if (result.kind === 'scheduled') {
        setScheduledRaceIds((current) => ({ ...current, [race.id]: result.identifier }));
        setNotice(`${race.name} 접수 알림을 ${formatRegistrationTime(race)}에 예약했어요.`);
      } else if (result.kind === 'denied') {
        setNotice('알림 권한이 거부됐어요. 대회 탐색과 공식 링크는 그대로 사용할 수 있어요.');
      } else if (result.kind === 'time-unconfirmed') {
        setNotice('공식 접수 시각이 확인된 대회만 정확한 알림을 예약할 수 있어요.');
      } else {
        setNotice('접수 시작 시각이 이미 지나 알림을 예약하지 않았어요.');
      }
    } catch {
      setNotice('알림 예약 중 오류가 발생했어요. 잠시 뒤 다시 시도해 주세요.');
    } finally {
      setBusyRaceId(null);
    }
  }, []);

  const cancelAlert = useCallback(async (race: Race) => {
    setBusyRaceId(race.id);
    try {
      const count = await cancelRegistrationNotification(race.id);
      setScheduledRaceIds((current) => {
        const next = { ...current };
        delete next[race.id];
        return next;
      });
      setNotice(count > 0 ? `${race.name} 접수 알림을 취소했어요.` : '취소할 접수 알림이 없어요.');
    } catch {
      setNotice('알림 취소 중 오류가 발생했어요.');
    } finally {
      setBusyRaceId(null);
    }
  }, []);

  const value = useMemo<RaceStateValue>(
    () => ({
      feed,
      notice,
      loading,
      scheduledRaceIds,
      busyRaceId,
      refresh: async () => loadLatest(),
      scheduleAlert,
      cancelAlert,
    }),
    [
      busyRaceId,
      cancelAlert,
      feed,
      loadLatest,
      loading,
      notice,
      scheduleAlert,
      scheduledRaceIds,
    ],
  );

  return <RaceStateContext.Provider value={value}>{children}</RaceStateContext.Provider>;
}

export function useRaceState(): RaceStateValue {
  return useContext(RaceStateContext);
}
