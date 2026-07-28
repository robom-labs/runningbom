// V7 — 최상위 목적지와 기능 보존을 잠급니다.
//
// 이 파일이 막는 것은 하나입니다.
//   **화면을 갈아엎다가 기능이 조용히 사라지는 것.**
// 메뉴에서 항목 하나가 빠지면 코드에 남아 있어도 아무도 도달할 수 없습니다.
// "삭제하지 않았다"는 말은 사실이지만 사용자에게는 삭제된 것과 같습니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  destinationForRoute,
  destinationFromLegacy,
  destinations,
  isTopLevelRoute,
  primaryDestinations,
  routeForDestination,
  tabBarVisible,
} from '../domains/navigation/destinations';
import {
  featureCountByDestination,
  featureMatrix,
  legacyRoutes,
  preservedStorageKeys,
  validateMatrix,
} from '../domains/navigation/featureMatrix';

test('최상위 목적지는 정확히 다섯 개입니다', () => {
  assert.equal(primaryDestinations.length, 5);
  assert.deepEqual([...primaryDestinations], ['today', 'training', 'run', 'explore', 'me']);
  assert.equal(destinations.length, 5);
  assert.deepEqual(
    destinations.map((entry) => entry.label),
    ['오늘', '훈련', '달리기', '찾기', '나'],
  );
});

test('탭 이름은 한 단어입니다', () => {
  // 두 단어면 작은 화면에서 줄바꿈되거나 잘립니다.
  for (const entry of destinations) {
    assert.ok(!entry.label.includes(' '), `${entry.label}에 공백이 있습니다`);
    assert.ok(entry.label.length <= 3, `${entry.label}이 너무 깁니다`);
    // 낭독기용 설명은 따로 있어야 합니다. 이름만으로는 무엇인지 모릅니다.
    assert.ok(entry.accessibilityLabel.length > entry.label.length);
  }
});

test('가운데 달리기는 강조하지만 역할은 이동입니다', () => {
  const run = destinations.find((entry) => entry.id === 'run');
  assert.equal(run?.emphasized, true);
  // 누르면 준비 화면입니다. 탭을 누르자마자 기록이 시작되면 되돌릴 방법이 없습니다.
  assert.equal(routeForDestination('run'), 'start');
  assert.ok(run?.accessibilityLabel.includes('이동'));
});

test('예전 라우트 16개가 전부 어느 목적지엔가 속합니다', () => {
  for (const route of legacyRoutes) {
    assert.ok(destinationForRoute(route), `${route}가 어느 탭에도 속하지 않습니다`);
  }
});

test('최상위 화면은 다섯 개뿐입니다', () => {
  const topLevel = legacyRoutes.filter((route) => isTopLevelRoute(route));
  assert.equal(topLevel.length, 5, `최상위가 ${topLevel.length}개입니다: ${topLevel.join(', ')}`);
  // 나머지는 전부 하위 화면이고, 뒤로가기가 있어야 합니다.
  for (const route of legacyRoutes) {
    if (!topLevel.includes(route)) assert.equal(isTopLevelRoute(route), false);
  }
});

test('달리는 중에는 하단 탭이 사라집니다', () => {
  // 뛰면서 잘못 누르면 코칭이 끊깁니다.
  assert.equal(tabBarVisible('start'), false);
  for (const route of legacyRoutes) {
    if (route !== 'start') assert.equal(tabBarVisible(route), true, `${route}에서 탭이 사라집니다`);
  }
});

test('저장돼 있던 예전 탭 값이 무효가 되지 않습니다', () => {
  // 예전 탭 키
  assert.equal(destinationFromLegacy('home'), 'today');
  assert.equal(destinationFromLegacy('races'), 'explore');
  assert.equal(destinationFromLegacy('shoes'), 'explore');
  assert.equal(destinationFromLegacy('programs'), 'training');
  assert.equal(destinationFromLegacy('stats'), 'me');
  // 라우트 키로 저장돼 있던 경우
  assert.equal(destinationFromLegacy('settings'), 'me');
  assert.equal(destinationFromLegacy('cadence'), 'training');
  // 새 값
  assert.equal(destinationFromLegacy('today'), 'today');
  // 모르는 값이면 오늘입니다. 빈 화면으로 여는 것보다 낫습니다.
  assert.equal(destinationFromLegacy('없는값'), 'today');
  assert.equal(destinationFromLegacy(undefined), 'today');
});

// ── 기능 보존 ───────────────────────────────────────────────────────────────

test('길을 잃은 기능이 하나도 없습니다', () => {
  assert.deepEqual(validateMatrix(), []);
});

test('예전 화면 전부에 새 집이 있습니다', () => {
  const covered = new Set(featureMatrix.map((entry) => entry.legacyRoute));
  for (const route of legacyRoutes) {
    assert.ok(covered.has(route), `${route}에 있던 기능이 새 구조에 없습니다`);
  }
});

