// V6 2차 — 코치 설정을 읽는 판단을 잠급니다.
//
// 여기서 지키는 약속은 하나입니다.
//   **사용자가 고른 것을 조용히 바꾸지 않는다.**
// 설정이 한 번이라도 자기 마음대로 바뀌면, 사용자는 그 뒤로 설정 화면을 믿지 않습니다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_PERSONA_ID,
  defaultCoachSettings,
  guidanceLevelFromDensity,
  resolvePersona,
} from '../domains/coaching/persona';
import {
  HUSH_SECONDS,
  adjustDensity,
  normalizeCoachSettings,
  quickAdjustLabels,
} from '../domains/coaching/personaNormalize';

test('처음 켠 사람은 예전 안내 강도의 뜻을 이어받습니다', () => {
  // 자세히로 달리던 사람이 갑자기 조용해지면 안 됩니다.
  assert.equal(normalizeCoachSettings({ legacyGuidance: 'detailed' }).density, 'close-coach');
  assert.equal(normalizeCoachSettings({ legacyGuidance: 'minimal' }).density, 'essential');
  assert.equal(normalizeCoachSettings({ legacyGuidance: 'standard' }).density, 'balanced');
  // 고른 적이 없으면 무난한 쪽입니다.
  assert.equal(normalizeCoachSettings().density, 'balanced');
  // 매운맛은 어떤 경로로도 기본이 아닙니다.
  assert.equal(normalizeCoachSettings({ legacyGuidance: 'detailed' }).spicyEnabled, false);
  assert.equal(normalizeCoachSettings().personaId, DEFAULT_PERSONA_ID);
});

test('이미 고른 설정은 예전 값이 덮어쓰지 않습니다', () => {
  const stored = {
    personaId: 'form-nag',
    register: 'casual',
    density: 'essential',
    spicyEnabled: false,
  };
  // 예전 안내 강도가 '자세히'여도, 골라 둔 '꼭 필요한 말만'이 이깁니다.
  const settings = normalizeCoachSettings({ stored, legacyGuidance: 'detailed' });
  assert.equal(settings.density, 'essential');
  assert.equal(settings.personaId, 'form-nag');
  assert.equal(settings.register, 'casual');
});

test('저장이 깨져도 쓸 수 있는 설정이 나옵니다', () => {
  const broken = normalizeCoachSettings({
    stored: { personaId: '없는코치', register: '반말체', density: '엄청많이', focusTheme: '배꼽' },
  });
  assert.equal(broken.personaId, DEFAULT_PERSONA_ID);
  assert.equal(broken.register, defaultCoachSettings.register);
  assert.equal(broken.density, 'balanced');
  assert.equal(broken.focusTheme, undefined);
  assert.equal(broken.spicyEnabled, false);
});

test('매운맛은 저장돼 있어도 성인 확인 없이는 나오지 않습니다', () => {
  const stored = { personaId: 'spicy-drill', register: 'casual', density: 'full-talk', spicyEnabled: true };
  const settings = normalizeCoachSettings({ stored });
  // 저장은 그대로 둡니다. 사용자가 고른 것을 지우지 않습니다.
  assert.equal(settings.personaId, 'spicy-drill');
  assert.equal(settings.spicyEnabled, true);
  // 그런데 실제로 나오는 코치는 성인 확인이 있어야만 매운맛입니다.
  assert.equal(resolvePersona(settings, false).id, 'drill-sergeant');
  assert.equal(resolvePersona(settings, true).id, 'spicy-drill');
});

test('실행 중 조절은 한 칸씩만 움직이고 끝에서 멈춥니다', () => {
  assert.equal(adjustDensity('balanced', 'louder'), 'close-coach');
  assert.equal(adjustDensity('balanced', 'quieter'), 'essential');
  // 끝에서 더 가지 않습니다.
  assert.equal(adjustDensity('essential', 'quieter'), 'essential');
  assert.equal(adjustDensity('full-talk', 'louder'), 'full-talk');
  // 잠깐 조용히는 설정을 바꾸는 게 아닙니다.
  assert.equal(adjustDensity('full-talk', 'hush'), 'full-talk');
  assert.equal(HUSH_SECONDS, 30);
  assert.equal(Object.keys(quickAdjustLabels).length, 3);
});

test('새 말수가 코칭 엔진이 아는 값으로 되돌아갑니다', () => {
  assert.equal(guidanceLevelFromDensity('essential'), 'minimal');
  assert.equal(guidanceLevelFromDensity('balanced'), 'standard');
  assert.equal(guidanceLevelFromDensity('close-coach'), 'detailed');
  // 풀토크는 아직 가장 촘촘한 쪽에 붙습니다. "쉼 없이"는 다음 단계입니다.
  assert.equal(guidanceLevelFromDensity('full-talk'), 'detailed');
});
