// 앱에 포함된 결정적 JSON fallback을 원문과 같은 바이트 문자열로 제공합니다.
import coaching from '../../data/fallback/coaching.json';
import manifest from '../../data/fallback/manifest.json';
import races from '../../data/fallback/races.json';
import shoes from '../../data/fallback/shoes.json';
import upcomingShoes from '../../data/fallback/upcoming-shoes.json';

import type {
  StaticDataManifest,
  StaticDataPayloadTexts,
} from './types';

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export const bundledStaticManifest = manifest as StaticDataManifest;

export const bundledStaticPayloadTexts: StaticDataPayloadTexts = {
  'races.json': stableJson(races),
  'shoes.json': stableJson(shoes),
  'upcoming-shoes.json': stableJson(upcomingShoes),
  'coaching.json': stableJson(coaching),
};
