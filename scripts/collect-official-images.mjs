// 공식 페이지가 스스로 공개한 대표 이미지(og:image) 주소를 모읍니다.
//
// 회장 지시: **"러닝화도 이미지도 갖고 와. 대회도."**
//
// 하는 일
//   1) 대회 정본(apps/mobile/src/data/races.json)의 officialUrl을 하나씩 엽니다.
//   2) 그 페이지의 <meta property="og:image"> 값만 읽습니다.
//   3) https 절대 주소로 정리해서 apps/mobile/src/data/official-images.json에 씁니다.
//
// 하지 않는 일 — 여기가 중요합니다
//   - **페이지를 뒤지지 않습니다.** og:image 태그 하나만 봅니다.
//     og:image는 "다른 곳에서 이 페이지를 소개할 때 이 그림을 써라"고 페이지가 스스로 밝힌 값입니다.
//     본문 <img>를 긁어 오는 것과는 전혀 다른 일입니다.
//   - **이미지를 우리 쪽에 복사하지 않습니다.** 주소만 들고 있습니다(저장·전송 비용 0).
//   - **주소를 지어내지 않습니다.** 태그가 없으면 그 항목은 그냥 비워 둡니다.
//   - 한 항목당 요청 한 번, 사이에 쉬어 가며 갑니다. 남의 서버를 두드리지 않습니다.
//
// 왜 GitHub Actions에서만 도는가
//   개발 컨테이너는 외부 접속이 막혀 있습니다. 이 스크립트는 워크플로에서 돌고,
//   결과는 사람이 보는 PR로 올라옵니다.
//
// 사용법
//   node scripts/collect-official-images.mjs            # 확인만 (파일 안 바꿈)
//   node scripts/collect-official-images.mjs --write    # 파일까지 갱신
//   node scripts/collect-official-images.mjs --limit 40 # 이번에 시도할 개수
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const racesPath = join(root, 'apps', 'mobile', 'src', 'data', 'races.json');
const shoePagesPath = join(root, 'data', 'shoe-official-pages.json');
const outputPath = join(root, 'apps', 'mobile', 'src', 'data', 'official-images.json');

const args = process.argv.slice(2);
const write = args.includes('--write');
const limitIndex = args.indexOf('--limit');
const parsedLimit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : NaN;
/** 한 번에 너무 많이 두드리지 않습니다. 매주 조금씩 채워 나갑니다. */
const LIMIT = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : 60;

/** 한 페이지를 기다려 줄 시간입니다. 느린 곳 하나 때문에 전체가 멈추면 안 됩니다. */
const TIMEOUT_MS = 12_000;
/** 요청 사이 간격입니다. 남의 서버에 부담을 주지 않습니다. */
const GAP_MS = 700;
/** 확인한 지 이만큼 지나면 다시 봅니다. 주소가 바뀌는 일이 있습니다. */
const RECHECK_DAYS = 90;

const today = new Date().toISOString().slice(0, 10);

function daysSince(iso) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const at = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(at.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - at.getTime()) / 86_400_000);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * HTML에서 og:image 하나만 꺼냅니다.
 * 정규식으로 HTML 전체를 해석하려 들지 않습니다. 우리가 찾는 태그 한 종류만 봅니다.
 */
function readOgImage(html) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const found = html.match(pattern);
    if (found?.[1]) return found[1].trim();
  }
  return undefined;
}

/**
 * 그림이 아니라 **사이트 표시**인 주소를 걸러 냅니다.
 *
 * 처음 돌렸을 때 favicon.ico가 포스터 자리에 들어왔습니다.
 * 파비콘을 포스터 배너에 늘려 놓으면 우리가 그린 포스터보다 훨씬 못합니다.
 * 사진을 넣는 목적이 "더 좋아 보이게"인데 더 나빠지면 넣을 이유가 없습니다.
 */
function looksLikeSiteMark(url) {
  const lower = url.toLowerCase();
  if (lower.endsWith('.ico')) return true;
  if (lower.includes('favicon')) return true;
  if (lower.includes('apple-touch-icon')) return true;
  // 로고 파일명이 그대로 드러나는 경우입니다.
  if (/\/(logo|symbol|ci)[-_.]/.test(lower)) return true;
  return false;
}

