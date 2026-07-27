// 계획 고르기가 실제 화면에 연결돼 있는지, 고른 계획이 진짜로 실행되는지 검사합니다.
//
// V3가 실패로 규정한 상태: "계획은 보이지만 시작 버튼이 실행 엔진과 연결되지 않음".
// 이 파일은 그 상태로 돌아가면 실패합니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { PROGRAM_ID as START9_ID, beginnerProgram } from '../domains/programs/beginnerProgram';
import { buildPlan, programFamilies } from '../domains/programs/catalog';
import { programCoachCues } from '../domains/programs/coachSession';

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

const pickerSource = read('../app/screens/programs/PlanPicker.tsx');
const screenSource = read('../app/screens/programs/ProgramsScreen.tsx');
const hookSource = read('../domains/programs/usePrograms.ts');

describe('계획 고르기 화면 연결', () => {
  it('프로그램 화면이 계획 고르기를 실제로 그린다', () => {
    assert.ok(screenSource.includes('<PlanPicker'), '계획 고르기가 화면에 없습니다');
  });

  it('고른 계획이 저장으로 이어진다', () => {
    assert.ok(screenSource.includes('choosePlan(planId)'), '고른 계획이 저장되지 않습니다');
    assert.ok(hookSource.includes('switchPlan(store, planId)'));
  });

  it('최근 기록을 수준 판단에 쓴다', () => {
    // 기록을 무시하고 사용자 선택만 믿으면 초보에게 어려운 계획이 갑니다.
    assert.ok(screenSource.includes('capabilityFromActivities(activities'));
  });

  it('시작할 수 없는 계획에는 시작 버튼을 그리지 않는다', () => {
    // 누를 수 없는 버튼을 보여 주면 안 됩니다. 대신 이유를 보여 줍니다.
    assert.ok(pickerSource.includes('eligibility.allowed'));
    assert.ok(pickerSource.includes('eligibility.reason'));
  });

  it('한 번에 전부 늘어놓지 않는다', () => {
    assert.ok(pickerSource.includes('recommendFamilies'), '추천 세 개 규칙을 쓰지 않습니다');
    assert.ok(pickerSource.includes('showAll'), '전체 보기를 따로 두지 않았습니다');
  });
});

describe('고른 계획이 실제로 실행된다', () => {
  it('9주 프로그램은 손으로 쓴 정본을 그대로 쓴다', () => {
    assert.ok(hookSource.includes('START9_ID'), '9주 프로그램 예외 처리가 없습니다');
    assert.ok(hookSource.includes('return beginnerProgram'));
  });

  it('생성된 계획도 회차를 만들고 음성까지 나온다', () => {
    // 계획 -> 회차 -> 음성이 끝까지 이어지는지 실제로 돌려 봅니다.
    const generated = programFamilies.filter((family) => family.recipe);
    assert.ok(generated.length > 0);

    for (const family of generated) {
      const plan = buildPlan(family);
      assert.ok(plan, `${family.id}: 회차를 만들지 못했습니다`);
      const first = plan!.sessions[0];
      assert.ok(first, `${family.id}: 첫 회차가 없습니다`);
      const cues = programCoachCues(first);
      assert.ok(cues.length > 0, `${family.id}: 첫 회차에 음성이 없습니다`);
      // 시작을 알려 주는 말이 반드시 있어야 합니다.
      assert.ok(cues.some((cue) => cue.kind === 'phase' && cue.offsetSeconds === 0));
      assert.ok(cues.some((cue) => cue.kind === 'completion'));
    }
  });

  it('없는 계획 ID가 저장돼 있어도 빈 화면을 주지 않는다', () => {
    // 계획이 없어지거나 저장 값이 낡았을 때 앱이 멈추면 안 됩니다.
    assert.ok(hookSource.includes('?? beginnerProgram'), '되돌아갈 기본 계획이 없습니다');
  });

  it('9주 프로그램 회차 수가 그대로다', () => {
    // 계획을 여러 개로 늘리면서 기존 프로그램이 줄어들면 안 됩니다.
    assert.equal(beginnerProgram.id, START9_ID);
    assert.equal(beginnerProgram.sessions.length, 27);
  });
});
