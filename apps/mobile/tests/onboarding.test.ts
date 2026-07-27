// 첫 실행 온보딩의 단계 순서, 목표 저장, 닉네임 규칙, 재노출 방지 규칙을 회귀 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildOnboardingSteps,
  checkNickname,
  coachSentenceTotal,
  defaultGoalPresetId,
  goalFromPreset,
  goalPresets,
  introHighlights,
  isLastOnboardingStep,
  nextOnboardingStep,
  onboardingStepCount,
  onboardingStepIds,
  onboardingStepIndex,
  onboardingStepSubtitles,
  onboardingStepTitles,
  previousOnboardingStep,
  voiceChoiceNote,
} from '../app/screens/onboarding/steps';
import {
  ONBOARDING_KEY,
  emptyOnboardingStatus,
  looksLikeExistingUser,
  parseOnboardingStatus,
  resolveOnboardingStatus,
} from '../app/screens/onboarding/status';
import type { ActivityRecord } from '../domains/activities/types';

function activity(completedAt: string): ActivityRecord {
  return {
    id: completedAt,
    localUuid: 'local-test',
    kind: 'run',
    durationMinutes: 30,
    source: 'COACH_COMPLETED',
    completedAt,
    timezoneId: 'Asia/Seoul',
  };
}

describe('온보딩 단계', () => {
  it('소개·목표·지금 상태·음성 다음에 로그인 자리와 허락 안내가 이어진다', () => {
    assert.deepEqual(onboardingStepIds, [
      'intro',
      'goal',
      // 지금 상태는 목표 바로 뒤입니다. 이 답 하나로 온보딩 끝에 계획이 깔립니다.
      'start',
      'voice',
      'login',
      'notification',
      'location',
      'battery',
      'done',
    ]);
    assert.equal(onboardingStepCount, 9);
    assert.equal(onboardingStepIndex('goal'), 1);
    assert.equal(nextOnboardingStep('intro'), 'goal');
    assert.equal(nextOnboardingStep('goal'), 'start');
    assert.equal(nextOnboardingStep('start'), 'voice');
    assert.equal(nextOnboardingStep('voice'), 'login');
    assert.equal(nextOnboardingStep('done'), undefined);
    assert.equal(previousOnboardingStep('intro'), undefined);
    assert.equal(previousOnboardingStep('voice'), 'start');
    assert.equal(isLastOnboardingStep('done'), true);
    assert.equal(isLastOnboardingStep('goal'), false);
  });

  it('보여 줄 단계만 남긴 배열 위에서 앞뒤로 움직이고 진행 점도 그 배열을 따른다', () => {
    const steps = buildOnboardingSteps({ locationStep: false, batteryStep: true });
    assert.equal(nextOnboardingStep('notification', steps), 'battery');
    assert.equal(previousOnboardingStep('battery', steps), 'notification');
    assert.equal(onboardingStepIndex('done', steps), steps.length - 1);
    assert.equal(isLastOnboardingStep('done', steps), true);
    assert.equal(isLastOnboardingStep('battery', steps), false);
  });

  it('모든 단계에 제목과 안내 문구가 있다', () => {
    for (const step of onboardingStepIds) {
      assert.ok(onboardingStepTitles[step].length > 0, `${step} 제목 누락`);
      assert.ok(onboardingStepSubtitles[step].length > 0, `${step} 안내 누락`);
    }
  });

  it('마지막 화면은 설정에서 바꿀 수 있다는 사실을 알려 준다', () => {
    assert.ok(voiceChoiceNote.includes('설정'));
    assert.ok(onboardingStepSubtitles.voice.includes('설정'));
  });

  it('소개 문구는 앱이 실제로 가진 개수를 그대로 쓴다', () => {
    const highlights = introHighlights({ coachSentences: 744, shoes: 123, races: 125 });
    assert.equal(highlights.length, 3);
    assert.ok(highlights[0]?.body.includes('744'));
    assert.ok(highlights[1]?.title.includes('123'));
    assert.ok(highlights[2]?.title.includes('125'));
  });

  it('코치 문장 수는 실제 문장 풀에서 세고 넉넉히 많다', () => {
    const total = coachSentenceTotal();
    assert.ok(total >= 300, `코치 문장 수: ${total}`);
    assert.equal(total, coachSentenceTotal());
  });
});

