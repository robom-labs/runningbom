// V6 1차 — 실행 길이·코치 축·금지 발언을 검증합니다.
//
// V6의 P0는 다음과 같습니다. 전부 여기서 잠급니다.
//   - 특정 길이(50분 등) 하드코딩 = 0
//   - 120분 상한 의존 = 0
//   - 오픈엔드에서 끝을 예고하는 말 = 0
//   - 센서 없이 봤다고 하는 말 = 0
//   - 매운맛 밖 욕설 = 0
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  SHORT_SESSION_SECONDS,
  WARMUP_SECONDS,
  extendExtent,
  extentLabel,
  hasKnownEnd,
  mayMentionDistance,
  mayMentionRemaining,
  progressView,
  sessionStage,
  totalSeconds,
  type SessionExtent,
} from '../domains/coaching/extent';
import { lintCoachLine, lintCoachLines, spicyAllowlist } from '../domains/coaching/claimLint';
import {
  bodyScanOrder,
  coachPersonas,
  densityFromGuidanceLevel,
  densityMaxUnintendedSilence,
  densitySpeechOccupancy,
  findPersona,
  nextBodyTheme,
  publicPersonas,
  resolvePersona,
  defaultCoachSettings,
} from '../domains/coaching/persona';
import {
  closingCues,
  generalCues,
  openingCues,
  phaseScripts,
  typeCues,
} from '../domains/coaching/cueLibrary';

function allLibraryLines(): string[] {
  const lines = new Set<string>();
  for (const pool of Object.values(generalCues)) for (const line of pool) lines.add(line);
  for (const byCategory of Object.values(typeCues)) {
    for (const pool of Object.values(byCategory)) for (const line of pool ?? []) lines.add(line);
  }
  for (const script of Object.values(phaseScripts)) {
    for (const line of [...script.pre, ...script.start, ...script.settle]) lines.add(line);
  }
  for (const line of [...openingCues, ...closingCues]) lines.add(line);
  return [...lines];
}

// ── 실행 길이 ───────────────────────────────────────────────────────────────

test('10분 미만도 2시간 초과도 잘리지 않습니다', () => {
  // 예전에는 Math.min(120, Math.max(10, 분))이 있었습니다.
  // 사용자가 3분을 골라도 10분이 되고, 3시간을 골라도 2시간이 됐습니다.
  for (const minutes of [3, 5, 121, 180, 360, 720]) {
    const extent: SessionExtent = { type: 'fixed-time', seconds: minutes * 60 };
    assert.equal(totalSeconds(extent), minutes * 60, `${minutes}분이 바뀌었습니다`);
  }
});

test('끝을 모르면 남은 시간을 말하지 않습니다', () => {
  // 이게 V6에서 가장 중요한 규칙입니다.
  // 끝을 안 정했는데 "거의 다 왔어요"가 나오면 코치가 뭔가 안다고 믿게 됩니다.
  for (const extent of [
    { type: 'open-ended' } as SessionExtent,
    { type: 'until-user-cooldown' } as SessionExtent,
  ]) {
    assert.equal(mayMentionRemaining(extent), false);
    const view = progressView({ extent, elapsedSeconds: 45 * 60 });
    assert.equal(view.remainingSeconds, undefined);
    assert.equal(view.ratio, undefined);
    assert.ok(!view.label.includes('남음'));
    assert.ok(!view.label.includes('거의'));
  }
});

test('끝이 정해졌으면 남은 시간을 말합니다', () => {
  const extent: SessionExtent = { type: 'fixed-time', seconds: 30 * 60 };
  assert.equal(mayMentionRemaining(extent), true);
  const view = progressView({ extent, elapsedSeconds: 20 * 60 });
  assert.equal(view.remainingSeconds, 10 * 60);
  assert.match(view.label, /10분 남음/);
});

