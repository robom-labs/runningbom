// 앱에 나오는 러닝화가 **전부 사진을 갖고 있는지** 확인합니다.
//
// 회장 지시: "사진 없는 건 아예 신발 등록 못 해."
//
// 그래서 여기서 세는 것은 "카탈로그의 몇 퍼센트에 사진이 있나"가 아닙니다.
// **화면에 나오는 신발 중 사진 없는 것이 하나라도 있는가**입니다. 답은 언제나 0이어야 합니다.
//
// 개수를 사용자에게 보여 주지 않으므로, 이 리포트도 운영용입니다.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const { shoeCatalog } = await import(join(root, 'apps', 'mobile', 'domains', 'shoes', 'catalog.ts'));
const { registerShoes } = await import(join(root, 'apps', 'mobile', 'domains', 'shoes', 'photoGate.ts'));

const manifest = JSON.parse(
  await readFile(join(root, 'data', 'shoe-image-sources.json'), 'utf8'),
);

const now = new Date();
const { registered, withheld } = registerShoes(shoeCatalog, manifest, now);

// 등록된 신발 중 사진 없는 것 — 정의상 0이어야 합니다.
const registeredWithoutPhoto = registered.filter((shoe) => !manifest.items?.[shoe.id]?.image?.url);

// 같은 사진이 두 모델에 붙은 경우
const byUrl = new Map();
for (const [id, entry] of Object.entries(manifest.items ?? {})) {
  const url = entry?.image?.url;
  if (!url) continue;
  byUrl.set(url, [...(byUrl.get(url) ?? []), id]);
}
const duplicates = [...byUrl.entries()].filter(([, ids]) => ids.length > 1);

const problems = [];
if (registeredWithoutPhoto.length > 0) {
  problems.push(`등록됐는데 사진이 없는 신발 ${registeredWithoutPhoto.length}켤레`);
}
if (duplicates.length > 0) {
  problems.push(`같은 사진을 쓰는 모델 ${duplicates.length}쌍`);
}

console.log('사진이 있어 등록된 신발:', registered.length);
console.log('사진이 없어 아직 안 나오는 신발:', withheld.length);
if (withheld.length > 0) {
  const byReason = {};
  for (const entry of withheld) {
    for (const problem of entry.problems) byReason[problem] = (byReason[problem] ?? 0) + 1;
  }
  console.log('  사유별:', JSON.stringify(byReason));
}

if (problems.length > 0) {
  console.error('\n실패:');
  for (const problem of problems) console.error('  -', problem);
  process.exit(1);
}

console.log('\n통과 — 화면에 나오는 신발은 전부 검증된 사진이 있습니다.');
