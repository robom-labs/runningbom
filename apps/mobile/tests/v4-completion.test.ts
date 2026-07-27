// V4 완료 기준(기획서 §13)을 기계가 확인할 수 있는 것만 골라 잠급니다.
//
// 왜 이 파일이 필요한가:
//   완료 기준을 문서에만 두면, 다음에 누가 화면을 고칠 때 조용히 깨집니다.
//   그리고 깨진 걸 아무도 모릅니다. 실제로 이 저장소에서 프로그램 음성이
//   "코드가 있는데도 한 마디만 나가던" 일이 있었습니다.
//
// 여기 없는 기준(메트로놈 박자가 실기기에서 안 흔들리는가, 배포 시각이 로그와 맞는가)은
// **사람이 기기에서 확인해야 합니다.** 그건 이 파일이 대신할 수 없습니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { shoeCatalog } from '../domains/shoes/catalog';
import { priceDisplay, validatePrices } from '../domains/shoes/price';
import { rankShoes, rankingCriteria } from '../domains/shoes/ranking';
import { shoeArtSpec } from '../domains/shoes/art';
import { racePosterSpec } from '../domains/races/poster';
import { tabs } from '../domains/navigation/tabs';
import { trainingSections } from '../domains/programs/trainingSections';
import { startingPoints } from '../domains/programs/onboardingPlan';
import { MAX_STEP_UP } from '../domains/cadence/metronome';
import { adjustReasons } from '../domains/activities/retrospect';
import { suggestToday } from '../domains/today/suggest';
import { terrains } from '../domains/growth/monthMap';

const now = new Date('2026-07-27T09:00:00+09:00');

function source(relative: string): string {
  return readFileSync(join(__dirname, '..', relative), 'utf8');
}

test('§13 러닝화 카드에 가격이 비어 있는 것이 하나도 없다', () => {
  for (const shoe of shoeCatalog) {
    const shown = priceDisplay(shoe, now);
    assert.match(shown.headline, /\d/, `${shoe.id}에 값이 없습니다`);
  }
});

test('§13 지금 카탈로그에 가격 규칙 위반이 없다', () => {
  assert.deepEqual(validatePrices(shoeCatalog, now), []);
});

test('§13 홈 아래쪽 신발 순위가 다섯 줄이고 각 줄에 값이 있다', () => {
  const ranked = rankShoes(shoeCatalog, { limit: 5 }, now);
  assert.equal(ranked.length, 5);
  for (const item of ranked) {
    assert.match(priceDisplay(item.shoe, now).headline, /\d/);
  }
  // 홈 화면이 실제로 이 카드를 그리고 있는지도 봅니다.
  assert.match(source('app/screens/home/HomeScreen.tsx'), /<ShoeRankingCard/);
});

test('§13 순위 산식이 앱 안에서 열린다', () => {
  assert.equal(
    rankingCriteria.reduce((sum, item) => sum + item.weight, 0),
    100,
  );
  assert.match(source('domains/shoes/ShoeRankingCard.tsx'), /rankingCriteria\.map/);
  assert.match(source('domains/shoes/ShoeRankingCard.tsx'), /RANKING_DISCLOSURE/);
});

test('§13 러닝화 첫 화면에서 가격대로도 고를 수 있다', () => {
  const browse = source('domains/shoes/ShoeBrowse.tsx');
  assert.match(browse, /priceFilterBands\.map/);
  // 용도 갈래와 같은 층(같은 Card 블록 형식)에 있어야 합니다.
  assert.match(browse, /예산이 정해져 있다면/);
});

test('§13 신발 그림이 종류별로 다르게 보인다', () => {
  const cushion = shoeArtSpec({ subCategory: '맥스 쿠션화', plate: 'none', brandColor: '#334455' });
  const racing = shoeArtSpec({ subCategory: '장거리', plate: 'carbon', brandColor: '#334455' });
  const stability = shoeArtSpec({ subCategory: '안정화', plate: 'none', brandColor: '#334455' });
  assert.ok(cushion.midsole > racing.midsole || racing.toeSpring > cushion.toeSpring);
  assert.ok(stability.baseWidth > racing.baseWidth);
  // 카드가 실제로 그림을 그리는지 봅니다.
  assert.match(source('domains/shoes/ShoeCard.tsx'), /<ShoeArt/);
});

test('§13 대회 카드에 포스터가 있다', () => {
  const spec = racePosterSpec({ raceDate: '2026-10-04', region: '서울', distances: ['10K'] });
  assert.equal(spec.headline, '10K');
  assert.match(source('domains/races/RaceScreen.tsx'), /<RacePoster/);
});

test('§13 한 탭에 다섯 개, 훈련은 네 칸', () => {
  assert.equal(tabs.length, 5);
  assert.equal(trainingSections.length, 4);
});

test('§13 처음 켠 사람이 온보딩만 끝내면 시작 버튼까지 간다', () => {
  // 온보딩이 계획을 깔아 주지 않으면, 끝나고도 계획 40개 앞에서 멈춥니다.
  assert.ok(startingPoints.length > 0);
  assert.match(source('app/state/AppStateProvider.tsx'), /applyOnboardingPlan/);
});

test('§13 회고 값이 실제로 오늘 제안을 바꾼다', () => {
  const plain = suggestToday({ activities: [], now, hasPlanSessionLeft: true });
  const resting = suggestToday({ activities: [], now, hasPlanSessionLeft: true, adjust: 'rest' });
  assert.notEqual(plain.kind, resting.kind);
  assert.equal(resting.reason, adjustReasons.rest);
  // 값을 받는 화면이 실제로 있어야 합니다. 로직만 있으면 아무 일도 안 일어납니다.
  assert.match(source('app/screens/programs/ProgramsScreen.tsx'), /<RetrospectCard/);
  assert.match(source('app/screens/programs/TodayCard.tsx'), /adjust/);
});

test('§13 성장 표시가 쉰 것을 벌하지 않는다', () => {
  const banned = ['실패', '놓쳤', '깨졌', '잃'];
  const blob = terrains.map((t) => `${t.label}${t.arrival}`).join('');
  for (const word of banned) assert.ok(!blob.includes(word));
});

test('§13 케이던스 안전선이 잠겨 있다', () => {
  assert.equal(MAX_STEP_UP, 5);
});

test('§13 기존 사용자의 저장 열쇠를 바꾸지 않았다', () => {
  // 이 값들이 바뀌면 진행 중인 사용자의 이력이 통째로 끊깁니다.
  assert.match(source('domains/programs/store.ts'), /runningbom:vnext:programs:v1/);
  assert.match(source('domains/projects/store.ts'), /runningbom\.projects\.v1/);
  // V4에서 더한 것은 전부 새 열쇠입니다.
  assert.match(source('domains/activities/retrospectStore.ts'), /runningbom\.retrospect\.v1/);
});

test('§13 지킬 수 없는 약속을 화면에 쓰지 않는다', () => {
  // "최저가"는 우리가 보장할 수 없습니다. 순위를 파는 것도 하지 않습니다.
  const screens = [
    'domains/shoes/ShoeCard.tsx',
    'domains/shoes/ShoeDetail.tsx',
    'domains/shoes/ShoeRankingCard.tsx',
    'domains/shoes/ShoeBrowse.tsx',
  ];
  for (const file of screens) {
    const text = source(file)
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*'))
      .join('\n');
    for (const phrase of ['최저가', '정품 보장', '해외직구']) {
      assert.ok(!text.includes(phrase), `${file}에 "${phrase}"가 있습니다`);
    }
  }
});