test('워밍업을 비율이 아니라 시간으로 잡습니다', () => {
  // 비율로 하면 3시간 러닝에서 워밍업만 27분이 되고, 10분 러닝에서는 90초에 끝납니다.
  const long: SessionExtent = { type: 'fixed-time', seconds: 180 * 60 };
  assert.equal(sessionStage({ extent: long, elapsedSeconds: WARMUP_SECONDS - 1 }), 'warmup');
  assert.equal(sessionStage({ extent: long, elapsedSeconds: WARMUP_SECONDS + 1 }), 'steady');
});

test('짧은 러닝에서는 워밍업이 전체를 잡아먹지 않습니다', () => {
  const short: SessionExtent = { type: 'fixed-time', seconds: 10 * 60 };
  assert.ok(totalSeconds(short) !== undefined && (totalSeconds(short) as number) <= SHORT_SESSION_SECONDS);
  // 8분 워밍업이면 10분 러닝이 거의 다 워밍업입니다. 짧게 줄여야 합니다.
  assert.equal(sessionStage({ extent: short, elapsedSeconds: 4 * 60 }), 'steady');
});

test('끝을 모르면 막바지 단계가 없습니다', () => {
  // 영원히 안정 구간입니다. 언제 힘들어질지 우리가 정할 수 없습니다.
  const open: SessionExtent = { type: 'open-ended' };
  for (const minutes of [10, 60, 200, 700]) {
    assert.equal(sessionStage({ extent: open, elapsedSeconds: minutes * 60 }), 'steady');
  }
});

test('사용자가 마무리를 누르면 무엇보다 먼저입니다', () => {
  const open: SessionExtent = { type: 'open-ended' };
  assert.equal(
    sessionStage({ extent: open, elapsedSeconds: 60, cooldownRequested: true }),
    'cooldown',
  );
});

test('실행 중에 시간을 늘릴 수 있고 상한이 없습니다', () => {
  let extent: SessionExtent = { type: 'fixed-time', seconds: 110 * 60 };
  extent = extendExtent(extent, 30 * 60);
  // 예전 clamp였다면 120분에서 막혔습니다.
  assert.equal(totalSeconds(extent), 140 * 60);
});

test('끝이 없는 러닝은 늘릴 것이 없습니다', () => {
  const open: SessionExtent = { type: 'open-ended' };
  assert.deepEqual(extendExtent(open, 600), open);
});

test('12시간 오픈엔드에서도 판단이 무너지지 않습니다', () => {
  const open: SessionExtent = { type: 'open-ended' };
  for (let minute = 0; minute <= 720; minute += 30) {
    const view = progressView({ extent: open, elapsedSeconds: minute * 60 });
    assert.ok(view.label.length > 0);
    assert.equal(view.remainingSeconds, undefined);
  }
});

test('거리는 목표가 있거나 실제로 재고 있을 때만 말합니다', () => {
  const time: SessionExtent = { type: 'fixed-time', seconds: 1800 };
  assert.equal(mayMentionDistance(time, false), false);
  assert.equal(mayMentionDistance(time, true), true);
  assert.equal(mayMentionDistance({ type: 'fixed-distance', meters: 5000 }, false), true);
});

test('실행 길이마다 화면에 쓸 이름이 있습니다', () => {
  assert.equal(extentLabel({ type: 'fixed-time', seconds: 1800 }), '30분');
  assert.equal(extentLabel({ type: 'fixed-distance', meters: 5000 }), '5km');
  assert.equal(extentLabel({ type: 'open-ended' }), '자유롭게');
  assert.equal(extentLabel({ type: 'until-user-cooldown' }), '끝낼 때까지');
});

test('코드에 특정 길이가 박혀 있지 않습니다', () => {
  // "50분이면", "최대 120분" 같은 것이 다시 들어오는 것을 막습니다.
  const source = readFileSync(join(__dirname, '..', 'domains/coaching/extent.ts'), 'utf8');
  for (const banned of ['50분이면', '40분 세션', '항상 30분', '최대 120분']) {
    assert.ok(!source.includes(banned), `"${banned}"가 들어 있습니다`);
  }
});

// ── 금지 발언 ───────────────────────────────────────────────────────────────

