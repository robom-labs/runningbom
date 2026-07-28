// V8.2 — 사진이 등록 요건임을 잠급니다.
//
// 회장 지시: "사진 없는 건 아예 신발 등록 못 해."
//
// 그래서 여기서 확인하는 것은 "카탈로그의 몇 퍼센트에 사진이 있나"가 아닙니다.
// **화면에 나오는 신발 중 사진 없는 것이 있는가**입니다. 답은 언제나 0입니다.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { shoeCatalog } from '../domains/shoes/catalog';
import {
  MIN_PHOTO_WIDTH,
  isRegistrable,
  photoProblems,
  registerShoes,
  type PhotoManifest,
  type ShoePhoto,
} from '../domains/shoes/photoGate';
import { registeredShoes, shoePhoto, withheldShoes } from '../domains/shoes/registry';

const now = new Date('2026-07-28T00:00:00Z');

function goodPhoto(overrides: Partial<ShoePhoto> = {}): ShoePhoto {
  return {
    url: 'https://static.nike.com/pegasus-42.jpg',
    modelPage: 'https://www.nike.com/kr/t/pegasus-42',
    sourceHost: 'static.nike.com',
    sourceType: 'jsonld-product-image',
    checkedAt: '2026-07-20',
    rights: 'REMOTE_USE_VERIFIED',
    width: 1600,
    mime: 'image/jpeg',
    ...overrides,
  };
}

test('사진이 없으면 등록되지 않습니다', () => {
  assert.deepEqual(photoProblems(undefined, { now }), ['missing']);
  assert.equal(isRegistrable(undefined, { now }), false);
});

test('제대로 된 사진은 등록됩니다', () => {
  assert.deepEqual(photoProblems(goodPhoto(), { now }), []);
  assert.equal(isRegistrable(goodPhoto(), { now }), true);
});

test('권리가 확인되지 않은 사진은 등록되지 않습니다', () => {
  // 공식 페이지가 이미지를 공개한 것과 우리가 쓸 권리가 있는 것은 다릅니다.
  for (const rights of ['RIGHTS_REVIEW_REQUIRED', 'BLOCKED_RIGHTS'] as const) {
    const problems = photoProblems(goodPhoto({ rights }), { now });
    assert.ok(problems.includes('rights-not-approved'), `${rights}가 통과했습니다`);
  }
});

test('로고나 썸네일로 보이는 작은 이미지는 막습니다', () => {
  const problems = photoProblems(goodPhoto({ width: MIN_PHOTO_WIDTH - 1 }), { now });
  assert.ok(problems.includes('too-small'));
});

test('https가 아니거나 모델 페이지가 없으면 막습니다', () => {
  assert.ok(photoProblems(goodPhoto({ url: 'http://x/a.jpg' }), { now }).includes('not-https'));
  assert.ok(photoProblems(goodPhoto({ modelPage: '' }), { now }).includes('no-model-page'));
});

test('이미지가 아닌 것은 막습니다', () => {
  assert.ok(photoProblems(goodPhoto({ mime: 'text/html' }), { now }).includes('bad-mime'));
});

test('오래된 확인은 다시 봐야 합니다', () => {
  // 주소는 바뀝니다. 확인한 지 오래된 것을 그대로 믿지 않습니다.
  assert.ok(photoProblems(goodPhoto({ checkedAt: '2020-01-01' }), { now }).includes('stale'));
  assert.ok(photoProblems(goodPhoto({ checkedAt: '아무말' }), { now }).includes('stale'));
});

test('같은 사진을 두 모델에 붙이면 막습니다', () => {
  // 한 사진이 두 모델의 사진일 수는 없습니다. 하나는 반드시 틀린 것입니다.
  const manifest: PhotoManifest = {
    revision: 1,
    checkedAt: '2026-07-20',
    items: {
      a: goodPhoto(),
      b: goodPhoto(),
    },
  };
  const { registered, withheld } = registerShoes([{ id: 'a' }, { id: 'b' }], manifest, now);
  assert.equal(registered.length, 1);
  assert.equal(withheld.length, 1);
  assert.ok(withheld[0]?.problems.includes('duplicate-url'));
});

test('등록된 신발은 예외 없이 사진이 있습니다', () => {
  // 이게 이 파일의 핵심입니다. 지금 사진이 0장이든 전부이든 언제나 성립해야 합니다.
  for (const shoe of registeredShoes(now)) {
    const photo = shoePhoto(shoe.id);
    assert.ok(photo?.url, `${shoe.id}가 사진 없이 등록됐습니다`);
    assert.deepEqual(photoProblems(photo, { now }), [], `${shoe.id}의 사진에 문제가 있습니다`);
  }
});

test('사진이 없는 신발은 카탈로그에서 지워지지 않습니다', () => {
  // 지운 게 아니라 아직 안 나오는 것입니다. 사진이 붙으면 그대로 다시 나옵니다.
  const shown = registeredShoes(now).length;
  const hidden = withheldShoes(now).length;
  assert.equal(shown + hidden, shoeCatalog.length, '신발이 사라졌습니다');
});

test('신발 개수를 사용자에게 보여 주지 않습니다', () => {
  // 개수를 적는 순간 그게 약속이 되고, 사진이 없어 빠진 모델이 결함처럼 보입니다.
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name)) files.push(full);
    }
  };
  walk(join(__dirname, '..', 'app'));
  walk(join(__dirname, '..', 'domains', 'shoes'));

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    // 화면에 신발 개수를 찍는 표현입니다.
    assert.ok(
      !/\{shoeCatalog\.length\}|shoeCatalog\.length\}종|\$\{shoeCatalog\.length\}/.test(source),
      `${file}에서 신발 개수를 보여 줍니다`,
    );
    assert.ok(!/러닝화\s*123|123\s*종/.test(source), `${file}에 신발 개수가 적혀 있습니다`);
  }
});

test('수집기는 공식 호스트만 봅니다', () => {
  const collector = readFileSync(
    join(__dirname, '..', '..', '..', 'scripts', 'collect-shoe-images.mjs'),
    'utf8',
  );
  // 검색 결과·쇼핑몰·블로그를 보지 않습니다.
  assert.ok(collector.includes('officialHosts'), '공식 호스트 목록이 없습니다');
  assert.ok(collector.includes('isOfficialHost'), '호스트 검사가 없습니다');
  assert.ok(collector.includes('looksLikeSiteMark'), '로고 걸러내기가 없습니다');
  // 권리를 자동 승인하지 않습니다.
  assert.ok(
    collector.includes("rights: 'RIGHTS_REVIEW_REQUIRED'"),
    '권리를 자동으로 승인하고 있습니다',
  );
});