describe('온보딩 목표 선택', () => {
  it('기본 선택은 주 3회이고 선택지마다 설명이 있다', () => {
    assert.equal(defaultGoalPresetId, 'steady');
    for (const preset of goalPresets) {
      assert.ok(preset.label.length > 0);
      assert.ok(preset.description.length > 0);
    }
  });

  it('주 N회 선택은 사용자가 고른 횟수 목표로 저장된다', () => {
    const goal = goalFromPreset('light');
    assert.deepEqual(goal, { metric: 'sessions', target: 2, auto: false });
    assert.equal(goalFromPreset('active').target, 4);
  });

  it('자동 추천은 기록 기반 추천 규칙을 그대로 쓴다', () => {
    const goal = goalFromPreset('auto', [], new Date('2026-07-22T12:00:00.000Z'));
    assert.equal(goal.auto, true);
    assert.equal(goal.metric, 'sessions');
    assert.equal(goal.target, 2);
  });
});

describe('온보딩 닉네임(선택 입력)', () => {
  it('비워 두면 통과하고 기본 닉네임을 유지한다', () => {
    const result = checkNickname('   ');
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value, '');
  });

  it('공백을 정리하고 2~16자만 허용한다', () => {
    const ok = checkNickname('  아침  러너 ');
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.value, '아침 러너');
    assert.equal(checkNickname('가').ok, false);
    assert.equal(checkNickname('가'.repeat(17)).ok, false);
  });

  it('운영 주체로 오해할 수 있는 닉네임을 막는다', () => {
    assert.equal(checkNickname('운영자').ok, false);
    assert.equal(checkNickname('러닝봄').ok, false);
  });
});

describe('온보딩 재노출 방지', () => {
  it('새 저장 키만 쓰고 기존 키를 건드리지 않는다', () => {
    assert.equal(ONBOARDING_KEY, 'runningbom:vnext:onboarding:v1');
    assert.notEqual(ONBOARDING_KEY, 'runningbom:vnext:preferences:v1');
  });

  it('손상된 저장값은 "아직 안 봤음"으로 되돌린다', () => {
    assert.deepEqual(parseOnboardingStatus(null), emptyOnboardingStatus);
    assert.deepEqual(parseOnboardingStatus({ completed: 'yes' }), emptyOnboardingStatus);
    assert.deepEqual(parseOnboardingStatus({ completed: true, reason: 'skipped' }), {
      completed: true,
      reason: 'skipped',
    });
  });

  it('완료 기록이 있으면 다시 띄우지 않는다', () => {
    const resolved = resolveOnboardingStatus({ completed: true, reason: 'finished' }, false);
    assert.equal(resolved.required, false);
    assert.equal(resolved.nextStatus, undefined);
  });

  it('이미 기록이 있는 사용자에게는 띄우지 않고 조용히 완료로 표시한다', () => {
    assert.equal(
      looksLikeExistingUser({ activities: [activity('2026-07-20T12:00:00.000Z')], plans: [] }),
      true,
    );
    assert.equal(looksLikeExistingUser({ activities: [], plans: [{ id: 'plan' }] }), true);
    assert.equal(
      looksLikeExistingUser({
        activities: [],
        plans: [],
        storedGoal: { metric: 'sessions', target: 3, auto: false },
      }),
      true,
    );
    assert.equal(looksLikeExistingUser({ activities: [], plans: [] }), false);

    const resolved = resolveOnboardingStatus(emptyOnboardingStatus, true, '2026-07-26T00:00:00.000Z');
    assert.equal(resolved.required, false);
    assert.deepEqual(resolved.nextStatus, {
      completed: true,
      reason: 'existing-user',
      completedAt: '2026-07-26T00:00:00.000Z',
    });
  });

  it('기록이 전혀 없는 첫 실행에서만 온보딩을 띄운다', () => {
    const resolved = resolveOnboardingStatus(emptyOnboardingStatus, false);
    assert.equal(resolved.required, true);
    assert.equal(resolved.nextStatus, undefined);
  });
});
