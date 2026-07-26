// 러닝화 2~3켤레를 나란히 비교하기 위한 순수 로직입니다.
// 이미지 없이 텍스트·칩으로만 비교하므로 화면은 이 표 데이터를 그대로 그리면 됩니다.
import { findShoeEntry, shoeCatalog, type ShoeEntry } from './catalog';
import { shoePlateLabels, shoePriceBandLabels } from './taxonomy';

export const COMPARE_MIN = 2;
export const COMPARE_MAX = 3;

export type CompareRow = {
  label: string;
  /** compareShoes와 같은 순서의 값. 빈 칸은 '—'로 채웁니다. */
  values: string[];
  /** 여러 줄로 그려야 하는 값인지(장점·주의점 등) */
  multiline?: boolean;
};

const EMPTY = '—';

function joinOrEmpty(values: string[], separator = ' · '): string {
  return values.length > 0 ? values.join(separator) : EMPTY;
}

/** 선택 토글. 최대 COMPARE_MAX개까지만 담기고, 넘치면 조용히 무시합니다. */
export function toggleCompareId(current: string[], id: string): string[] {
  if (current.includes(id)) return current.filter((value) => value !== id);
  if (current.length >= COMPARE_MAX) return current;
  return [...current, id];
}

export function canCompare(current: string[]): boolean {
  return current.length >= COMPARE_MIN && current.length <= COMPARE_MAX;
}

/** id 목록을 카탈로그 엔트리로 바꿉니다. 없는 id는 조용히 버립니다. */
export function resolveCompareShoes(
  ids: string[],
  values: ShoeEntry[] = shoeCatalog,
): ShoeEntry[] {
  return ids
    .map((id) => findShoeEntry(id, values))
    .filter((entry): entry is ShoeEntry => Boolean(entry))
    .slice(0, COMPARE_MAX);
}

export function buildComparisonRows(entries: ShoeEntry[]): CompareRow[] {
  const column = <T,>(pick: (entry: ShoeEntry) => T): T[] => entries.map(pick);
  return [
    { label: '브랜드', values: column((entry) => entry.brand) },
    { label: '카테고리', values: column((entry) => `${entry.category} · ${entry.subCategory}`) },
    { label: '플레이트', values: column((entry) => shoePlateLabels[entry.plate]) },
    { label: '추천 실력', values: column((entry) => joinOrEmpty(entry.levels)) },
    { label: '어울리는 거리', values: column((entry) => joinOrEmpty(entry.distances)) },
    { label: '가격대', values: column((entry) => shoePriceBandLabels[entry.priceBand]) },
    { label: '주요 용도', values: column((entry) => joinOrEmpty(entry.purposeTags)) },
    {
      label: '공식 기술명',
      values: column((entry) => joinOrEmpty(entry.keyTech, ', ')),
    },
    {
      label: '장점',
      values: column((entry) => joinOrEmpty(entry.strengths, '\n· ')),
      multiline: true,
    },
    {
      label: '주의할 점',
      values: column((entry) => joinOrEmpty(entry.watchouts, '\n· ')),
      multiline: true,
    },
    {
      label: '이런 러너에게',
      values: column((entry) => joinOrEmpty(entry.bestForRunner, '\n· ')),
      multiline: true,
    },
    {
      label: '이럴 땐 아니에요',
      values: column((entry) => joinOrEmpty(entry.notFor, '\n· ')),
      multiline: true,
    },
  ];
}

/** 비교표 아래에 붙일 요약 한 줄. 무엇이 다른지 사용자가 바로 보게 합니다. */
export function compareHighlights(entries: ShoeEntry[]): string[] {
  if (entries.length < COMPARE_MIN) return [];
  const highlights: string[] = [];
  const categories = new Set(entries.map((entry) => entry.subCategory));
  if (categories.size > 1) {
    highlights.push(`세부 카테고리가 서로 달라요 (${[...categories].join(' vs ')}).`);
  } else {
    highlights.push(`모두 ${[...categories][0]} 자리라 성격이 비슷해요.`);
  }
  const plates = new Set(entries.map((entry) => shoePlateLabels[entry.plate]));
  if (plates.size > 1) highlights.push(`플레이트 구성이 달라요 (${[...plates].join(' vs ')}).`);
  const bands = new Set(entries.map((entry) => entry.priceBand));
  if (bands.size > 1) highlights.push(`가격대가 달라요 (${[...bands].join(' vs ')}).`);
  highlights.push('가격은 밴드 구간만 안내하니 실제 판매가는 각 판매처에서 확인해 주세요.');
  return highlights;
}
