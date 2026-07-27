// 훈련 탭 네 칸 규칙을 검증합니다.
//
// 여기서 보는 것은 "칸이 잘 접히는가"가 아니라
// **처음 열었을 때 사람이 원하는 칸이 열려 있는가**입니다.
// 늘 첫 칸만 열리면, 계획 없이 온 사람은 매번 두 번 눌러야 오늘 할 것을 봅니다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  defaultOpenSection,
  sectionBadge,
  toggleSection,
  trainingSectionKeys,
  trainingSections,
  type TrainingSectionState,
} from '../domains/programs/trainingSections';

const empty: TrainingSectionState = {
  hasActivePlan: false,
  activeChallengeCount: 0,
  hasStartedProject: false,
};

test('칸은 네 개입니다', () => {
  assert.equal(trainingSections.length, 4);
  assert.equal(trainingSectionKeys.length, 4);
});

test('접혀 있어도 무엇이 들었는지 한 줄이 보입니다', () => {
  // 접힌 게 빈 상자로 보이면 아무도 열지 않습니다.
  for (const section of trainingSections) {
    assert.ok(section.hint.length >= 10, `${section.key}의 설명이 너무 짧습니다`);
  }
});

test('하던 계획이 있으면 계획 칸이 열립니다', () => {
  assert.equal(defaultOpenSection({ ...empty, hasActivePlan: true }), 'plan');
});

test('하던 계획이 없으면 오늘 할 것이 열립니다', () => {
  // 계획 없이 온 사람에게 당장 할 것을 줘야 합니다.
  assert.equal(defaultOpenSection(empty), 'today');
});

test('도전이 많아도 도전 칸을 먼저 열지 않습니다', () => {
  // 도전은 오늘 나가는 것과 무관합니다. 먼저 보이면 나가는 것을 늦춥니다.
  assert.equal(defaultOpenSection({ ...empty, activeChallengeCount: 9 }), 'today');
});

test('진행 중인 도전 수가 배지로 붙습니다', () => {
  assert.equal(sectionBadge('challenge', { ...empty, activeChallengeCount: 3 }), '3개');
});

test('0개는 배지로 만들지 않습니다', () => {
  // "0개"라고 써 붙이면 없는 것을 강조하는 꼴이 됩니다.
  assert.equal(sectionBadge('challenge', empty), undefined);
});

test('하던 계획·하던 프로젝트는 말로 표시합니다', () => {
  assert.equal(sectionBadge('plan', { ...empty, hasActivePlan: true }), '진행 중');
  assert.equal(sectionBadge('project', { ...empty, hasStartedProject: true }), '하던 것');
  assert.equal(sectionBadge('plan', empty), undefined);
  assert.equal(sectionBadge('project', empty), undefined);
});

test('열린 칸을 다시 누르면 닫힙니다', () => {
  // 전부 접을 수 있어야 화면 전체를 한눈에 훑을 수 있습니다.
  assert.equal(toggleSection('plan', 'plan'), undefined);
});

test('다른 칸을 누르면 그 칸으로 옮겨 갑니다', () => {
  // 두 개가 동시에 열려 있으면 화면이 다시 길어집니다.
  assert.equal(toggleSection('plan', 'challenge'), 'challenge');
  assert.equal(toggleSection(undefined, 'project'), 'project');
});
