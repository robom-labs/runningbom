// 러닝화가 앱에 **등록되는 조건**입니다. 순수합니다.
//
// 회장 지시: "사진 없는 건 아예 신발 등록 못 해."
//
// 그래서 사진은 장식이 아니라 **등록 요건**입니다.
// 검증된 실제 제품 사진이 없는 모델은 목록·검색·추천·비교·순위 어디에도 나오지 않습니다.
//
// 왜 이게 더 정직한가:
//   예전 방식은 사진 없는 신발도 등록해 두고 벡터 그림으로 때웠습니다.
//   사용자는 그림을 보고 "사진이 없는 앱"이라고 느낍니다. 신발 수가 많아도 신뢰가 떨어집니다.
//   사진이 붙은 것만 보여 주면 **보이는 모든 신발에 사진이 있습니다.** 그게 100%입니다.
//
// 그리고 **개수를 세어 보여 주지 않습니다.**
//   개수를 적는 순간 그 숫자가 약속이 되고, 사진이 없어 빠진 모델이 결함처럼 보입니다.
//   사용자는 몇 종인지 궁금하지 않습니다. 자기에게 맞는 신발이 있는지가 궁금합니다.

/**
 * 사진의 권리 상태입니다.
 *
 * **상태를 나눠 두는 이유:** 나중에 누가 "이 사진 왜 썼냐"고 물었을 때
 * "누가 언제 무엇을 근거로 정했는지"가 데이터에 남아 있어야 답할 수 있습니다.
 * 전부 뭉뜽그려 "승인됨"으로 적으면 그 질문에 답할 수 없습니다.
 */
export type PhotoRights =
  /** 브랜드 이용약관을 확인했습니다. */
  | 'REMOTE_USE_VERIFIED'
  /** 명시적 사용권을 받아 앱에 넣었습니다. */
  | 'BUNDLED_LICENSED'
  /** 공식 유통사에서 라이선스를 받았습니다. */
  | 'AUTHORIZED_RETAILER_LICENSED'
  /**
   * **소유자가 사업 판단으로 승인했습니다.**
   *
   * 러닝봄은 사용자가 신발을 고르고 공식 판매처로 가도록 돕는 앱이고,
   * 제품 사진은 그 목적에 쓰입니다. 쇼핑 정보 서비스가 흔히 하는 방식입니다.
   *
   * 다만 이건 **법률 검토가 아니라 소유자의 결정**입니다. 그래서 이름을 그렇게 붙였습니다.
   * 나중에 브랜드가 문제 삼으면 이 상태를 BLOCKED_RIGHTS로 바꾸면 그 사진만 즉시 내려갑니다.
   */
  | 'OWNER_APPROVED'
  /** 아직 아무도 확인하지 않았습니다. **등록 불가.** */
  | 'RIGHTS_REVIEW_REQUIRED'
  /** 쓸 수 없다고 확인됐습니다. **등록 불가.** */
  | 'BLOCKED_RIGHTS';

const usableRights: PhotoRights[] = [
  'REMOTE_USE_VERIFIED',
  'BUNDLED_LICENSED',
  'AUTHORIZED_RETAILER_LICENSED',
  'OWNER_APPROVED',
];

export type ShoePhoto = {
  /** 이미지 주소입니다. https만 받습니다. */
  url: string;
  /** 이 사진이 있던 정확한 모델 페이지입니다. 검색 결과나 목록 페이지가 아닙니다. */
  modelPage: string;
  /** 어느 공식 호스트에서 왔는지입니다. */
  sourceHost: string;
  /** 어떻게 뽑았는지입니다. 추측한 주소는 받지 않습니다. */
  sourceType: 'jsonld-product-image' | 'og-image-secure' | 'og-image' | 'twitter-image';
  checkedAt: string;
  rights: PhotoRights;
  width?: number;
  height?: number;
  mime?: string;
};

export type PhotoProblem =
  | 'missing'
  | 'not-https'
  | 'no-model-page'
  | 'rights-not-approved'
  | 'too-small'
  | 'bad-mime'
  | 'stale'
  | 'duplicate-url';

/** 사진 한 장이 등록 요건을 만족하는지입니다. */
export function photoProblems(
  photo: ShoePhoto | undefined,
  options: { now: Date; seenUrls?: Set<string> } ,
): PhotoProblem[] {
  if (!photo) return ['missing'];
  const problems: PhotoProblem[] = [];

  if (!photo.url.startsWith('https://')) problems.push('not-https');
  if (!photo.modelPage || !photo.modelPage.startsWith('https://')) problems.push('no-model-page');
  if (!usableRights.includes(photo.rights)) problems.push('rights-not-approved');

  // 너무 작은 이미지는 로고나 썸네일일 가능성이 큽니다.
  if (photo.width !== undefined && photo.width < MIN_PHOTO_WIDTH) problems.push('too-small');
  if (photo.mime !== undefined && !/^image\/(jpeg|png|webp|avif)$/.test(photo.mime)) {
    problems.push('bad-mime');
  }

  const checked = Date.parse(photo.checkedAt);
  if (!Number.isFinite(checked)) problems.push('stale');
  else if (options.now.getTime() - checked > STALE_DAYS * 86_400_000) problems.push('stale');

  // 같은 사진을 여러 모델에 붙이면 그건 그 모델의 사진이 아닙니다.
  if (options.seenUrls?.has(photo.url)) problems.push('duplicate-url');

  return problems;
}

export const MIN_PHOTO_WIDTH = 400;
export const STALE_DAYS = 180;

/** 등록 가능한지입니다. 문제가 하나도 없어야 합니다. */
export function isRegistrable(
  photo: ShoePhoto | undefined,
  options: { now: Date; seenUrls?: Set<string> },
): boolean {
  return photoProblems(photo, options).length === 0;
}

export type PhotoManifest = {
  revision: number;
  checkedAt: string;
  items: Record<string, ShoePhoto>;
};

export type RegistrationResult<T extends { id: string }> = {
  /** 실제로 앱에 나오는 신발입니다. 전부 사진이 있습니다. */
  registered: T[];
  /** 사진이 없거나 요건을 못 채워 아직 나오지 않는 신발입니다. */
  withheld: { id: string; problems: PhotoProblem[] }[];
};

/**
 * 사진이 있는 신발만 등록합니다.
 *
 * **중요:** 여기서 걸러진 모델은 카탈로그에서 지워진 것이 아닙니다.
 * 데이터는 그대로 있고, 사진이 붙는 즉시 다시 나옵니다.
 * 그래서 사진 수집이 진행될수록 목록이 저절로 늘어납니다.
 */
export function registerShoes<T extends { id: string }>(
  catalog: readonly T[],
  manifest: PhotoManifest | undefined,
  now: Date,
): RegistrationResult<T> {
  const registered: T[] = [];
  const withheld: { id: string; problems: PhotoProblem[] }[] = [];
  const seenUrls = new Set<string>();

  for (const shoe of catalog) {
    const photo = manifest?.items?.[shoe.id];
    const problems = photoProblems(photo, { now, seenUrls });
    if (problems.length === 0 && photo) {
      seenUrls.add(photo.url);
      registered.push(shoe);
    } else {
      withheld.push({ id: shoe.id, problems });
    }
  }

  return { registered, withheld };
}

/** 사진 주소입니다. 등록된 신발이면 반드시 있습니다. */
export function photoFor(manifest: PhotoManifest | undefined, shoeId: string): ShoePhoto | undefined {
  return manifest?.items?.[shoeId];
}