test('큰 콘텐츠가 전부 도달 가능합니다', () => {
  // 계획 40 · 훈련 103 · 도전 40 · 프로젝트 20 · 러닝화 123 · 배지 48 · 코치 V6
  const must = [
    'plan-catalog',
    'workout-library',
    'challenges',
    'support-projects',
    'shoes',
    'badges',
    'coach-v6',
    'metronome',
    'gps-tracking',
    'races',
  ];
  const ids = new Set(featureMatrix.map((entry) => entry.featureId));
  for (const id of must) assert.ok(ids.has(id), `${id}가 매트릭스에 없습니다`);
});

test('준비 안 된 기능은 최상위에 없습니다', () => {
  // 사람들 소식·크루·리그는 서버가 없습니다. "준비 중"을 상시 노출하지 않습니다.
  const social = featureMatrix.find((entry) => entry.featureId === 'social-feed');
  assert.equal(social?.visibility, 'FEATURE_GATED');
  // 반대로 기록 공유는 실제로 되는 기능이므로 숨기지 않습니다.
  const share = featureMatrix.find((entry) => entry.featureId === 'record-share');
  assert.equal(share?.visibility, 'CONTEXTUAL');
});

test('개발자용 값은 일반 화면에 없습니다', () => {
  const diag = featureMatrix.find((entry) => entry.featureId === 'diagnostics');
  assert.equal(diag?.visibility, 'DEVELOPER_ONLY');
  assert.ok(diag?.newRoute.includes('진단'));
});

test('기능이 한 목적지에만 몰려 있지 않습니다', () => {
  const counts = featureCountByDestination();
  for (const [id, count] of Object.entries(counts)) {
    assert.ok(count >= 3, `${id}에 기능이 ${count}개뿐입니다`);
  }
  // 어느 한 곳이 절반을 넘으면 그건 탭을 나눈 의미가 없습니다.
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  for (const [id, count] of Object.entries(counts)) {
    assert.ok(count < total * 0.5, `${id}에 ${count}/${total}이 몰려 있습니다`);
  }
});

test('보존한다고 적은 저장 키가 실제로 코드에 있습니다', () => {
  // 표에만 적어 두고 실제로는 다른 키를 쓰면 아무것도 지키지 못합니다.
  const declared = preservedStorageKeys();
  assert.ok(declared.length >= 10, `보존 키가 ${declared.length}개뿐입니다`);

  const roots = ['services/storage', 'domains'];
  const sources = roots
    .map((dir) => {
      try {
        return execSyncGrep(join(__dirname, '..', dir));
      } catch {
        return '';
      }
    })
    .join('\n');

  for (const key of declared) {
    assert.ok(sources.includes(key), `${key}가 코드에 없습니다`);
  }
});

/** 저장 키가 실제로 쓰이는지 소스에서 직접 찾습니다. */
function execSyncGrep(dir: string): string {
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  let out = '';
  const walk = (path: string) => {
    for (const name of readdirSync(path)) {
      const full = join(path, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name)) out += readFileSync(full, 'utf8');
    }
  };
  walk(dir);
  return out;
}

// ── 셸이 실제로 바뀌었는지 ──────────────────────────────────────────────────

test('전역 내비게이션이 하나만 마운트됩니다', () => {
  const navigator = readFileSync(
    join(__dirname, '..', 'app/navigation/AppNavigator.tsx'),
    'utf8',
  );
  // 드로어와 햄버거가 런타임에서 사라져야 합니다.
  assert.ok(!navigator.includes('<DrawerMenu'), '드로어가 아직 마운트됩니다');
  assert.ok(!navigator.includes('<AppHeader'), '햄버거 헤더가 아직 쓰입니다');
  assert.ok(!navigator.includes('<BottomTabs'), '옛 탭이 아직 쓰입니다');
  // 새 셸이 들어와 있어야 합니다.
  assert.ok(navigator.includes('<PrimaryTabBar'), '새 탭이 없습니다');
  assert.ok(navigator.includes('<TopBar'), '새 상단 바가 없습니다');
});

test('상단 바가 최상위와 하위를 구분합니다', () => {
  const topBar = readFileSync(join(__dirname, '..', 'app/navigation/TopBar.tsx'), 'utf8');
  assert.ok(topBar.includes('topLevel'), '최상위 구분이 없습니다');
  assert.ok(topBar.includes('chevron-back'), '뒤로가기가 없습니다');
  // 햄버거는 어디에도 없어야 합니다.
  assert.ok(!topBar.includes('"menu"'), '햄버거가 남아 있습니다');
});

test('탭 바에 다섯 개만 그려집니다', () => {
  const bar = readFileSync(join(__dirname, '..', 'app/navigation/PrimaryTabBar.tsx'), 'utf8');
  // 목록을 직접 적지 않고 순수 모델에서 가져옵니다. 두 곳에 적으면 언젠가 어긋납니다.
  assert.ok(bar.includes('destinations.map'), '목적지 목록을 직접 적었습니다');
  assert.ok(bar.includes('routeForDestination'), '이동 규칙을 직접 적었습니다');
});
