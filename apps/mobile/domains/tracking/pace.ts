// 거리와 시간에서 페이스(분/km)를 만들고 사람이 읽는 문자열로 바꾸는 순수 계산기입니다.
import { metersToKilometers } from './geo';
import type { TrackAccumulator, TrackFilterOptions } from './filter';
import { defaultTrackFilterOptions } from './filter';

/** 이 페이스보다 느리면(1km에 20분 초과) 걷다 못해 멈춘 것으로 보고 표시하지 않습니다. */
export const slowestDisplayablePaceSecondsPerKm = 20 * 60;

/** 거리(미터)와 시간(초)에서 1km당 초를 구합니다. 계산할 수 없으면 undefined입니다. */
export function paceSecondsPerKm(meters: number, seconds: number): number | undefined {
  const kilometers = metersToKilometers(meters);
  if (kilometers <= 0 || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  const pace = seconds / kilometers;
  if (!Number.isFinite(pace) || pace <= 0) return undefined;
  return pace;
}

/** 세션 전체 거리·경과 시간으로 계산한 평균 페이스입니다. */
export function averagePaceSecondsPerKm(
  meters: number,
  elapsedSeconds: number,
): number | undefined {
  return paceSecondsPerKm(meters, elapsedSeconds);
}

/** 최근 구간만 모아 계산한 현재 페이스입니다. 최근 이동이 없으면 undefined입니다. */
export function currentPaceSecondsPerKm(
  accumulator: TrackAccumulator,
  options: TrackFilterOptions = defaultTrackFilterOptions,
): number | undefined {
  const segments = accumulator.recentSegments;
  if (segments.length === 0) return undefined;

  const meters = segments.reduce((total, segment) => total + segment.meters, 0);
  const millis = segments.reduce((total, segment) => total + segment.millis, 0);
  const pace = paceSecondsPerKm(meters, millis / 1_000);
  if (pace === undefined) return undefined;
  // 너무 느린 값은 "정지"에 가까우므로 숫자로 단정하지 않습니다.
  return pace > slowestDisplayablePaceSecondsPerKm ? undefined : pace;
}

/** 5'30" 형태로 표시합니다. 값이 없으면 측정 전 표시(--'--")를 돌려줍니다. */
export function formatPace(secondsPerKm?: number): string {
  if (secondsPerKm === undefined || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) {
    return `--'--"`;
  }
  const rounded = Math.round(secondsPerKm);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}'${String(seconds).padStart(2, '0')}"`;
}

/** 스크린리더가 자연스럽게 읽도록 페이스를 말로 풀어 줍니다. */
export function spokenPace(secondsPerKm?: number): string {
  if (secondsPerKm === undefined || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) {
    return '아직 측정 중';
  }
  const rounded = Math.round(secondsPerKm);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  if (seconds === 0) return `1킬로미터에 ${minutes}분`;
  return `1킬로미터에 ${minutes}분 ${seconds}초`;
}

/** 화면에 크게 띄우는 거리 문자열입니다. */
export function formatDistanceKm(meters: number): string {
  return metersToKilometers(meters).toFixed(2);
}

export function spokenDistanceKm(meters: number): string {
  const kilometers = metersToKilometers(meters);
  if (kilometers < 0.01) return '0킬로미터';
  return `${kilometers.toFixed(2)}킬로미터`;
}
