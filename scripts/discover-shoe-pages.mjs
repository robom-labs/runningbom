// 각 러닝화의 **정확한 공식 제품 페이지**를 찾습니다.
//
// 왜 이게 따로 필요한가:
//   사진을 모으려면 먼저 "어느 페이지가 이 모델의 페이지인가"를 알아야 합니다.
//   지금 등록된 공식 페이지는 두 개뿐이고, 나머지는 비어 있어서 사진을 한 장도 못 가져옵니다.
//   **컴포넌트가 없어서가 아니라 주소가 없어서** 사진이 안 나오고 있었습니다.
//
// 어떻게 찾는가 — 주소를 지어내지 않습니다.
//   브랜드가 공개한 **사이트맵**을 읽습니다.
//   사이트맵은 "이 주소들을 색인해도 된다"고 사이트가 스스로 밝힌 목록입니다.
//   거기에서 모델명이 들어간 제품 주소만 골라냅니다.
//
// 하지 않는 일
//   - 검색엔진 결과를 쓰지 않습니다.
//   - 주소 패턴을 추측해서 만들지 않습니다.
//   - 쇼핑몰·블로그·중고거래를 보지 않습니다.
//   - 모델명이 비슷하다고 대충 붙이지 않습니다. 세대 숫자까지 맞아야 합니다.
//
// 사용법
//   node scripts/discover-shoe-pages.mjs               # 확인만
//   node scripts/discover-shoe-pages.mjs --write
//   node scripts/discover-shoe-pages.mjs --brand nike
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = join(root, 'data', 'shoe-official-pages.json');

const args = process.argv.slice(2);
const write = args.includes('--write');
const brandIndex = args.indexOf('--brand');
const onlyBrand = brandIndex >= 0 ? args[brandIndex + 1]?.toLowerCase() : undefined;

const TIMEOUT_MS = 20_000;
const GAP_MS = 1_200;
const today = new Date().toISOString().slice(0, 10);

/**
 * 브랜드별 사이트맵 진입점입니다.
 *
 * robots.txt가 가리키는 공개 사이트맵만 씁니다.
 * 여기 없는 브랜드는 사람이 확인해 채웁니다 — 지어내지 않습니다.
 */
const brandSitemaps = {
  nike: ['https://www.nike.com/robots.txt'],
  adidas: ['https://www.adidas.co.kr/robots.txt'],
  asics: ['https://www.asics.com/robots.txt'],
  'new balance': ['https://www.newbalance.co.kr/robots.txt'],
  saucony: ['https://www.saucony.com/robots.txt'],
  brooks: ['https://www.brooksrunning.com/robots.txt'],
  hoka: ['https://www.hoka.com/robots.txt'],
  on: ['https://www.on.com/robots.txt'],
  puma: ['https://kr.puma.com/robots.txt'],
  mizuno: ['https://www.mizuno.com/robots.txt'],
};

async function fetchMaybeGzip(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'runningbom-shoe-page-discovery/1.0 (+https://robom.kr)' },
    });
    if (!response.ok) return { error: `HTTP ${response.status}` };
    const buffer = Buffer.from(await response.arrayBuffer());
    if (url.endsWith('.gz')) return { text: gunzipSync(buffer).toString('utf8') };
    return { text: buffer.toString('utf8') };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'fetch 실패' };
  } finally {
    clearTimeout(timer);
  }
}

/** robots.txt가 밝힌 사이트맵 주소들입니다. */
function sitemapsFromRobots(text) {
  return [...text.matchAll(/^\s*sitemap:\s*(\S+)\s*$/gim)].map((m) => m[1]);
}

function urlsFromSitemap(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
}

/** 모델명을 주소에서 찾을 수 있는 형태로 만듭니다. */
function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * 주소가 이 모델의 것인지 봅니다.
 *
 * **세대 숫자가 다르면 다른 신발입니다.** Pegasus 41과 42는 서로를 대신할 수 없습니다.
 * 그래서 숫자가 모델명에 있으면 주소에도 그 숫자가 있어야 합니다.
 */
