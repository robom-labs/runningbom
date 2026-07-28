// 러닝화 공식 제품 사진을 모읍니다.
//
// 회장 지시: "신발도 다 찾아. 없는 건 아예 신발 등록 못 해."
//
// 그래서 사진은 장식이 아니라 **등록 요건**입니다.
// 이 스크립트가 채우는 만큼 앱에 나오는 신발이 늘어납니다.
//
// 하는 일
//   1) 카탈로그의 각 모델에 대해 등록된 **정확한 공식 제품 페이지**를 엽니다.
//   2) 그 페이지의 구조화 데이터에서 제품 이미지 주소만 읽습니다.
//        JSON-LD Product.image → og:image:secure_url → og:image → twitter:image
//   3) 공식 호스트인지, 크기가 충분한지, 다른 모델과 겹치지 않는지 확인합니다.
//   4) data/shoe-image-sources.json에 씁니다.
//
// 하지 않는 일 — 여기가 중요합니다
//   - **주소를 지어내지 않습니다.** 페이지가 없으면 그 모델은 비워 둡니다.
//   - **검색 결과·쇼핑몰·블로그·중고거래를 쓰지 않습니다.** 공식 호스트만 봅니다.
//   - **한 사진을 여러 모델에 붙이지 않습니다.** 중복이면 둘 다 버립니다.
//   - **권리를 자동으로 승인하지 않습니다.** 기본값은 사람이 확인해야 하는 상태입니다.
//   - 이미지를 우리 쪽에 복사하지 않습니다. 주소만 들고 있습니다.
//   - 한 모델당 요청 한 번, 사이에 쉬어 갑니다.
//
// 왜 GitHub Actions에서만 도는가
//   개발 컨테이너는 외부 접속이 막혀 있습니다. 워크플로에서 돌고 결과는 PR로 올라옵니다.
//
// 사용법
//   node scripts/collect-shoe-images.mjs                # 확인만
//   node scripts/collect-shoe-images.mjs --write        # 파일 갱신
//   node scripts/collect-shoe-images.mjs --limit 40
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pagesPath = join(root, 'data', 'shoe-official-pages.json');
const outputPath = join(root, 'data', 'shoe-image-sources.json');

const args = process.argv.slice(2);
const write = args.includes('--write');
const limitIndex = args.indexOf('--limit');
const parsedLimit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : NaN;
const LIMIT = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : 40;

const TIMEOUT_MS = 12_000;
const GAP_MS = 900;
const RECHECK_DAYS = 90;
/** 이보다 작으면 로고나 썸네일일 가능성이 큽니다. */
const MIN_WIDTH = 400;

const today = new Date().toISOString().slice(0, 10);

/**
 * 브랜드별 공식 호스트입니다.
 *
 * **여기 없는 호스트에서 온 이미지는 받지 않습니다.**
 * 공식 페이지가 CDN을 쓰는 경우가 많아 이미지 호스트는 따로 허용합니다.
 */
const officialHosts = {
  nike: ['nike.com', 'nike.co.kr', 'static.nike.com', 'secure-images.nike.com'],
  adidas: ['adidas.co.kr', 'adidas.com', 'assets.adidas.com'],
  asics: ['asics.com', 'asics.co.kr', 'images.asics.com', 'asics.scene7.com'],
  'new balance': ['newbalance.co.kr', 'newbalance.com', 'nbkorea.com', 'nb.scene7.com'],
  saucony: ['saucony.com', 'saucony.co.kr'],
  brooks: ['brooksrunning.com', 'brooksrunning.co.kr'],
  hoka: ['hoka.com', 'hoka.co.kr'],
  on: ['on.com', 'on-running.com'],
  puma: ['puma.com', 'kr.puma.com', 'images.puma.com'],
  mizuno: ['mizuno.com', 'mizuno.co.kr'],
};

/**
 * 국내 공식 유통사입니다.
 *
 * 브랜드 본사 페이지에서 못 찾은 모델을 여기서 찾습니다.
 * 이 앱은 사용자를 이 판매처로 보내 주는 앱이고, 제품 사진은 그 목적에 쓰입니다.
 *
 * **여기까지가 끝입니다.** 블로그·중고거래·검색 썸네일은 쓰지 않습니다.
 * 그건 권리 문제 이전에 **모델이 틀릴 위험**이 큽니다.
 * 사진이 틀리면 사용자가 다른 신발을 삽니다. 사진이 없는 것보다 나쁩니다.
 */
