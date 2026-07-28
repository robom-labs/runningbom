// V6 — 자세 커리큘럼이 러닝을 넘어 이어지는지 확인합니다.
//
// 이게 없으면 커리큘럼은 있으나 마나입니다.
// 매 러닝이 "머리부터"로 시작하면, 20분씩 뛰는 사람은 머리·어깨·팔까지만 듣습니다.
// 몇 달을 달려도 발 이야기는 한 번도 못 듣습니다.
import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeCoachSettings } from '../domains/coaching/personaNormalize';
import { createCoachSession, planLongformSession } from '../domains/coaching/model';
import { nextBodyCursor, planLongform } from '../domains/coaching/talkPlan';

function plan(cursor: number, minutes = 20) {
  return planLongform({
    durationSeconds: minutes * 60,
    shortSpokenSeconds: minutes * 60 * 0.5,
    density: 'full-talk',
    startCursor: cursor,
    warmupSeconds: 300,
  });
}

test('다음 러닝은 지난번에 멈춘 곳에서 이어집니다', () => {
  const first = plan(0);
  assert.ok(first.length > 0, '첫 러닝에 이야기가 없습니다');

  const cursor = nextBodyCursor(0, first.length);
  assert.ok(cursor > 0, '커서가 움직이지 않았습니다');

  const second = plan(cursor);
  assert.ok(second.length > 0, '두 번째 러닝에 이야기가 없습니다');

  // 지난번에 들은 것으로 다시 시작하지 않습니다.
  assert.notEqual(second[0]?.block.id, first[0]?.block.id, '또 같은 데서 시작했습니다');
});

test('짧은 러닝을 반복해도 결국 발까지 갑니다', () => {
  // 20분씩 여러 번 달리는 사람이 실제 사용자입니다.
  // 커서가 없으면 이 사람은 평생 머리·어깨만 듣습니다.
  const heard = new Set<string>();
  let cursor = 0;
  for (let run = 0; run < 12; run += 1) {
    const planned = plan(cursor);
    for (const entry of planned) heard.add(entry.block.theme);
    cursor = nextBodyCursor(cursor, planned.length);
  }

  for (const theme of ['head', 'shoulders', 'arms', 'torso', 'hips', 'legs', 'feet']) {
    assert.ok(heard.has(theme), `${theme} 이야기를 한 번도 못 들었습니다`);
  }
});

test('커서는 들은 만큼만 움직입니다', () => {
  // 설명과 이야기를 한 쌍씩 쓰므로 절반만큼 나아갑니다.
  assert.equal(nextBodyCursor(0, 0), 0);
  assert.equal(nextBodyCursor(0, 2), 1);
  assert.equal(nextBodyCursor(3, 6), 6);
  // 이상한 값이 들어와도 뒤로 가지 않습니다.
  assert.equal(nextBodyCursor(5, -3), 5);
});

test('커서가 커져도 항상 말할 것이 있습니다', () => {
  // 오래 쓴 사람의 커서는 계속 커집니다. 되감지 않고 나머지 연산으로 자리를 찾습니다.
  for (const cursor of [0, 7, 23, 100, 9_999]) {
    assert.ok(plan(cursor).length > 0, `커서 ${cursor}에서 이야기가 없습니다`);
  }
});

test('커서를 저장하고 되읽습니다', () => {
  assert.equal(normalizeCoachSettings({ stored: { bodyCursor: 7 } }).bodyCursor, 7);
  // 처음 켠 사람은 처음부터입니다.
  assert.equal(normalizeCoachSettings().bodyCursor, 0);
  // 저장이 깨졌으면 처음부터입니다. 엉뚱한 데서 시작하는 것보다 낫습니다.
  assert.equal(normalizeCoachSettings({ stored: { bodyCursor: '아무 글자' as never } }).bodyCursor, 0);
  assert.equal(normalizeCoachSettings({ stored: { bodyCursor: -5 } }).bodyCursor, 0);
});

test('시작 화면이 커서를 넘기고 앞으로 옮깁니다', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const source = readFileSync(join(__dirname, '..', 'app/screens/start/StartScreen.tsx'), 'utf8');
  assert.ok(source.includes('coachSettings.bodyCursor'), '커서를 넘기지 않습니다');
  assert.ok(source.includes('nextBodyCursor'), '커서를 앞으로 옮기지 않습니다');
  assert.ok(source.includes('planLongformSession'), '계획과 커서 이동량을 함께 만들지 않습니다');
  const launchSession = source.slice(
    source.indexOf('async function launchSession()'),
    source.indexOf('async function begin()'),
  );
  assert.ok(
    launchSession.indexOf('await startCoachSession') < launchSession.indexOf('updateCoach({'),
    '세션 시작에 실패해도 자세 커서를 먼저 소비합니다',
  );
});

test('자세 커리큘럼 계획은 이전 렌더의 전역 상태에 의존하지 않습니다', () => {
  const session = createCoachSession('이지런', 20, 'standard');
  const first = planLongformSession(session, 'full-talk', 0);
  const second = planLongformSession(session, 'full-talk', 0);

  assert.equal(first.plannedCount, second.plannedCount);
  assert.deepEqual(first.session.cues, second.session.cues);
});
