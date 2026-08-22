// 앱이 오래 백그라운드에 있었을 때만 대회 데이터를 다시 확인하는 기준을 제공합니다.
export const RACE_FOREGROUND_REFRESH_INTERVAL_MS = 10 * 60 * 1_000;
const KST_DAY_MS = 24 * 60 * 60 * 1_000;

// 자정 이후 이전 날짜 대회가 남지 않도록 다음 한국 날짜 전환까지의 대기 시간을 계산합니다.
export function millisecondsUntilNextKstDay(now = Date.now()): number {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(now));
  const nextMidnight = Date.parse(`${today}T00:00:00+09:00`) + KST_DAY_MS;
  return Math.max(1, nextMidnight - now);
}

export function shouldRefreshRaceDataAfterBackground(
  backgroundedAt: number | null,
  now = Date.now(),
): boolean {
  return (
    backgroundedAt !== null &&
    Number.isFinite(backgroundedAt) &&
    Number.isFinite(now) &&
    now - backgroundedAt >= RACE_FOREGROUND_REFRESH_INTERVAL_MS
  );
}