export function matchesModel(url, modelSlug) {
  const lower = url.toLowerCase();
  if (!lower.includes(modelSlug)) return false;
  const generation = modelSlug.match(/(\d+)$/)?.[1];
  if (!generation) return true;
  // 41을 찾는데 410이 걸리면 안 됩니다.
  return new RegExp(`${modelSlug}(?![0-9])`).test(lower);
}

async function main() {
  const { shoeCatalog } = await import(
    join(root, 'apps', 'mobile', 'domains', 'shoes', 'catalog.ts')
  ).catch(() => ({ shoeCatalog: [] }));

  let catalog = shoeCatalog;
  if (!catalog?.length) {
    console.error('카탈로그를 읽지 못했습니다. tsx 로더와 함께 실행하세요.');
    process.exit(1);
  }

  let existing = { revision: 0, checkedAt: today, items: {} };
  try {
    existing = JSON.parse(await readFile(outputPath, 'utf8'));
  } catch {
    // 처음 도는 경우입니다.
  }
  const items = { ...(existing.items ?? {}) };

  const byBrand = new Map();
  for (const shoe of catalog) {
    const brand = String(shoe.brand ?? '').toLowerCase();
    if (onlyBrand && brand !== onlyBrand) continue;
    if (!byBrand.has(brand)) byBrand.set(brand, []);
    byBrand.get(brand).push(shoe);
  }

  let found = 0;
  const missing = [];

  for (const [brand, shoes] of byBrand) {
    const robots = brandSitemaps[brand];
    if (!robots) {
      for (const shoe of shoes) missing.push({ id: shoe.id, reason: `${brand} 사이트맵 미등록` });
      continue;
    }

    // robots.txt → 사이트맵 목록 → 제품 주소
    const urls = new Set();
    for (const robotsUrl of robots) {
      const { text, error } = await fetchMaybeGzip(robotsUrl);
      if (error || !text) continue;
      const maps = sitemapsFromRobots(text).slice(0, 40);
      for (const map of maps) {
        const { text: xml } = await fetchMaybeGzip(map);
        if (!xml) continue;
        const locs = urlsFromSitemap(xml);
        // 사이트맵 색인이면 한 겹 더 들어갑니다.
        if (/sitemap/i.test(xml) && locs.some((l) => /\.xml/i.test(l))) {
          for (const child of locs.filter((l) => /\.xml/i.test(l)).slice(0, 40)) {
            const { text: childXml } = await fetchMaybeGzip(child);
            if (childXml) for (const u of urlsFromSitemap(childXml)) urls.add(u);
            await new Promise((r) => setTimeout(r, GAP_MS));
          }
        } else {
          for (const u of locs) urls.add(u);
        }
        await new Promise((r) => setTimeout(r, GAP_MS));
      }
    }

    console.log(`${brand}: 주소 ${urls.size}개에서 ${shoes.length}개 모델을 찾습니다.`);

    for (const shoe of shoes) {
      const slug = slugify(shoe.modelEn ?? shoe.model);
      const hit = [...urls].find((url) => matchesModel(url, slug));
      if (hit) {
        items[shoe.id] = {
          brand: shoe.brand,
          model: shoe.model,
          modelPage: hit,
          discoveredAt: today,
          discoveredVia: 'official-sitemap',
        };
        found += 1;
      } else {
        missing.push({ id: shoe.id, reason: `사이트맵에서 ${slug}를 찾지 못함` });
      }
    }
  }

  console.log(`\n찾은 모델 페이지 ${found}개 · 못 찾은 것 ${missing.length}개`);
  for (const entry of missing.slice(0, 40)) console.log(`  ${entry.id} — ${entry.reason}`);

  if (!write) {
    console.log('\n--write 없이 실행해서 파일은 그대로입니다.');
    return;
  }

  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        note: '브랜드가 공개한 사이트맵에서 찾은 정확한 모델 페이지입니다. 주소를 지어내지 않습니다.',
        revision: (existing.revision ?? 0) + 1,
        checkedAt: today,
        items,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(`\n${outputPath}를 갱신했습니다.`);
}

if (process.argv[1] && process.argv[1].includes('discover-shoe-pages')) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
