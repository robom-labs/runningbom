// 정적 데이터 sidecar가 갱신되었을 때 러닝화 카탈로그를 병합하기 위한 얇은 훅 포인트입니다.
//
// 현재 앱은 번들된 shoeCatalog만 사용합니다. services/static-data 파이프라인이 러닝화 레코드를
// 배포하기 시작하면, 그 레코드를 ShoeCatalogPatch로 변환해 mergeShoeCatalog에 넘기기만 하면 됩니다.
// 여기서는 services/** 를 import 하지 않아 정적 데이터 파이프라인과 결합되지 않게 유지합니다.
import { shoeCatalog, type ShoeEntry } from './catalog';

/** sidecar가 내려줄 수 있는 부분 갱신 단위입니다. id는 반드시 필요합니다. */
export type ShoeCatalogPatch = Partial<Omit<ShoeEntry, 'id'>> & { id: string };

export type ShoeCatalogSidecar = {
  /** 데이터 버전 문자열. 앱의 SHOE_DATA_VERSION보다 최신일 때만 의미가 있습니다. */
  version: string;
  patches: ShoeCatalogPatch[];
};

export type MergeResult = {
  entries: ShoeEntry[];
  /** 병합에 실제로 반영된 patch 수 */
  applied: number;
  /** 카탈로그에 없는 id라 무시된 patch 수 */
  skipped: number;
};

/**
 * sidecar patch를 번들 카탈로그 위에 덮어씁니다.
 * - 알 수 없는 id는 조용히 무시합니다(신규 추가는 앱 릴리스로만 반영).
 * - id/brandColor는 patch로 바꿀 수 없습니다.
 */
export function mergeShoeCatalog(
  sidecar: ShoeCatalogSidecar | undefined,
  base: ShoeEntry[] = shoeCatalog,
): MergeResult {
  if (!sidecar || sidecar.patches.length === 0) {
    return { entries: base, applied: 0, skipped: 0 };
  }
  const byId = new Map(base.map((entry) => [entry.id, entry] as const));
  let applied = 0;
  let skipped = 0;
  for (const patch of sidecar.patches) {
    const current = byId.get(patch.id);
    if (!current) {
      skipped += 1;
      continue;
    }
    const { id: _ignoredId, brandColor: _ignoredColor, ...rest } = patch as ShoeCatalogPatch & {
      brandColor?: string;
    };
    byId.set(patch.id, { ...current, ...rest, id: current.id, brandColor: current.brandColor });
    applied += 1;
  }
  return { entries: base.map((entry) => byId.get(entry.id) ?? entry), applied, skipped };
}