/** 상대 주소를 절대 주소로 폅니다. https가 아니면 버립니다(안드로이드가 http를 막습니다). */
function normalizeImageUrl(raw, pageUrl) {
  if (!raw) return undefined;
  let absolute;
  try {
    absolute = new URL(raw, pageUrl).toString();
  } catch {
    return undefined;
  }
  if (!absolute.startsWith('https://')) return undefined;
  if (absolute.length > 600) return undefined;
  return absolute;
}

function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function fetchOgImage(pageUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(pageUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // 우리가 누구인지 밝힙니다. 숨기고 긁는 것과 다릅니다.
        'user-agent': 'runningbom-image-bot/1.0 (+https://robom.kr)',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('html')) return { ok: false, reason: 'HTML이 아님' };
    // 앞부분만 읽습니다. og:image는 <head>에 있고, 본문까지 받을 이유가 없습니다.
    const html = (await response.text()).slice(0, 200_000);
    const raw = readOgImage(html);
    const url = normalizeImageUrl(raw, response.url || pageUrl);
    if (!url) return { ok: false, reason: 'og:image 없음' };
    if (looksLikeSiteMark(url)) return { ok: false, reason: '포스터가 아니라 사이트 아이콘' };
    return { ok: true, url };
  } catch (error) {
    return { ok: false, reason: error?.name === 'AbortError' ? '시간 초과' : '연결 실패' };
  } finally {
    clearTimeout(timer);
  }
}

// --- 대상 모으기 -----------------------------------------------------------

const raceFile = JSON.parse(await readFile(racesPath, 'utf8'));
const races = Array.isArray(raceFile.races) ? raceFile.races : [];

let existing = { revision: 0, checkedAt: '', images: {} };
try {
  const parsed = JSON.parse(await readFile(outputPath, 'utf8'));
  if (parsed && typeof parsed === 'object' && parsed.images) existing = parsed;
} catch {
  // 파일이 없거나 깨졌으면 처음부터 만듭니다.
}

/**
 * 러닝화 모델별 공식 제품 페이지입니다.
 * 브랜드 **검색** 페이지로는 그 신발 사진이 안 나옵니다. 모델 페이지여야 합니다.
 * 그래서 확인된 것만 data/shoe-official-pages.json에 사람이 채웁니다.
 */
let shoePages = {};
try {
  const parsed = JSON.parse(await readFile(shoePagesPath, 'utf8'));
  if (parsed?.pages && typeof parsed.pages === 'object') shoePages = parsed.pages;
} catch {
  // 파일이 없으면 신발은 이번에 건너뜁니다. 대회는 그대로 진행합니다.
}

const raceTargets = races
  .filter((race) => typeof race.officialUrl === 'string' && race.officialUrl.startsWith('https://'))
  .map((race) => ({ id: race.id, name: race.name, url: race.officialUrl, kind: '대회' }));

// 러닝화는 이제 scripts/collect-shoe-images.mjs가 따로 맡습니다.
//
// 왜 나눴는가: 러닝화는 대회와 요건이 다릅니다.
//   모델 세대가 정확히 맞아야 하고, 같은 사진이 두 모델에 붙으면 안 되고,
//   최소 해상도와 형식을 봐야 합니다. 한 스크립트에 섞으면 둘 다 어설퍼집니다.
const shoeTargets = [];

const targets = raceTargets
  .filter((item) => daysSince(existing.images?.[item.id]?.checkedAt) > RECHECK_DAYS)
  .slice(0, LIMIT);

console.log(`## 공식 이미지 수집`);
console.log('');
console.log(`- 대회 정본: ${races.length}개 · 러닝화 공식 페이지: ${shoeTargets.length}개`);
console.log(`- 이미 가진 이미지: ${Object.keys(existing.images ?? {}).length}개`);
console.log(`- 이번에 확인할 대상: ${targets.length}개 (한도 ${LIMIT})`);
console.log('');

// --- 하나씩 확인 -----------------------------------------------------------

