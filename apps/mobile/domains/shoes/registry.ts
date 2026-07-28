// 앱에 **실제로 나오는** 러닝화입니다.
//
// 회장 지시: "사진 없는 건 아예 신발 등록 못 해."
//
// 그래서 화면은 `shoeCatalog`를 직접 읽지 않고 여기를 읽습니다.
// 여기 있는 신발은 전부 검증된 실제 제품 사진이 있습니다. 예외가 없습니다.
//
// 카탈로그에서 지운 것이 아닙니다. 데이터는 그대로 있고, 사진이 붙는 즉시 다시 나옵니다.
// 사진 수집이 진행될수록 목록이 저절로 늘어납니다.
import sources from '../../../../data/shoe-image-sources.json';

import { shoeCatalog, type ShoeEntry } from './catalog';
import { registerShoes, type PhotoManifest, type ShoePhoto } from './photoGate';

const manifest = sources as unknown as PhotoManifest;

/**
 * 지금 이 순간 등록된 러닝화입니다.
 *
 * **개수를 밖으로 노출하지 않습니다.** 숫자를 적는 순간 그게 약속이 되고,
 * 사진이 없어 빠진 모델이 결함처럼 보입니다.
 * 사용자는 몇 종인지 궁금한 게 아니라 자기에게 맞는 신발이 있는지가 궁금합니다.
 */
export function registeredShoes(now: Date = new Date()): ShoeEntry[] {
  return registerShoes(shoeCatalog, manifest, now).registered;
}

/** 아직 사진이 없어 나오지 않는 신발입니다. 운영 리포트에서만 씁니다. */
export function withheldShoes(now: Date = new Date()) {
  return registerShoes(shoeCatalog, manifest, now).withheld;
}

/** 이 신발의 사진입니다. 등록된 신발이면 반드시 있습니다. */
export function shoePhoto(shoeId: string): ShoePhoto | undefined {
  return manifest?.items?.[shoeId];
}

export { manifest as shoePhotoManifest };
