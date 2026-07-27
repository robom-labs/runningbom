// 달리는 화면을 어둡게 할지 정하는 순수 판단입니다. 다른 화면 색은 절대 바꾸지 않습니다.
// 새 라이브러리 없이, 우리나라(위도 37도쯤) 기준 달마다 해 뜨고 지는 대략 시각으로만 판단합니다.
import type { NightModeSetting } from '../../../services/storage/runPreferences';

/** 달(1~12)마다 해가 지는 대략 시각(시). 실제와 20분쯤 차이가 날 수 있습니다. */
const sunsetHourByMonth: readonly number[] = [
  17.5, 18.1, 18.6, 19.1, 19.5, 19.8, 19.8, 19.3, 18.6, 18.0, 17.4, 17.2,
];

/** 달마다 해가 뜨는 대략 시각(시)입니다. */
const sunriseHourByMonth: readonly number[] = [
  7.7, 7.3, 6.7, 6.0, 5.4, 5.2, 5.4, 5.8, 6.2, 6.6, 7.1, 7.6,
];

/** 1~12월과 0~24 사이 시각을 받아 "해가 진 뒤인지" 알려 줍니다. */
export function isNightHour(month: number, hour: number): boolean {
  const index = Math.min(11, Math.max(0, Math.round(month) - 1));
  const sunset = sunsetHourByMonth[index] ?? 18;
  const sunrise = sunriseHourByMonth[index] ?? 7;
  return hour >= sunset || hour < sunrise;
}

/** 기기 시계로 지금이 해가 진 뒤인지 봅니다. */
export function isNightNow(now: Date = new Date()): boolean {
  return isNightHour(now.getMonth() + 1, now.getHours() + now.getMinutes() / 60);
}

/** 설정과 지금 시각으로 달리는 화면을 어둡게 할지 정합니다. */
export function shouldUseNightMode(setting: NightModeSetting, now: Date = new Date()): boolean {
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  return isNightNow(now);
}

/** 설정 화면에 지금 어떻게 보이는지 한 줄로 알려 줍니다. */
export function nightModeStatusText(setting: NightModeSetting, now: Date = new Date()): string {
  if (setting === 'off') return '지금은 달리는 화면이 밝게 보여요.';
  if (setting === 'on') return '지금은 달리는 화면이 어둡게 보여요.';
  return isNightNow(now)
    ? '해가 진 시간이라 지금은 달리는 화면이 어둡게 보여요.'
    : '아직 해가 있어 지금은 달리는 화면이 밝게 보여요.';
}
