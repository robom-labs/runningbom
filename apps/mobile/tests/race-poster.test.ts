// 대회 포스터 조판 규칙을 검증합니다.
//
// 여기서 보는 것: **색이 아무 뜻 없이 알록달록하지 않은가.**
//   무작위 색을 쓰면 그냥 어수선할 뿐 아무 정보도 주지 않습니다.
//   같은 달 대회는 같은 색이어야, 목록을 훑을 때 계절 흐름이 눈에 들어옵니다.
import assert from 'node:assert/strict';
import test from 'node:test';

import raceData from '../src/data/races.json';
import {
  headlineScale,
  posterAccessibilityLabel,
  posterHeadline,
  racePosterSpec,
  seasonForMonth,
  seasonLabels,
} from '../domains/races/poster';

test('달마다 계절이 정해집니다', () => {
  assert.equal(seasonForMonth(4), 'spring');
  assert.equal(seasonForMonth(7), 'summer');
  assert.equal(seasonForMonth(10), 'autumn');
  assert.equal(seasonForMonth(1), 'winter');
  assert.equal(seasonForMonth(12), 'winter');
});

test('같은 달 대회는 같은 색입니다', () => {
  // 이게 깨지면 색이 아무 정보도 주지 않습니다.
  const a = racePosterSpec({ raceDate: '2026-10-04', distances: ['10K'] });
  const b = racePosterSpec({ raceDate: '2026-10-25', distances: ['하프'] });
  assert.equal(a.topColor, b.topColor);
  assert.equal(a.bottomColor, b.bottomColor);
});

test('다른 계절은 다른 색입니다', () => {
  const spring = racePosterSpec({ raceDate: '2026-04-04', distances: ['10K'] });
  const winter = racePosterSpec({ raceDate: '2026-01-04', distances: ['10K'] });
  assert.notEqual(spring.topColor, winter.topColor);
});

test('여러 종목이면 가장 긴 것 하나만 크게 씁니다', () => {
  // "5K/10K/하프"를 다 넣으면 작아져서 안 보입니다.
  assert.equal(posterHeadline(['5K', '10K', '하프']), '하프');
  assert.equal(posterHeadline(['5K', '10K']), '10K');
  assert.equal(posterHeadline(['풀', '하프']), '풀');
});

test('종목을 모르면 빈칸 대신 기본 글자를 씁니다', () => {
  assert.equal(posterHeadline([]), 'RUN');
});

test('긴 글자는 작게 넣습니다', () => {
  // 잘리는 것보다 작은 편이 낫습니다.
  assert.equal(headlineScale('10K'), 1);
  assert.ok(headlineScale('트레일러닝') < 1);
});

test('날짜가 이상해도 포스터가 만들어집니다', () => {
  // 데이터 한 줄이 이상하다고 목록이 깨지면 안 됩니다.
  const spec = racePosterSpec({ raceDate: '이상한값', region: '서울' });
  assert.ok(spec.topColor);
  assert.equal(spec.subline, '서울');
});

test('정본에 실린 대회가 전부 포스터로 만들어집니다', () => {
  // 데이터가 늘어도 이 테스트는 그대로 전수를 돕니다.
  const list = (raceData as { races: { raceDate: string; region?: string; distances?: string[] }[] })
    .races;
  assert.ok(list.length > 100, `대회가 ${list.length}개뿐입니다`);
  for (const race of list) {
    const spec = racePosterSpec(race);
    assert.ok(spec.headline.length > 0, `${race.raceDate}의 포스터 제목이 비었습니다`);
    assert.ok(spec.subline.length > 0);
    assert.match(spec.topColor, /^#[0-9A-Fa-f]{6}$/);
  }
});

test('포스터를 화면 낭독기가 읽을 수 있습니다', () => {
  // 그림만 있고 설명이 없으면 안 보이는 것과 같습니다.
  const spec = racePosterSpec({ raceDate: '2026-10-04', region: '서울', distances: ['10K'] });
  const label = posterAccessibilityLabel(spec, '서울달리기');
  assert.match(label, /서울달리기/);
  assert.match(label, /10K/);
  assert.match(label, new RegExp(seasonLabels.autumn));
});

test('글자 색은 배경과 상관없이 흰색 하나로 통일합니다', () => {
  // 카드마다 글자 무게가 달라 보이면 목록이 어수선해집니다.
  for (const month of [1, 4, 7, 10]) {
    const spec = racePosterSpec({ raceDate: `2026-${String(month).padStart(2, '0')}-04` });
    assert.equal(spec.inkColor, '#FFFFFF');
  }
});