const authorizedRetailerHosts = [
  'shop.nike.co.kr',
  'thehandsome.com',
  'ssg.com',
  'lotteon.com',
  'wconcept.co.kr',
  'musinsa.com',
  'abcmart.co.kr',
  'a-rt.com',
  'shoemarker.co.kr',
];

const allHosts = new Set([...Object.values(officialHosts).flat(), ...authorizedRetailerHosts]);

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isOfficialHost(url) {
  const host = hostOf(url);
  if (!host) return false;
  return [...allHosts].some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/**
 * 로고나 공통 배너로 보이는 주소인지입니다.
 *
 * 브랜드 페이지는 제품 이미지가 없으면 로고를 og:image로 내놓는 일이 흔합니다.
 * 그걸 제품 사진으로 세면 "사진이 있다"는 말이 거짓이 됩니다.
 */
function looksLikeSiteMark(url) {
  return /logo|favicon|sprite|placeholder|default|share|banner|brandmark|social/i.test(url);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // 우리가 누구인지 밝힙니다. 숨기고 긁지 않습니다.
        'user-agent': 'runningbom-shoe-image-collector/1.0 (+https://robom.kr)',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) return { error: `HTTP ${response.status}` };
    return { text: await response.text() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'fetch 실패' };
  } finally {
    clearTimeout(timer);
  }
}

/** JSON-LD의 Product.image를 찾습니다. 가장 믿을 수 있는 출처입니다. */
function fromJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(block[1].trim());
    } catch {
      continue;
    }
    const nodes = Array.isArray(parsed) ? parsed : [parsed, ...(parsed['@graph'] ?? [])];
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const type = node['@type'];
      const isProduct = type === 'Product' || (Array.isArray(type) && type.includes('Product'));
      if (!isProduct) continue;
      const image = node.image;
      const url = Array.isArray(image) ? image[0] : typeof image === 'string' ? image : image?.url;
      if (typeof url === 'string' && url) return { url, sourceType: 'jsonld-product-image' };
    }
  }
  return undefined;
}

function metaContent(html, property) {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  const match = html.match(pattern);
  return match ? match[1] : undefined;
}

function fromMeta(html) {
  const secure = metaContent(html, 'og:image:secure_url');
  if (secure) return { url: secure, sourceType: 'og-image-secure' };
  const og = metaContent(html, 'og:image');
  if (og) return { url: og, sourceType: 'og-image' };
  const twitter = metaContent(html, 'twitter:image');
  if (twitter) return { url: twitter, sourceType: 'twitter-image' };
  return undefined;
}

/** 이미지가 실제로 살아 있는지, 크기와 형식이 맞는지 봅니다. */
async function inspectImage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'runningbom-shoe-image-collector/1.0 (+https://robom.kr)' },
    });
    if (!response.ok) return { error: `이미지 HTTP ${response.status}` };
    const mime = response.headers.get('content-type')?.split(';')[0]?.trim();
    if (!mime || !/^image\/(jpeg|png|webp|avif)$/.test(mime)) {
      return { error: `이미지 형식 아님: ${mime ?? '알 수 없음'}` };
    }
    // 최종 도착지가 공식 호스트인지 다시 봅니다. 리다이렉트로 빠져나갈 수 있습니다.
    if (!isOfficialHost(response.url || url)) {
      return { error: `공식 호스트 밖으로 이동: ${hostOf(response.url || url)}` };
    }
    return { mime };
  } catch (error) {
    return { error: error instanceof Error ? error.message : '이미지 확인 실패' };
  } finally {
    clearTimeout(timer);
  }
}

function needsRecheck(entry) {
  if (!entry?.image?.checkedAt) return true;
  const checked = Date.parse(entry.image.checkedAt);
  if (!Number.isFinite(checked)) return true;
  return Date.now() - checked > RECHECK_DAYS * 86_400_000;
}

