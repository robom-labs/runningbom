// 공식 페이지가 스스로 공개한 대표 이미지 주소를 다룹니다.
//
// 회장 지시: **"러닝화도 이미지도 갖고 와. 대회도."**
//
// 어디서 오는가:
//   각 항목의 **공식 페이지가 `og:image`로 공개한 주소**입니다.
//   og:image는 "이 페이지를 다른 곳에서 소개할 때 이 그림을 써라"고 페이지가 스스로 밝힌 값이라,
//   그걸 쓰는 것이 그 태그의 본래 용도입니다. 페이지를 뒤져서 아무 그림이나 긁어 오지 않습니다.
//
// 우리가 하지 않는 것:
//   - 이미지를 우리 서버에 복사해 두지 않습니다. 주소만 들고 있습니다(저장 비용 0).
//   - 주소를 지어내지 않습니다. 확인된 것만 들어옵니다.
//   - og:image가 없는 페이지에서 억지로 그림을 찾지 않습니다. 없으면 그림(벡터)이 그대로 나갑니다.
//
// 화면이 지키는 것:
//   이미지가 없거나, 늦게 오거나, 깨져도 **빈 상자가 보이지 않습니다.**
//   그 자리에는 우리가 그린 벡터 그림이 항상 먼저 깔려 있습니다(`ArtImage`).
//
// 이 파일은 순수합니다.
import data from '../../src/data/official-images.json';

export type OfficialImage = {
  /** https 절대 주소입니다. */
  url: string;
  /** 어느 페이지의 어떤 태그에서 왔는지입니다. */
  source: string;
  /** 언제 확인했는지입니다. YYYY-MM-DD */
  checkedAt: string;
};

export type OfficialImageFile = {
  revision: number;
  checkedAt: string;
  images: Record<string, OfficialImage>;
};

/** http는 안 됩니다(안드로이드가 기본으로 막고, 중간에서 바꿔치기될 수 있습니다). */
export function isUsableImageUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  if (!url.startsWith('https://')) return false;
  // 데이터 URI를 넣으면 번들이 통째로 무거워집니다.
  if (url.length > 600) return false;
  return true;
}

export function parseOfficialImages(raw: unknown): Record<string, OfficialImage> {
  if (!raw || typeof raw !== 'object') return {};
  const file = raw as Partial<OfficialImageFile>;
  if (!file.images || typeof file.images !== 'object') return {};

  const parsed: Record<string, OfficialImage> = {};
  for (const [id, value] of Object.entries(file.images)) {
    if (!value || typeof value !== 'object') continue;
    const item = value as Partial<OfficialImage>;
    // 셋 중 하나라도 없으면 안 씁니다. 출처를 못 밝히는 그림은 화면에 내지 않습니다.
    if (!isUsableImageUrl(item.url)) continue;
    if (typeof item.source !== 'string' || item.source.length === 0) continue;
    if (typeof item.checkedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.checkedAt)) continue;
    parsed[id] = { url: item.url, source: item.source, checkedAt: item.checkedAt };
  }
  return parsed;
}

const images = parseOfficialImages(data);

/** 이 항목의 공식 이미지입니다. 없으면 undefined이고, 화면은 벡터 그림을 그대로 씁니다. */
export function officialImage(id: string): OfficialImage | undefined {
  return images[id];
}

export function officialImageCount(): number {
  return Object.keys(images).length;
}

/** 그림 밑에 붙는 출처 한 줄입니다. 남의 그림을 우리 것처럼 보이게 하지 않습니다. */
export function imageCreditLabel(image: OfficialImage): string {
  return `${image.source} 공개 이미지`;
}
