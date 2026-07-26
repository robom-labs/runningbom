// 두 GPS 좌표 사이의 지표면 거리를 구하는 순수 Haversine 계산기입니다.

/** 지구 평균 반지름(미터). IUGG 권장값입니다. */
export const EARTH_RADIUS_METERS = 6_371_008.8;

export type GeoPoint = {
  latitudeDeg: number;
  longitudeDeg: number;
};

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** 위·경도가 실제 지구 좌표 범위 안의 유한한 숫자인지 확인합니다. */
export function isValidGeoPoint(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.latitudeDeg) &&
    Number.isFinite(point.longitudeDeg) &&
    Math.abs(point.latitudeDeg) <= 90 &&
    Math.abs(point.longitudeDeg) <= 180
  );
}

/** 두 좌표 사이의 대원 거리(미터)를 반환합니다. 잘못된 좌표는 0으로 처리합니다. */
export function haversineMeters(from: GeoPoint, to: GeoPoint): number {
  if (!isValidGeoPoint(from) || !isValidGeoPoint(to)) return 0;

  const latitudeDelta = toRadians(to.latitudeDeg - from.latitudeDeg);
  const longitudeDelta = toRadians(to.longitudeDeg - from.longitudeDeg);
  const fromLatitude = toRadians(from.latitudeDeg);
  const toLatitude = toRadians(to.latitudeDeg);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));

  return EARTH_RADIUS_METERS * c;
}

/** 여러 좌표를 순서대로 이은 총 거리(미터)입니다. 필터를 거치지 않은 원본 합계입니다. */
export function polylineMeters(points: readonly GeoPoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += haversineMeters(points[index - 1]!, points[index]!);
  }
  return total;
}

export function metersToKilometers(meters: number): number {
  if (!Number.isFinite(meters) || meters <= 0) return 0;
  return meters / 1_000;
}

/** 저장·표시에 쓰는 소수 둘째 자리 킬로미터 값입니다. */
export function roundedKilometers(meters: number): number {
  return Math.round(metersToKilometers(meters) * 100) / 100;
}