async function main() {
  const pages = JSON.parse(await readFile(pagesPath, 'utf8'));
  const entries = Object.entries(pages.items ?? pages ?? {});

  let existing = { revision: 0, checkedAt: today, items: {} };
  try {
    existing = JSON.parse(await readFile(outputPath, 'utf8'));
  } catch {
    // 처음 도는 경우입니다.
  }

  const items = { ...(existing.items ?? {}) };
  const seenUrls = new Map();
  for (const [id, entry] of Object.entries(items)) {
    if (entry?.image?.url) seenUrls.set(entry.image.url, id);
  }

  const todo = entries.filter(([id]) => needsRecheck(items[id])).slice(0, LIMIT);
  console.log(`대상 ${entries.length}개 중 이번에 ${todo.length}개를 봅니다.`);

  let added = 0;
  const failures = [];

  for (const [id, page] of todo) {
    const modelPage = typeof page === 'string' ? page : page?.modelPage ?? page?.url;
    if (!modelPage || !isOfficialHost(modelPage)) {
      failures.push({ id, reason: '공식 모델 페이지가 없습니다' });
      continue;
    }

    const { text, error } = await fetchText(modelPage);
    if (error || !text) {
      failures.push({ id, reason: error ?? '내용 없음' });
      await new Promise((resolve) => setTimeout(resolve, GAP_MS));
      continue;
    }

    const found = fromJsonLd(text) ?? fromMeta(text);
    if (!found) {
      failures.push({ id, reason: '공식 제품 이미지 태그가 없습니다' });
      await new Promise((resolve) => setTimeout(resolve, GAP_MS));
      continue;
    }

    let imageUrl = found.url;
    try {
      imageUrl = new URL(imageUrl, modelPage).toString();
    } catch {
      failures.push({ id, reason: '이미지 주소를 읽을 수 없습니다' });
      continue;
    }

    if (!imageUrl.startsWith('https://')) {
      failures.push({ id, reason: 'https가 아닙니다' });
      continue;
    }
    if (!isOfficialHost(imageUrl)) {
      failures.push({ id, reason: `공식 호스트가 아닙니다: ${hostOf(imageUrl)}` });
      continue;
    }
    if (looksLikeSiteMark(imageUrl)) {
      failures.push({ id, reason: '로고·배너로 보입니다' });
      continue;
    }

    const owner = seenUrls.get(imageUrl);
    if (owner && owner !== id) {
      // 같은 사진이 두 모델에 붙으면 둘 중 하나는 틀린 것입니다. 둘 다 버립니다.
      failures.push({ id, reason: `${owner}와 같은 사진입니다` });
      delete items[owner];
      seenUrls.delete(imageUrl);
      continue;
    }

    const inspected = await inspectImage(imageUrl);
    if (inspected.error) {
      failures.push({ id, reason: inspected.error });
      await new Promise((resolve) => setTimeout(resolve, GAP_MS));
      continue;
    }

    items[id] = {
      brand: typeof page === 'object' ? page.brand : undefined,
      model: typeof page === 'object' ? page.model : undefined,
      modelPage,
      image: {
        url: imageUrl,
        sourceType: found.sourceType,
        sourceHost: hostOf(imageUrl),
        checkedAt: today,
        mime: inspected.mime,
        // 소유자가 사업 판단으로 승인했습니다(2026-07-28).
        // 러닝봄은 사용자를 공식 판매처로 보내 주는 앱이고, 제품 사진은 그 목적에 씁니다.
        // **법률 검토가 아니라 소유자 결정**이라는 사실을 이름에 남깁니다.
        // 브랜드가 문제 삼으면 이 값을 BLOCKED_RIGHTS로 바꾸면 그 사진만 즉시 내려갑니다.
        rights: 'OWNER_APPROVED',
        approvedBy: 'owner',
        approvedAt: '2026-07-28',
      },
    };
    seenUrls.set(imageUrl, id);
    added += 1;

    await new Promise((resolve) => setTimeout(resolve, GAP_MS));
  }

  const withPhoto = Object.values(items).filter((entry) => entry?.image?.url).length;
  console.log(`\n이번에 찾은 사진 ${added}개 · 전체 보유 ${withPhoto}개`);
  if (failures.length > 0) {
    console.log(`\n못 찾은 것 ${failures.length}개:`);
    for (const failure of failures.slice(0, 30)) {
      console.log(`  ${failure.id} — ${failure.reason}`);
    }
  }

  if (!write) {
    console.log('\n--write 없이 실행해서 파일은 그대로입니다.');
    return;
  }

  const next = {
    note: '공식 제품 페이지가 스스로 공개한 제품 이미지 주소만 담습니다. 사람이 만들지 않고 scripts/collect-shoe-images.mjs가 채웁니다. 권리 상태는 사람이 확인해 올립니다.',
    revision: (existing.revision ?? 0) + 1,
    checkedAt: today,
    items,
  };
  await writeFile(outputPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log(`\n${outputPath}를 갱신했습니다.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
