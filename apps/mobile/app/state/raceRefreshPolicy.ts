// 앱이 오래 백그라운드에 있었을 때만 대회 데이터를 다시 확인하는 기준을 제공합니다.
export const RACE_FOREGROUND_REFRESH_INTERVAL_MS = 10 * 60 * 1_000;

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
