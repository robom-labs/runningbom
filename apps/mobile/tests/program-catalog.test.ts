// 계획 목록이 안전하고, 아무에게나 아무 계획을 보여 주지 않는지 검사합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PROGRAM_ID as START9_ID } from '../domains/programs/beginnerProgram';
import {
  availableFamilies,
  buildPlan,
  categoryLabels,
  checkEligibility,
  programFamilies,
  recommendFamilies,
  validateCatalog,
} from '../domains/programs/catalog';
import type { RunnerCapability, UserLevelId } from '../domains/programs/level';

const noHistory: RunnerCapability = {};
const fiveKRunner: RunnerCapability = {
  longestRecentKm: 5.5,
  recentWeeklyKm: 12,
  recentRunsPerWeek: 3,
  longestRecentMinutes: 34,
};

describe('계획 목록', () => {
  it('모든 계획이 안전 규칙을 통과한다', () => {
    // 여기서 실패하면 위험한 계획이 사용자에게 나갈 뻔한 것입니다.
    assert.deepEqual(validateCatalog(), []);
  });

  it('계획 ID가 겹치지 않는다', () => {
    const ids = new Set(programFamilies.map((family) => family.id));
    assert.equal(ids.size, programFamilies.length);
  });

  it('기존 9주 프로그램 ID를 그대로 지킨다', () => {
    // 이 ID가 바뀌면 이미 진행 중인 사용자의 기록이 끊깁니다.
    const start9 = programFamilies.find((family) => family.id === START9_ID);
    assert.ok(start9, '9주 프로그램이 목록에서 사라졌습니다');
    // 손으로 쓴 정본이 있으므로 생성기로 다시 만들지 않습니다.
    assert.equal(start9?.recipe, undefined);
    assert.equal(buildPlan(start9!), undefined);
  });

  it('모든 계획에 제목·설명·카테고리가 있다', () => {
    for (const family of programFamilies) {
      assert.ok(family.title.length > 0, `${family.id} 제목 없음`);
      assert.ok(family.description.length > 0, `${family.id} 설명 없음`);
      assert.ok(categoryLabels[family.category], `${family.id} 카테고리 이름 없음`);
    }
  });

  it('화면에 보여 줄 말에 영어 전문용어를 쓰지 않는다', () => {
    for (const family of programFamilies) {
      const text = `${family.title} ${family.subtitle} ${family.description}`;
      for (const banned of ['RPE', '스트릭', 'threshold', 'tempo', 'interval']) {
        assert.ok(!text.includes(banned), `${family.id}에 '${banned}'가 있습니다`);
      }
    }
  });
});

describe('자격조건', () => {
  it('수준이 안 되면 막고, 이유를 쉬운 말로 알려 준다', () => {
    const tenK = programFamilies.find((family) => family.id === 'first-10k');
    assert.ok(tenK);
    const result = checkEligibility(tenK!, 'L0_MOVE', noHistory);
    assert.equal(result.allowed, false);
    if (!result.allowed) {
      assert.ok(result.reason.length > 0);
      // "불가"만 알려 주면 사용자가 무엇을 해야 할지 모릅니다.
      assert.ok(result.reason.includes('먼저') || result.reason.includes('안전'));
    }
  });

  it('수준이 돼도 최근 거리가 모자라면 막는다', () => {
    const tenK = programFamilies.find((family) => family.id === 'first-10k');
    // 5K 단계지만 최근 가장 긴 거리가 조건에 못 미치는 경우입니다.
    const result = checkEligibility(tenK!, 'L4_5K', { longestRecentKm: 2 });
    assert.equal(result.allowed, false);
    if (!result.allowed) assert.ok(result.reason.includes('km'));
  });

  it('조건을 채우면 통과한다', () => {
    const tenK = programFamilies.find((family) => family.id === 'first-10k');
    assert.equal(checkEligibility(tenK!, 'L4_5K', fiveKRunner).allowed, true);
  });

  it('전문가 검수가 필요한 계획은 어떤 수준에도 열리지 않는다', () => {
    const expertOnly = {
      ...programFamilies[0],
      id: 'expert-test',
      releaseGate: 'EXPERT_REQUIRED' as const,
      eligibility: { minLevel: 'L0_MOVE' as UserLevelId },
    };
    for (const level of ['L0_MOVE', 'L5_10K', 'L9_ADVANCED'] as UserLevelId[]) {
      const result = checkEligibility(expertOnly, level, fiveKRunner);
      assert.equal(result.allowed, false, `${level}에서 전문가 계획이 열렸습니다`);
    }
  });
});

describe('추천', () => {
  it('처음 쓰는 사람에게도 시작할 수 있는 계획이 있다', () => {
    // 빈 화면을 주면 안 됩니다.
    const available = availableFamilies('L0_MOVE', noHistory);
    assert.ok(available.length > 0);
  });

  it('처음 쓰는 사람에게 10km 계획을 추천하지 않는다', () => {
    const available = availableFamilies('L0_MOVE', noHistory);
    assert.ok(!available.some((family) => family.id === 'first-10k'));
  });

  it('한 번에 세 개까지만 보여 준다', () => {
    // 100개를 늘어놓지 않는 것이 이 함수의 존재 이유입니다.
    const picks = recommendFamilies('L4_5K', fiveKRunner);
    assert.ok(picks.length <= 3);
    for (const pick of picks) {
      assert.equal(checkEligibility(pick, 'L4_5K', fiveKRunner).allowed, true);
    }
  });

  it('수준이 올라가면 추천도 달라진다', () => {
    const beginner = recommendFamilies('L0_MOVE', noHistory).map((family) => family.id);
    const runner = recommendFamilies('L4_5K', fiveKRunner).map((family) => family.id);
    assert.notDeepEqual(beginner, runner);
  });
});