const images = { ...(existing.images ?? {}) };
const failures = [];
let added = 0;

for (const item of targets) {
  const result = await fetchOgImage(item.url);
  if (result.ok) {
    images[item.id] = {
      url: result.url,
      source: hostOf(item.url) || '공식 페이지',
      checkedAt: today,
    };
    added += 1;
  } else {
    failures.push({ name: `[${item.kind}] ${item.name}`, reason: result.reason });
  }
  await sleep(GAP_MS);
}

// --- 공용 이미지 걷어 내기 --------------------------------------------------
//
// 처음 모아 놓고 보니 `marathongo.co.kr/thumbnail.png` 하나가 대회 24개에 똑같이 붙어 있었습니다.
// 그건 그 대회의 포스터가 아니라 **그 사이트의 대문 그림**입니다.
// 서로 다른 대회 카드에 같은 그림이 스물네 번 나오면, 사진이 없느니만 못합니다.
//
// 판단 기준은 단순합니다: **같은 주소가 여러 항목에 붙으면 그 항목의 그림이 아닙니다.**

const SHARED_LIMIT = 2;
const urlUses = new Map();
for (const value of Object.values(images)) {
  urlUses.set(value.url, (urlUses.get(value.url) ?? 0) + 1);
}
const sharedUrls = new Set(
  [...urlUses.entries()].filter(([, count]) => count > SHARED_LIMIT).map(([url]) => url),
);
let dropped = 0;
for (const [id, value] of Object.entries(images)) {
  if (sharedUrls.has(value.url) || looksLikeSiteMark(value.url)) {
    delete images[id];
    dropped += 1;
  }
}

// --- 결과 -----------------------------------------------------------------

const total = Object.keys(images).length;
const raceIds = new Set(races.map((race) => race.id));
const raceHave = Object.keys(images).filter((id) => raceIds.has(id)).length;
const shoeHave = Object.keys(images).filter((id) => id in shoePages).length;
const raceCoverage = races.length === 0 ? 0 : Math.round((raceHave / races.length) * 100);

console.log(`- 이번에 새로 얻음: ${added}개`);
console.log(`- 못 얻음: ${failures.length}개`);
if (dropped > 0) {
  console.log(`- 걷어 냄: ${dropped}개 (여러 항목에 같은 그림 = 그 사이트 대문 그림, 또는 아이콘)`);
}
console.log(`- **대회 이미지: ${raceHave}/${races.length} (${raceCoverage}%)**`);
console.log(`- **러닝화 이미지: ${shoeHave}/${shoeTargets.length} (공식 제품 페이지가 있는 것 기준)**`);
console.log('');
if (shoeTargets.length < 20) {
  console.log(
    `> 러닝화는 **모델별 공식 제품 페이지**가 있어야 사진을 가져올 수 있어요. ` +
      `지금 ${shoeTargets.length}개뿐이라 대부분은 우리 그림이 나갑니다. ` +
      `data/shoe-official-pages.json에 모델 페이지 주소를 더하면 다음 실행에서 사진으로 바뀝니다.`,
  );
  console.log('');
}

if (failures.length > 0) {
  console.log('### 이번에 못 가져온 것');
  console.log('');
  for (const item of failures.slice(0, 20)) {
    console.log(`- ${item.name} — ${item.reason}`);
  }
  console.log('');
  console.log('> 못 가져온 대회는 우리가 조판한 포스터가 그대로 나갑니다. 빈 칸이 생기지 않습니다.');
  console.log('');
}

if (write) {
  const output = {
    note: '공식 페이지가 스스로 공개한 대표 이미지(og:image) 주소만 담습니다. 사람이 만들지 않고 scripts/collect-official-images.mjs가 채웁니다.',
    revision: (existing.revision ?? 0) + 1,
    checkedAt: today,
    // 키 순서를 고정해 매번 같은 파일이 나오게 합니다(쓸데없는 diff 방지).
    images: Object.fromEntries(Object.keys(images).sort().map((id) => [id, images[id]])),
  };
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`갱신했습니다: apps/mobile/src/data/official-images.json`);
}
