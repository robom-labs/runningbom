// 공식 이미지 데이터 규칙을 검증합니다.
//
// 여기서 보는 것 하나가 나머지보다 중요합니다:
//   **이미지가 없거나 깨져도 빈 상자가 안 보이는가.**
// 목록에서 카드 하나가 회색 네모로 남아 있는 것만큼 앱이 싸구려로 보이는 게 없습니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import raw from '../src/data/official-images.json';
import {
  imageCreditLabel,
  isUsableImageUrl,
  officialImage,
  officialImageCount,
  parseOfficialImages,
} from '../domains/media/officialImages';

function source(relative: string): string {
  return readFileSync(join(__dirname, '..', relative), 'utf8');
}

test('http 주소는 쓰지 않습니다', () => {
  // 안드로이드가 기본으로 막고, 중간에서 바꿔치기될 수 있습니다.
  assert.equal(isUsableImageUrl('http://example.com/a.jpg'), false);
  assert.equal(isUsableImageUrl('https://example.com/a.jpg'), true);
});

test('주소가 아닌 값은 걸러 냅니다', () => {
  assert.equal(isUsableImageUrl(undefined), false);
  assert.equal(isUsableImageUrl(123), false);
  assert.equal(isUsableImageUrl(''), false);
  // 데이터 URI를 넣으면 번들이 통째로 무거워집니다.
  assert.equal(isUsableImageUrl(`https://x/${'a'.repeat(700)}`), false);
});

test('출처와 확인 날짜가 없으면 쓰지 않습니다', () => {
  // 출처를 못 밝히는 그림은 화면에 내지 않습니다.
  const parsed = parseOfficialImages({
    images: {
      ok: { url: 'https://a/b.jpg', source: 'example.com', checkedAt: '2026-07-27' },
      noSource: { url: 'https://a/c.jpg', checkedAt: '2026-07-27' },
      noDate: { url: 'https://a/d.jpg', source: 'example.com' },
      badDate: { url: 'https://a/e.jpg', source: 'example.com', checkedAt: '어제' },
      httpOnly: { url: 'http://a/f.jpg', source: 'example.com', checkedAt: '2026-07-27' },
    },
  });
  assert.deepEqual(Object.keys(parsed), ['ok']);
});

test('파일이 깨져도 앱이 죽지 않습니다', () => {
  // 데이터 한 줄 때문에 앱이 안 열리면 안 만든 편이 나았던 게 됩니다.
  assert.deepEqual(parseOfficialImages(null), {});
  assert.deepEqual(parseOfficialImages('이상한값'), {});
  assert.deepEqual(parseOfficialImages({ images: '이상한값' }), {});
  assert.deepEqual(parseOfficialImages({}), {});
});

test('번들에 들어간 파일이 규칙을 지킵니다', () => {
  // 수집 스크립트가 이상한 값을 넣으면 여기서 잡힙니다.
  const file = raw as { images?: Record<string, unknown> };
  const parsed = parseOfficialImages(raw);
  const declared = Object.keys(file.images ?? {}).length;
  assert.equal(
    Object.keys(parsed).length,
    declared,
    '파일에 적힌 이미지 중 규칙을 못 지킨 것이 있습니다',
  );
});

test('없는 항목을 물어보면 조용히 없다고 합니다', () => {
  assert.equal(officialImage('없는-id'), undefined);
  assert.ok(officialImageCount() >= 0);
});

test('남의 그림을 우리 것처럼 보이게 하지 않습니다', () => {
  const label = imageCreditLabel({
    url: 'https://a/b.jpg',
    source: 'saunarun.com',
    checkedAt: '2026-07-27',
  });
  assert.match(label, /saunarun\.com/);
});

test('이미지가 없어도 그릴 것이 항상 깔려 있습니다', () => {
  // ArtImage는 우리 그림을 먼저 깔고 그 위에 사진을 얹습니다.
  // 이 구조가 아니면 이미지 없는 카드가 빈 상자로 남습니다.
  const art = source('domains/media/ArtImage.tsx');
  assert.match(art, /fallback/);
  assert.match(art, /onError=\{\(\) => setFailed\(true\)\}/);
});

test('신발 카드와 상세가 둘 다 사진 자리를 씁니다', () => {
  assert.match(source('domains/shoes/ShoeCard.tsx'), /<ArtImage/);
  assert.match(source('domains/shoes/ShoeDetail.tsx'), /<ArtImage/);
});

test('대회 포스터도 공식 이미지를 받을 수 있습니다', () => {
  const poster = source('domains/races/RacePoster.tsx');
  assert.match(poster, /officialImage/);
  assert.match(poster, /setFailed\(true\)/);
  // 대회 화면이 id를 실제로 넘겨야 사진이 붙습니다.
  assert.match(source('domains/races/RaceScreen.tsx'), /raceId=\{group\.primary\.id\}/);
});

test('수집 스크립트가 og:image 하나만 본다고 밝혀 둡니다', () => {
  // 페이지를 뒤지는 것과 og:image를 읽는 것은 전혀 다른 일입니다.
  // 다음 사람이 "김에 본문 이미지도 긁자"고 하지 않도록 규칙을 파일에 박아 둡니다.
  const script = readFileSync(
    join(__dirname, '..', '..', '..', 'scripts', 'collect-official-images.mjs'),
    'utf8',
  );
  assert.match(script, /og:image/);
  assert.match(script, /페이지를 뒤지지 않습니다/);
  assert.match(script, /이미지를 우리 쪽에 복사하지 않습니다/);
});