test('센서 없이 봤다고 하는 말을 잡습니다', () => {
  const bad = [
    '지금 어깨가 올라갔어.',
    '지금 뒤꿈치로 착지했어.',
    '발아치가 무너졌잖아.',
    '왼쪽 무릎이 안으로 들어갔어.',
  ];
  for (const line of bad) {
    const issues = lintCoachLine(line);
    assert.ok(issues.length > 0, `못 잡았습니다: ${line}`);
    assert.equal(issues[0]?.code, 'sensing-lie');
  }
});

test('사용자가 확인하게 하는 말은 통과합니다', () => {
  // 이게 허용되어야 진짜 코치처럼 말할 수 있습니다.
  const good = [
    '어깨 올라갔으면 지금 내려. 손에도 힘 빼.',
    '무릎이 안쪽으로 모이려 하지 않는지 한 번 확인해.',
    '발가락 움켜쥐고 있으면 지금 풀어.',
    '발이 몸보다 멀리 뻗고 있으면 보폭부터 조금 줄여.',
  ];
  for (const line of good) {
    assert.deepEqual(lintCoachLine(line), [], `잘못 걸렸습니다: ${line}`);
  }
});

test('모두에게 맞는 각도라고 단정하면 잡습니다', () => {
  assert.ok(lintCoachLine('상체를 15도 앞으로 기울이세요.').length > 0);
  assert.ok(lintCoachLine('팔꿈치는 정확히 90도로 유지하세요.').length > 0);
});

test('착지 강요와 케이던스 정답 단정을 잡습니다', () => {
  assert.ok(lintCoachLine('앞꿈치로 착지해.').length > 0);
  assert.ok(lintCoachLine('180이 정답입니다.').length > 0);
  assert.ok(lintCoachLine('케이던스를 올리면 부상을 막아 줍니다.').length > 0);
});

test('통증을 참으라는 말은 어떤 코치에서도 막습니다', () => {
  // 매운맛이라도 예외가 없습니다.
  for (const spicy of [false, true]) {
    assert.ok(lintCoachLine('아파도 뛰어.', { spicy }).length > 0);
    assert.ok(lintCoachLine('통증은 무시해.', { spicy }).length > 0);
  }
});

test('매운맛 밖에서는 거친 말이 안 나옵니다', () => {
  for (const word of spicyAllowlist) {
    assert.ok(lintCoachLine(`${word} 지금 다시 가.`).length > 0, `${word}가 통과했습니다`);
  }
});

test('매운맛에서는 allowlist만 허용됩니다', () => {
  assert.deepEqual(lintCoachLine('정신 차려. 자세부터 다시 잡아.', { spicy: true }), []);
  // 사람을 겨냥한 모욕은 매운맛에서도 안 됩니다.
  assert.ok(lintCoachLine('이 병신아 뛰어.', { spicy: true }).length > 0);
  assert.ok(lintCoachLine('그렇게 뚱뚱하니까 그렇지.', { spicy: true }).length > 0);
});

test('실존 캐릭터 흉내를 막습니다', () => {
  assert.ok(lintCoachLine('짱구처럼 신나게 가 보자.').length > 0);
});

test('지금 쓰는 문장 전부가 규칙을 지킵니다', () => {
  // 라이브러리에 실제로 위반이 하나 있었고(팔꿈치 90도), 이 테스트가 잡았습니다.
  const violations = lintCoachLines(allLibraryLines());
  assert.deepEqual(
    violations.map((entry) => `${entry.issues[0]?.code}: ${entry.line}`),
    [],
  );
});

// ── 코치 축 ─────────────────────────────────────────────────────────────────

test('성격·말투·밀도가 따로 고르는 축입니다', () => {
  // 고정 모드 몇 개만 있으면 "엄격한데 존댓말"을 못 만듭니다.
  assert.ok(coachPersonas.length >= 7);
  for (const persona of coachPersonas) {
    assert.ok(persona.sample.honorific.length > 0, `${persona.id} 존댓말 예문 없음`);
    assert.ok(persona.sample.casual.length > 0, `${persona.id} 반말 예문 없음`);
  }
});

