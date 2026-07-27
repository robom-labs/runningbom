// 새 음성 순위 규칙과 "음성 고르기" 저장값을 검증합니다.
// 핵심 약속 두 가지:
// 1) 자연스러움(구글 인터넷 음성)이 성별보다 먼저다.
// 2) 성별이 확실하지 않으면 추측하지 않고 중립 이름을 쓴다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  classifyVoiceGender,
  defaultCoachVoicePick,
  isGoogleVoice,
  koreanVoiceQuality,
  normalizeVoicePick,
  rankKoreanVoices,
  reconcileVoicePick,
  selectVoiceIdentifier,
  voiceInstallSteps,
  voicePitchRange,
  voiceRateRange,
  voiceTier,
  voiceTierLabels,
  type SpeechVoiceLike,
} from '../domains/coaching/voice';

const googleVoices: SpeechVoiceLike[] = [
  { identifier: 'ko-kr-x-koc-local', name: 'ko-kr-x-koc-local', language: 'ko-KR' },
  { identifier: 'ko-kr-x-kod-network', name: 'ko-kr-x-kod-network', language: 'ko-KR' },
  { identifier: 'ko-kr-x-ism-local', name: 'ko-kr-x-ism-local', language: 'ko-KR' },
  { identifier: 'en-us-x-sfg-local', name: 'en-us-x-sfg-local', language: 'en-US' },
];

const basicVoices: SpeechVoiceLike[] = [
  { identifier: 'ko-KR-SMTf00', name: 'Korean Female', language: 'ko-KR' },
  { identifier: 'ko-KR-default-compact', name: 'ko-KR compact', language: 'ko-KR' },
];

describe('목소리 등급 매기기', () => {
  it('구글 음성 이름 규칙을 알아본다', () => {
    assert.equal(isGoogleVoice(googleVoices[0]), true);
    assert.equal(isGoogleVoice(basicVoices[0]), false);
  });

  it('구글 인터넷 음성을 가장 자연스러운 등급으로 본다', () => {
    assert.equal(voiceTier(googleVoices[1]), 'onlineNatural');
    assert.equal(voiceTier(googleVoices[0]), 'offlineNatural');
    assert.equal(voiceTier(basicVoices[0]), 'basic');
    assert.equal(voiceTier(basicVoices[1]), 'lowQuality');
  });

  it('자연스러움이 성별보다 먼저다', () => {
    // 남성으로 고른 상태여도, 성별이 표시되지 않은 인터넷 음성이 맨 앞에 옵니다.
    assert.equal(selectVoiceIdentifier(googleVoices, 'male'), 'ko-kr-x-kod-network');
    assert.equal(selectVoiceIdentifier(googleVoices, 'female'), 'ko-kr-x-kod-network');
  });

  it('한국어가 아닌 음성은 목록에 넣지 않는다', () => {
    const ranked = rankKoreanVoices(googleVoices);
    assert.equal(ranked.length, 3);
    assert.ok(ranked.every((voice) => voice.language.toLowerCase().startsWith('ko')));
  });

  it('한국어 음성이 없으면 아무것도 고르지 않는다', () => {
    assert.equal(selectVoiceIdentifier([googleVoices[3]], 'female'), undefined);
  });
});

