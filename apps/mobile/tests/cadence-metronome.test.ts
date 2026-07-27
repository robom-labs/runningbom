// 러닝 메트로놈 규칙을 검증합니다.
//
// 이 파일에서 보는 것의 절반은 "빠르게 하는 법"이 아니라 **"급하게 못 올리게 막는 법"** 입니다.
// 케이던스를 급히 바꾸면 종아리·정강이가 먼저 상하고, 그건 앱이 만든 부상입니다.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_CADENCE,
  MAX_CADENCE,
  MAX_STEP_UP,
  MIN_CADENCE,
  beatIntervalMillis,
  cadenceLabel,
  changeCadence,
  clampCadence,
  commonCadences,
  metronomeDecision,
  nextBeatDelay,
  startingCadence,
  suggestedTarget,
} from '../domains/cadence/metronome';

test('한 번에 5보 넘게 올리지 못합니다', () => {
  // 이게 이 파일에서 가장 중요한 테스트입니다.
  const result = changeCadence(160, 180);
  assert.equal(result.next, 165);
  assert.equal(result.limited, true);
});

test('깎였으면 반드시 말해 줍니다', () => {
  // 조용히 깎으면 사용자는 앱이 고장 난 줄 압니다.
  const result = changeCadence(160, 180);
  assert.ok(result.note);
  assert.match(result.note as string, /종아리/);
});

test('내리는 것은 막지 않습니다', () => {
  // 내리는 건 언제나 안전합니다.
  const result = changeCadence(190, 160);
  assert.equal(result.next, 160);
  assert.equal(result.limited, false);
});

test('5보까지는 그대로 올라갑니다', () => {
  const result = changeCadence(170, 175);
  assert.equal(result.next, 175);
  assert.equal(result.limited, false);
});

test('러닝 범위를 벗어나지 않습니다', () => {
  assert.equal(clampCadence(10), MIN_CADENCE);
  assert.equal(clampCadence(300), MAX_CADENCE);
  assert.equal(changeCadence(198, 220).next, MAX_CADENCE);
});

test('이상한 값이 들어와도 기본값으로 돌아옵니다', () => {
  assert.equal(clampCadence(Number.NaN), DEFAULT_CADENCE);
  assert.equal(clampCadence(Number.POSITIVE_INFINITY), DEFAULT_CADENCE);
});

test('내 기록이 있으면 거기서 시작합니다', () => {
  // 남의 평균값에서 시작하면 첫 1분부터 어긋납니다.
  assert.equal(startingCadence(163), 163);
  assert.equal(startingCadence(undefined), DEFAULT_CADENCE);
});

test('목표는 지금보다 5보까지만 권합니다', () => {
  // 지금 155인 사람에게 180은 목표가 아니라 부상입니다.
  assert.equal(suggestedTarget(155), 160);
  assert.equal(suggestedTarget(198), MAX_CADENCE);
});

test('자주 쓰는 값은 셋뿐입니다', () => {
  // 스물한 개를 늘어놓으면 고르다 지칩니다.
  assert.equal(commonCadences.length, 3);
});

test('박자 간격이 맞습니다', () => {
  assert.equal(beatIntervalMillis(180), 60_000 / 180);
  assert.ok(beatIntervalMillis(160) > beatIntervalMillis(180));
});

test('걷는 구간에서는 저절로 멈춥니다', () => {
  // 걸으면서 달리기 박자를 들으면 방해만 됩니다.
  const decision = metronomeDecision({ walking: true, coachSpeaking: false, enabled: true });
  assert.equal(decision.playing, false);
  assert.match(decision.reason as string, /걷는 구간/);
});

test('코치가 말할 때는 코치가 먼저입니다', () => {
  // 안내를 못 들으면 회차를 따라갈 수 없습니다.
  const decision = metronomeDecision({ walking: false, coachSpeaking: true, enabled: true });
  assert.equal(decision.playing, false);
});

test('안 나는 데는 항상 이유가 붙습니다', () => {
  // 이유 없이 조용하면 고장으로 보입니다.
  for (const context of [
    { walking: true, coachSpeaking: false, enabled: true },
    { walking: false, coachSpeaking: true, enabled: true },
  ]) {
    assert.ok(metronomeDecision(context).reason);
  }
});

test('꺼져 있으면 이유 없이 그냥 안 냅니다', () => {
  // 스스로 껐는데 "왜 안 나는지" 설명을 붙이면 잔소리가 됩니다.
  const decision = metronomeDecision({ walking: false, coachSpeaking: false, enabled: false });
  assert.equal(decision.playing, false);
  assert.equal(decision.reason, undefined);
});

test('켜져 있고 뛰는 중이면 냅니다', () => {
  const decision = metronomeDecision({ walking: false, coachSpeaking: false, enabled: true });
  assert.equal(decision.playing, true);
});

test('박자가 밀리지 않게 흘러간 시간을 보정합니다', () => {
  // setInterval만 쓰면 30분 달리는 동안 발과 소리가 눈에 띄게 어긋납니다.
  const interval = beatIntervalMillis(180);
  // 시작 직후: 한 박자 뒤에 칩니다.
  assert.equal(Math.round(nextBeatDelay(0, 0, 180)), Math.round(interval));
  // 세 박자가 지났으면 네 번째 박자까지 남은 시간만 기다립니다.
  const after = interval * 3.4;
  const delay = nextBeatDelay(0, after, 180);
  assert.ok(delay < interval, '보정하지 않으면 매번 한 박자씩 밀립니다');
  assert.equal(Math.round(delay), Math.round(interval * 0.6));
});

test('이미 지나간 박자여도 음수를 돌려주지 않습니다', () => {
  assert.ok(nextBeatDelay(1000, 0, 180) >= 0);
});

test('숫자만 있으면 빠른지 느린지 모릅니다', () => {
  assert.match(cadenceLabel(170), /가장 많이 쓰는/);
  assert.match(cadenceLabel(163), /분당 163보/);
});

test('올릴 수 있는 최대 폭이 5보로 잠겨 있습니다', () => {
  // 이 값이 커지면 안전선이 무너집니다. 상수 자체를 잠급니다.
  assert.equal(MAX_STEP_UP, 5);
});