test('예문이 실제로 존댓말과 반말로 다릅니다', () => {
  // 어미만 바꾼 게 아니라 문장 자체가 달라야 자연스럽습니다.
  for (const persona of coachPersonas) {
    assert.notEqual(persona.sample.honorific, persona.sample.casual, persona.id);
  }
});

test('코치 예문에 금지 발언이 없습니다', () => {
  for (const persona of coachPersonas) {
    const spicy = Boolean(persona.adultOnly);
    for (const line of [persona.sample.honorific, persona.sample.casual]) {
      assert.deepEqual(lintCoachLine(line, { spicy }), [], `${persona.id}: ${line}`);
    }
  }
});

test('매운맛은 기본이 아니고 목록에서도 빠집니다', () => {
  assert.equal(defaultCoachSettings.spicyEnabled, false);
  assert.notEqual(defaultCoachSettings.personaId, 'spicy-drill');
  assert.ok(!publicPersonas().some((persona) => persona.adultOnly));
});

test('성인 확인 없이는 매운맛이 켜지지 않습니다', () => {
  const wanted = { ...defaultCoachSettings, personaId: 'spicy-drill' as const, spicyEnabled: true };
  // 설정만 있고 확인이 없으면 순한 교관으로 내려갑니다.
  assert.equal(resolvePersona(wanted, false).id, 'drill-sergeant');
  assert.equal(resolvePersona(wanted, true).id, 'spicy-drill');
});

test('확인만 있고 설정을 안 켰으면 역시 안 켜집니다', () => {
  const off = { ...defaultCoachSettings, personaId: 'spicy-drill' as const, spicyEnabled: false };
  assert.equal(resolvePersona(off, true).id, 'drill-sergeant');
});

test('밀도가 높을수록 말이 많고 침묵 상한이 짧습니다', () => {
  const order = ['essential', 'balanced', 'close-coach', 'full-talk'] as const;
  for (let index = 1; index < order.length; index += 1) {
    const previous = order[index - 1] as (typeof order)[number];
    const current = order[index] as (typeof order)[number];
    assert.ok(
      densitySpeechOccupancy[current].min > densitySpeechOccupancy[previous].min,
      `${current}가 ${previous}보다 말이 많아야 합니다`,
    );
    assert.ok(
      densityMaxUnintendedSilence[current] < densityMaxUnintendedSilence[previous],
      `${current}의 침묵 상한이 더 짧아야 합니다`,
    );
  }
});

test('풀토크는 말 점유율 75~95%, 의도치 않은 침묵 6초 이하입니다', () => {
  assert.equal(densitySpeechOccupancy['full-talk'].min, 0.75);
  assert.equal(densitySpeechOccupancy['full-talk'].max, 0.95);
  assert.equal(densityMaxUnintendedSilence['full-talk'], 6);
});

test('예전 설정이 조용히 바뀌지 않습니다', () => {
  assert.equal(densityFromGuidanceLevel('minimal'), 'essential');
  assert.equal(densityFromGuidanceLevel('standard'), 'balanced');
  assert.equal(densityFromGuidanceLevel('detailed'), 'close-coach');
  // 모르는 값이면 가장 무난한 쪽입니다.
  assert.equal(densityFromGuidanceLevel(undefined), 'balanced');
  assert.equal(densityFromGuidanceLevel('없는값'), 'balanced');
});

test('몸을 머리부터 발끝까지 순서대로 돕니다', () => {
  assert.equal(bodyScanOrder[0], 'head');
  assert.ok(bodyScanOrder.includes('feet'));
  // 끝까지 가면 처음으로 돌아옵니다.
  const last = bodyScanOrder.length - 1;
  assert.equal(nextBodyTheme(last).cursor, 0);
  assert.equal(nextBodyTheme(0).theme, bodyScanOrder[1]);
});

test('모르는 코치 id를 넘겨도 기본 코치로 돌아옵니다', () => {
  assert.equal(findPersona('없는값'), undefined);
  assert.equal(resolvePersona({ ...defaultCoachSettings, personaId: '없는값' as never }, false).id, 'professional');
});
