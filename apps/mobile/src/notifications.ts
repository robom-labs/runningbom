// 접수 시작 로컬 알림의 권한, 중복 제거, 예약을 안전하게 처리합니다.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Race } from './types';

const CHANNEL_ID = 'registration-start';
const NOTIFICATION_FAMILY = 'runningbom-registration';

export type ScheduleResult =
  | { kind: 'scheduled'; identifier: string }
  | { kind: 'denied' }
  | { kind: 'past' }
  | { kind: 'time-unconfirmed' };

export type ScheduledRegistration = {
  raceId: string;
  alertKey: string;
  identifier: string;
};

function registrationAlertKey(race: Race): string {
  const windows = (race.registrationWindows ?? [])
    .map((window) => `${window.distance ?? 'all'}:${window.opensAt}:${window.closesAt ?? ''}`)
    .sort()
    .join('|');
  return `${race.id}:${race.registrationOpensAt}:${windows}`;
}

function isOwnedRegistration(notification: Notifications.NotificationRequest): boolean {
  const data = notification.content.data;
  return data?.notificationFamily === NOTIFICATION_FAMILY || typeof data?.raceId === 'string';
}

function canKeepRegistrationAlert(race: Race, now = Date.now()): boolean {
  const opensAt = new Date(race.registrationOpensAt).getTime();
  const closesAt = race.registrationClosesAt ? new Date(race.registrationClosesAt).getTime() : Number.NaN;
  return (
    race.registrationTimeConfirmed &&
    Number.isFinite(opensAt) &&
    opensAt > now &&
    !['cancelled', 'postponed', 'sold_out', 'closed', 'open'].includes(race.registrationStatus ?? '') &&
    (!Number.isFinite(closesAt) || closesAt > now)
  );
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function configureNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: '접수 시작 알림',
    description: '선택한 러닝 대회의 접수 시작 시각을 알려줍니다.',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 200, 250],
    lightColor: '#E35D52',
  });
}

async function notificationPermissionGranted(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (allowsNotifications(current)) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return allowsNotifications(requested);
}

function allowsNotifications(status: Notifications.NotificationPermissionsStatus): boolean {
  if (Platform.OS !== 'ios') {
    return status.granted;
  }

  const iosStatus = status.ios?.status;
  return (
    status.granted ||
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

export async function scheduleRegistrationNotification(race: Race): Promise<ScheduleResult> {
  if (!race.registrationTimeConfirmed) {
    return { kind: 'time-unconfirmed' };
  }

  const fireAt = new Date(race.registrationOpensAt);
  if (!Number.isFinite(fireAt.getTime()) || fireAt.getTime() <= Date.now()) {
    return { kind: 'past' };
  }

  if (!(await notificationPermissionGranted())) {
    return { kind: 'denied' };
  }

  await configureNotificationChannel();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const duplicates = scheduled.filter(
    (notification) => isOwnedRegistration(notification) && notification.content.data?.raceId === race.id,
  );
  await Promise.all(
    duplicates.map((notification) =>
      Notifications.cancelScheduledNotificationAsync(notification.identifier),
    ),
  );

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${race.name} 접수가 시작됐어요`,
      body: '러닝봄에서 공식 접수 페이지를 확인하세요.',
      sound: 'default',
      data: {
        raceId: race.id,
        alertKey: registrationAlertKey(race),
        notificationFamily: NOTIFICATION_FAMILY,
        deepLink: `runningbom://race/${race.id}`,
        ...(race.officialUrl ? { officialUrl: race.officialUrl } : {}),
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
      channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
    },
  });

  return { kind: 'scheduled', identifier };
}

export async function getScheduledRegistrationAlerts(): Promise<ScheduledRegistration[]> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.flatMap((notification) => {
    if (!isOwnedRegistration(notification)) return [];
    const raceId = notification.content.data?.raceId;
    if (typeof raceId !== 'string') return [];
    const alertKey = typeof notification.content.data?.alertKey === 'string'
      ? notification.content.data.alertKey
      : `${raceId}:legacy`;
    return [{ raceId, alertKey, identifier: notification.identifier }];
  });
}

export async function cancelRegistrationNotification(raceId: string): Promise<number> {
  const scheduled = await getScheduledRegistrationAlerts();
  const targets = scheduled.filter((notification) => notification.raceId === raceId);
  await Promise.all(targets.map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)));
  return targets.length;
}

// 원격 데이터 변경 뒤 사용자가 예약한 항목만 유지·재무장하고 고아 알림은 제거합니다.
export async function reconcileRegistrationNotifications(races: Race[]): Promise<ScheduledRegistration[]> {
  const scheduled = await getScheduledRegistrationAlerts();
  const byRaceId = new Map(races.map((race) => [race.id, race]));
  const rearm = new Map<string, Race>();

  await Promise.all(scheduled.map(async (notification) => {
    const race = byRaceId.get(notification.raceId);
    if (!race || !canKeepRegistrationAlert(race) || notification.alertKey !== registrationAlertKey(race)) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      if (race && canKeepRegistrationAlert(race)) rearm.set(race.id, race);
    }
  }));

  for (const race of rearm.values()) {
    await scheduleRegistrationNotification(race);
  }

  return getScheduledRegistrationAlerts();
}
