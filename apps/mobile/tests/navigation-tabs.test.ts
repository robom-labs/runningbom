// 하단 탭 규칙을 검증합니다.
//
// 여기서 보는 것은 "탭이 예쁘게 그려지는가"가 아니라
// **어떤 화면에서든 내가 어디에 있는지 알 수 있는가**입니다.
// 아무 탭에도 불이 안 들어오는 화면이 하나라도 있으면 사용자는 앱 밖으로 나온 것처럼 느낍니다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { routeForTab, tabBarVisible, tabForRoute, tabKeys, tabs } from '../domains/navigation/tabs';

/** app/navigation/types.ts의 RouteKey와 같은 목록입니다. 여기서 하드코딩으로 잠급니다. */
const allRoutes = [
  'home',
  'start',
  'programs',
  'calendar',
  'races',
  'shoes',
  'challenges',
  'community',
  'guide',
  'stats',
  'badges',
  'profile',
  'settings',
  'voice',
  'help',
];

test('탭은 다섯 개입니다', () => {
  assert.equal(tabs.length, 5);
  assert.equal(tabKeys.length, 5);
});

test('탭 이름이 네 글자를 넘지 않습니다', () => {
  // 다섯 칸으로 나눈 폭에서 다섯 글자부터 줄임표가 생깁니다.
  for (const tab of tabs) {
    assert.ok(tab.label.length <= 4, `${tab.key}의 이름이 너무 깁니다: ${tab.label}`);
  }
});

test('탭마다 화면 낭독기가 읽을 말이 따로 있습니다', () => {
  for (const tab of tabs) {
    assert.ok(tab.accessibilityLabel.length > tab.label.length);
  }
});

test('모든 화면이 어느 한 탭에 속합니다', () => {
  // 이게 깨지면 그 화면에서는 하단 탭이 전부 꺼진 채로 보입니다.
  for (const route of allRoutes) {
    assert.ok(tabForRoute(route), `${route}가 어느 탭에도 속하지 않습니다`);
  }
});

test('탭 키를 누르면 같은 이름의 화면으로 갑니다', () => {
  for (const key of tabKeys) {
    assert.equal(routeForTab(key), key);
    assert.equal(tabForRoute(key), key);
  }
});

test('달리는 중에는 탭을 감춥니다', () => {
  // 뛰면서 잘못 누르면 코칭이 끊깁니다.
  assert.equal(tabBarVisible('start'), false);
});

test('그 밖의 화면에서는 탭이 보입니다', () => {
  for (const route of allRoutes.filter((value) => value !== 'start')) {
    assert.equal(tabBarVisible(route), true, `${route}에서 탭이 사라집니다`);
  }
});

test('아이콘은 선택 전후가 다릅니다', () => {
  // 색만 바뀌면 색을 구분하기 어려운 사람에게는 어디 있는지 안 보입니다.
  for (const tab of tabs) {
    assert.notEqual(tab.icon, tab.activeIcon);
  }
});

test('모르는 화면이면 아무 탭도 고르지 않습니다', () => {
  assert.equal(tabForRoute('없는화면'), undefined);
});
