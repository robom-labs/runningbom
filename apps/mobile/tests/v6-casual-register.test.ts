// V6 — 반말 대사를 잠급니다.
//
// 이 파일이 지키는 것은 하나입니다.
//   **설정에서 반말을 고를 수 있다면, 실제로 반말이 나와야 한다.**
// 반쪽만 옮겨진 문장이 나가는 것은 존댓말만 있는 것보다 나쁩니다.
import assert from 'node:assert/strict';
import test from 'node:test';

import * as cueLibrary from '../domains/coaching/cueLibrary';
import { applyRegister, createCoachSession } from '../domains/coaching/model';
import { speakAs, toCasual } from '../domains/coaching/register';

/** 대사표 안의 모든 문장을 모읍니다. */
function allCueTexts(): string[] {
  const found = new Set<string>();
  const walk = (value: unknown) => {
    if (typeof value === 'string') {
      if (/[.!?]/.test(value)) found.add(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(cueLibrary);
  return [...found];
}

test('대사표의 모든 문장이 반말로 옮겨집니다', () => {
  const texts = allCueTexts();
  assert.ok(texts.length > 700, `문장이 ${texts.length}개뿐입니다`);

  const missed: string[] = [];
  for (const text of texts) {
    const result = toCasual(text);
    if (result.unconverted.length > 0) missed.push(...result.unconverted);
  }
  // 새 어미가 들어오면 여기서 막힙니다. 조용히 부서진 반말이 나가는 것보다 낫습니다.
  assert.deepEqual(missed, [], `옮기지 못한 문장 ${missed.length}개`);
});

test('반말로 옮긴 문장에 존댓말이 남아 있지 않습니다', () => {
  for (const text of allCueTexts()) {
    const casual = toCasual(text).text;
    assert.ok(!/요[.!?]/.test(casual), `존댓말이 남았습니다: ${casual}`);
    assert.ok(!/세요/.test(casual), `높임 명령이 남았습니다: ${casual}`);
    assert.ok(!/입니다|습니다/.test(casual), `합쇼체가 남았습니다: ${casual}`);
  }
});

test('부서지기 쉬운 어미를 정확히 옮깁니다', () => {
  // 요만 떼면 한국어가 부서지는 것들입니다.
  assert.equal(toCasual('여기는 회복 구간이에요.').text, '여기는 회복 구간이야.');
  assert.equal(toCasual('오늘은 가벼운 러닝이 목표예요.').text, '오늘은 가벼운 러닝이 목표야.');
  assert.equal(toCasual('서두를 일이 아니에요.').text, '서두를 일이 아니야.');
  assert.equal(toCasual('어깨 힘을 빼 주세요.').text, '어깨 힘을 빼 줘.');
  assert.equal(toCasual('시선은 앞에 두세요.').text, '시선은 앞에 둬.');
  assert.equal(toCasual('한 번만 확인해 보세요.').text, '한 번만 확인해 봐.');
  // 요만 떼면 되는 것들입니다.
  assert.equal(toCasual('천천히 가 볼게요.').text, '천천히 가 볼게.');
  assert.equal(toCasual('지금 리듬 좋아요.').text, '지금 리듬 좋아.');
});

test('한 큐 안의 문장을 하나씩 옮깁니다', () => {
  assert.equal(
    toCasual('어깨 힘을 빼 주세요. 지금 리듬 좋아요. 이대로 가 볼게요.').text,
    '어깨 힘을 빼 줘. 지금 리듬 좋아. 이대로 가 볼게.',
  );
});

test('모르는 어미는 옮기지 않고 신고합니다', () => {
  // 존댓말이지만 우리가 모르는 형태입니다. 부서뜨리지 않고 신고합니다.
  const result = toCasual('지금 바로 일어나세요.');
  assert.equal(result.unconverted.length, 1);
  // 그리고 실제로 말할 때는 원문 존댓말을 씁니다. 부서진 반말보다 낫습니다.
  assert.equal(speakAs('지금 바로 일어나세요.', 'casual'), '지금 바로 일어나세요.');
});

test('존댓말을 고르면 아무것도 바뀌지 않습니다', () => {
  const original = createCoachSession('이지런', 30, 'standard');
  const same = applyRegister(original, 'honorific');
  assert.equal(same, original);
  assert.equal(same.id, original.id);
});

test('반말 세션은 모든 큐가 반말이고 id로 구분됩니다', () => {
  const original = createCoachSession('이지런', 30, 'standard');
  const casual = applyRegister(original, 'casual');

  assert.ok(casual.id.endsWith(':casual'));
  assert.equal(casual.cues.length, original.cues.length);
  // 시각은 그대로여야 합니다. 말투를 바꿨다고 코칭 흐름이 달라지면 안 됩니다.
  assert.deepEqual(
    casual.cues.map((cue) => cue.offsetSeconds),
    original.cues.map((cue) => cue.offsetSeconds),
  );
  for (const cue of casual.cues) {
    assert.ok(!/요[.!?]/.test(cue.text), `존댓말이 남았습니다: ${cue.text}`);
  }
});
