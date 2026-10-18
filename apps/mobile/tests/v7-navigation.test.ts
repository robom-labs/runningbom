// 대회 중심 전역 탐색과 기존 저장값 마이그레이션을 검증합니다.
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
import { routeFromStoredValue } from '../app/navigation/routes';

test('전역 목적지는 사용자가 확정한 다섯 채널입니다', () => {
  assert.deepEqual([...primaryDestinations], ['home', 'races', 'shoes', 'community', 'calendar']);
  assert.deepEqual(destinations.map((entry) => entry.label), ['오늘', '대회', '장비', '소통', '내 일정']);
  assert.equal(destinations.length, 5);
  for (const entry of destinations) {
    assert.ok(entry.label.length <= 4, `${entry.label}이 너무 깁니다`);
    assert.ok(entry.accessibilityLabel.length > entry.label.length);
  }
});

test('주요 채널은 각각 한 화면으로 이동합니다', () => {
  assert.equal(routeForDestination('home'), 'home');
  assert.equal(routeForDestination('races'), 'races');
  assert.equal(routeForDestination('calendar'), 'calendar');
  assert.equal(routeForDestination('community'), 'community');
  assert.equal(destinationForRoute('calendar'), 'calendar');
  assert.equal(destinationForRoute('start'), undefined);
  assert.equal(destinationForRoute('shoes'), 'shoes');
});

test('최상위 화면은 다섯 개이고 달리는 중에는 탭을 감춥니다', () => {
  const topLevel = ['home', 'races', 'shoes', 'community', 'calendar'];
  for (const route of topLevel) assert.equal(isTopLevelRoute(route), true);
  assert.equal(isTopLevelRoute('programs'), false);
  assert.equal(tabBarVisible('start'), false);
  assert.equal(tabBarVisible('races'), true);
});

test('예전 탭과 마지막 화면은 대회 중심으로 안전하게 옮깁니다', () => {
  assert.equal(destinationFromLegacy('home'), 'home');
  assert.equal(destinationFromLegacy('races'), 'races');
  assert.equal(destinationFromLegacy('calendar'), 'calendar');
  assert.equal(destinationFromLegacy('stats'), 'calendar');
  assert.equal(destinationFromLegacy('programs'), 'home');
  assert.equal(destinationFromLegacy('shoes'), 'shoes');
  assert.equal(destinationFromLegacy('없는값'), 'home');
  assert.equal(routeFromStoredValue('races'), 'races');
  assert.equal(routeFromStoredValue('calendar'), 'calendar');
  assert.equal(routeFromStoredValue('stats'), 'stats');
  assert.equal(routeFromStoredValue('programs'), 'home');
  assert.equal(routeFromStoredValue('start'), 'home');
  assert.equal(routeFromStoredValue('shoes'), 'shoes');
});

test('전역 내비게이션은 하나뿐이며 데이터 보존 화면을 탭으로 올리지 않습니다', () => {
  const navigator = readFileSync(join(__dirname, '..', 'app/navigation/AppNavigator.tsx'), 'utf8');
  const bar = readFileSync(join(__dirname, '..', 'app/navigation/PrimaryTabBar.tsx'), 'utf8');
  assert.ok(!navigator.includes('<DrawerMenu'), '드로어가 아직 마운트됩니다');
  assert.ok(!navigator.includes('<BottomTabs'), '옛 탭이 아직 쓰입니다');
  assert.ok(navigator.includes('<PrimaryTabBar'), '전역 탭이 없습니다');
  assert.ok(bar.includes('destinations.map'), '목적지 목록을 직접 적었습니다');
  assert.ok(bar.includes('routeForDestination'), '이동 규칙을 직접 적었습니다');
});