describe('성별 표기', () => {
  it('식별자에 성별이 적혀 있을 때만 성별을 말한다', () => {
    assert.equal(
      classifyVoiceGender({ identifier: 'ko-kr-x-ism#female_1-local', language: 'ko-KR' }),
      'female',
    );
    assert.equal(
      classifyVoiceGender({ identifier: 'ko-kr-x-kod#male_2-network', language: 'ko-KR' }),
      'male',
    );
  });

  it('성별 표시가 없으면 추측하지 않는다', () => {
    // 예전 규칙은 ko-kr-x-kod를 남성으로 "추측"했습니다. 틀리면 그게 어색함이 됩니다.
    assert.equal(classifyVoiceGender(googleVoices[1]), 'unknown');
    assert.equal(classifyVoiceGender(googleVoices[2]), 'unknown');
  });

  it('성별을 모르면 중립 이름을 순서대로 붙인다', () => {
    const ranked = rankKoreanVoices(googleVoices);
    assert.equal(ranked[0].label, '기기 음성 1');
    assert.equal(ranked[1].label, '기기 음성 2');
    assert.equal(ranked[2].label, '기기 음성 3');
  });

  it('성별이 확실하면 성별 이름을 붙인다', () => {
    const ranked = rankKoreanVoices([
      { identifier: 'ko-kr-x-ism#female_1-network', language: 'ko-KR' },
    ]);
    assert.equal(ranked[0].label, '여성 목소리');
  });

  it('화면에 쓰는 말에는 기술 용어를 넣지 않는다', () => {
    const labels = [...Object.values(voiceTierLabels), ...voiceInstallSteps].join(' ');
    assert.doesNotMatch(labels, /TTS|엔진|신경망|네트워크/);
  });
});

describe('기기 목소리 품질 진단', () => {
  it('좋은 목소리가 있으면 설치 안내를 띄우지 않는다', () => {
    const report = koreanVoiceQuality(googleVoices);
    assert.equal(report.level, 'good');
    assert.equal(report.suggestInstall, false);
    assert.equal(report.bestTier, 'onlineNatural');
  });

  it('기본 목소리만 있으면 설치를 안내한다', () => {
    const report = koreanVoiceQuality(basicVoices);
    assert.equal(report.level, 'basicOnly');
    assert.equal(report.suggestInstall, true);
    assert.match(report.detail, /자연스러운/);
  });

  it('한국어 목소리가 하나도 없으면 그렇게 말한다', () => {
    const report = koreanVoiceQuality([googleVoices[3]]);
    assert.equal(report.level, 'none');
    assert.equal(report.koreanCount, 0);
    assert.equal(report.suggestInstall, true);
  });

  it('설치 안내는 번호로 따라갈 수 있는 순서를 준다', () => {
    assert.ok(voiceInstallSteps.length >= 3);
    assert.ok(voiceInstallSteps.every((step) => step.trim().length > 0));
  });
});

describe('고른 목소리 저장값', () => {
  it('저장된 값이 없거나 깨져 있으면 기본값으로 돌아간다', () => {
    assert.deepEqual(normalizeVoicePick(undefined), defaultCoachVoicePick);
    assert.deepEqual(normalizeVoicePick('망가진 값'), defaultCoachVoicePick);
    assert.deepEqual(normalizeVoicePick({ identifier: '  ' }), defaultCoachVoicePick);
  });

  it('빠르기·높낮이를 안전한 범위 안으로 되돌린다', () => {
    const pick = normalizeVoicePick({ identifier: 'ko-kr-x-kod-network', rate: 9, pitch: -3 });
    assert.equal(pick.rate, voiceRateRange.max);
    assert.equal(pick.pitch, voicePitchRange.min);
    assert.equal(pick.identifier, 'ko-kr-x-kod-network');
  });

  it('고른 목소리를 지웠으면 저장값을 비운다', () => {
    const pick = normalizeVoicePick({ identifier: 'ko-kr-x-sold-out', rate: 1, pitch: 1 });
    assert.equal(reconcileVoicePick(pick, googleVoices).identifier, undefined);
    const kept = normalizeVoicePick({ identifier: 'ko-kr-x-kod-network', rate: 1, pitch: 1 });
    assert.equal(reconcileVoicePick(kept, googleVoices).identifier, 'ko-kr-x-kod-network');
  });

  it('고른 목소리가 자동 선택보다 우선한다', () => {
    assert.equal(
      selectVoiceIdentifier(googleVoices, 'female', 'ko-kr-x-ism-local'),
      'ko-kr-x-ism-local',
    );
    // 기기에 없는 목소리를 가리키면 자동 선택으로 되돌아갑니다.
    assert.equal(
      selectVoiceIdentifier(googleVoices, 'female', 'ko-kr-x-none'),
      'ko-kr-x-kod-network',
    );
  });
});
