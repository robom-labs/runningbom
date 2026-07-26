// 러닝화 카탈로그 정기 점검 스크립트입니다.
//
// 하는 일
// 1) 카탈로그 무결성 검사 (중복 id, 잘못된 카테고리 조합, 끊어진 comparedTo 참조,
//    금지 수치 필드, "최저가" 같은 금지 문자열, 심화 필드 누락)
// 2) 다음에 공식 페이지로 확인해야 할 러닝화 큐(data/shoe-verification-queue.json) 생성
// 3) 사람이 그대로 붙여 넣을 수 있는 이슈 본문(markdown) 출력
//
// 하지 않는 일
// - 외부 사이트 크롤링을 하지 않습니다(약관·차단 위험). 확인은 사람이 공식 페이지에서 합니다.
// - 가격·무게·드롭·스택 같은 수치를 만들어 내지 않습니다.
//
// 사용법
//   node --import tsx scripts/refresh-shoe-data.mjs           # 검사만 (변경 없음)
//   node --import tsx scripts/refresh-shoe-data.mjs --write   # 큐 파일까지 갱신
//   node --import tsx scripts/refresh-shoe-data.mjs --top 20  # 큐 크기 조정
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shoesDir = join(root, 'apps', 'mobile', 'domains', 'shoes');
const queuePath = join(root, 'data', 'shoe-verification-queue.json');

const args = process.argv.slice(2);
const write = args.includes('--write');
const topIndex = args.indexOf('--top');
const parsedTop = topIndex >= 0 ? Number(args[topIndex + 1]) : NaN;
const TOP_N = Number.isFinite(parsedTop) && parsedTop > 0 ? Math.floor(parsedTop) : 15;

/** 카탈로그 엔트리에 절대 있으면 안 되는 수치 필드입니다. */
const FORBIDDEN_FIELDS = ['weightGram', 'dropMm', 'stackMm', 'priceKrw', 'releaseDate', 'stackHeight'];
/** 사용자 문구에 쓰면 안 되는 표현입니다. */
const FORBIDDEN_PHRASES = ['최저가', '해외직구', '병행수입', '정품 보장'];
/** 심화 정보 필수 필드입니다. */
const REQUIRED_FIELDS = ['useCase', 'fitNote', 'bestForRunner', 'notFor', 'keyTech', 'comparedTo'];

const catalogModule = await import(pathToFileURL(join(shoesDir, 'catalog.ts')).href);
const taxonomyModule = await import(pathToFileURL(join(shoesDir, 'taxonomy.ts')).href);

const { shoeCatalog, SHOE_DATA_VERSION } = catalogModule;
const { isValidSubCategory, shoeCategories, shoeBrands } = taxonomyModule;

const problems = [];
function fail(code, message) {
  problems.push({ code, message });
}

// --- 1) 무결성 검사 --------------------------------------------------------

const seen = new Set();
for (const entry of shoeCatalog) {
  if (seen.has(entry.id)) fail('duplicate-id', `중복 id: ${entry.id}`);
  seen.add(entry.id);
}

for (const entry of shoeCatalog) {
  if (!shoeCategories.includes(entry.category)) {
    fail('bad-category', `${entry.id}: 알 수 없는 카테고리 ${entry.category}`);
  } else if (!isValidSubCategory(entry.category, entry.subCategory)) {
    fail('bad-subcategory', `${entry.id}: ${entry.category} > ${entry.subCategory} 조합이 잘못됨`);
  }
  if (!shoeBrands.includes(entry.brand)) {
    fail('bad-brand', `${entry.id}: 등록되지 않은 브랜드 ${entry.brand}`);
  }
  if (entry.subCategory === '카본 플레이트' && entry.plate !== 'carbon') {
    fail('plate-mismatch', `${entry.id}: 카본 플레이트인데 plate=${entry.plate}`);
  }
  if (entry.subCategory === '논 플레이트' && entry.plate !== 'none') {
    fail('plate-mismatch', `${entry.id}: 논 플레이트인데 plate=${entry.plate}`);
  }
}

for (const entry of shoeCatalog) {
  for (const field of FORBIDDEN_FIELDS) {
    if (entry[field] !== undefined) {
      fail('forbidden-field', `${entry.id}: 금지 필드 ${field}가 들어 있음`);
    }
  }
  for (const field of REQUIRED_FIELDS) {
    const value = entry[field];
    const empty = value === undefined || (Array.isArray(value) ? false : String(value).trim() === '');
    if (empty) fail('missing-field', `${entry.id}: 필수 심화 필드 ${field} 누락`);
  }
  if (!Array.isArray(entry.comparedTo) || entry.comparedTo.length === 0) {
    fail('missing-compared-to', `${entry.id}: comparedTo가 비어 있음`);
  }
}

for (const entry of shoeCatalog) {
  for (const other of entry.comparedTo ?? []) {
    if (other === entry.id) fail('self-compare', `${entry.id}: comparedTo가 자기 자신을 가리킴`);
    if (!seen.has(other)) fail('broken-compare', `${entry.id} → ${other}: 끊어진 comparedTo 참조`);
  }
}

for (const entry of shoeCatalog) {
  const blob = [
    entry.pick,
    entry.useCase,
    entry.fitNote,
    ...(entry.strengths ?? []),
    ...(entry.watchouts ?? []),
    ...(entry.bestForRunner ?? []),
    ...(entry.notFor ?? []),
    ...(entry.keyTech ?? []),
  ].join(' ');
  for (const phrase of FORBIDDEN_PHRASES) {
    if (blob.includes(phrase)) fail('forbidden-phrase', `${entry.id}: 금지 표현 "${phrase}"`);
  }
}

// 소스 파일 전체에서도 금지 문자열을 확인합니다(화면 문구에 섞여 들어가는 경우 대비).
const sourceFiles = [
  'catalog.ts',
  'taxonomy.ts',
  'filters.ts',
  'advisor.ts',
  'compare.ts',
  'purchaseLinks.ts',
  'ShoeCard.tsx',
  'ShoeDetail.tsx',
  'ShoeScreen.tsx',
  'ShoeAdvisor.tsx',
  'ShoeCompare.tsx',
];
for (const file of sourceFiles) {
  let source;
  try {
    source = await readFile(join(shoesDir, file), 'utf8');
  } catch {
    continue;
  }
  for (const phrase of FORBIDDEN_PHRASES) {
    // 테스트/주석에서 "쓰지 않는다"고 선언하는 경우를 구분하기 위해 라인 단위로 봅니다.
    for (const [index, line] of source.split('\n').entries()) {
      if (!line.includes(phrase)) continue;
      if (line.trimStart().startsWith('//') || line.includes('FORBIDDEN')) continue;
      fail('forbidden-phrase-source', `${file}:${index + 1} 금지 표현 "${phrase}"`);
    }
  }
}

// --- 2) 공식 확인 대기 큐 --------------------------------------------------

const subCategoryPriority = {
  '카본 플레이트': 1,
  장거리: 1,
  중거리: 2,
  '라이트 플레이트': 2,
  '논 플레이트': 3,
  '맥스 쿠션화': 3,
  올라운더: 4,
  안정화: 4,
  입문화: 5,
  '경량 트레이너': 5,
};

const pending = shoeCatalog
  .filter((entry) => entry.verification !== 'official-checked')
  .map((entry) => ({
    id: entry.id,
    brand: entry.brand,
    model: entry.model,
    modelEn: entry.modelEn,
    category: entry.category,
    subCategory: entry.subCategory,
    verification: entry.verification,
    specNote: entry.specNote ?? null,
    keyTechKnown: (entry.keyTech ?? []).length > 0,
    // 확인 우선순위: 대회화·플레이트 계열이 오해 소지가 커서 먼저 봅니다.
    priority: subCategoryPriority[entry.subCategory] ?? 9,
  }))
  .sort(
    (left, right) =>
      left.priority - right.priority ||
      Number(left.keyTechKnown) - Number(right.keyTechKnown) ||
      left.id.localeCompare(right.id),
  );

const queue = {
  schemaVersion: 1,
  dataVersion: SHOE_DATA_VERSION,
  // 결정적인 산출물을 위해 실행 시각을 넣지 않습니다(변경이 있을 때만 diff가 생기도록).
  policy: {
    crawling: 'none',
    note: '외부 사이트를 크롤링하지 않습니다. 아래 목록은 사람이 브랜드 공식 페이지에서 확인할 대상입니다.',
    checklist: [
      '브랜드 공식 페이지에서 현재 판매 중인 세대(모델명)인지',
      '카테고리·세부 카테고리 분류가 공식 설명과 어긋나지 않는지',
      '공식 폼·플레이트 기술명(keyTech)을 채울 수 있는지',
      '국내 공식 판매 경로가 새로 생겼는지',
    ],
  },
  totals: {
    catalog: shoeCatalog.length,
    officialChecked: shoeCatalog.length - pending.length,
    pending: pending.length,
    queued: Math.min(TOP_N, pending.length),
  },
  queue: pending.slice(0, TOP_N),
};

// --- 3) 리포트 -------------------------------------------------------------

const issueLines = [
  '## 러닝화 데이터 정기 점검',
  '',
  `- 카탈로그: ${shoeCatalog.length}종 (데이터 버전 ${SHOE_DATA_VERSION})`,
  `- 공식 확인 완료: ${queue.totals.officialChecked}종 / 확인 대기: ${queue.totals.pending}종`,
  `- 무결성 문제: ${problems.length}건`,
  '',
  '### 이번에 공식 페이지에서 확인할 러닝화',
  '',
  '| 우선순위 | 브랜드 | 모델 | 세부 카테고리 | 공식 기술명 |',
  '| --- | --- | --- | --- | --- |',
  ...queue.queue.map(
    (item) =>
      `| ${item.priority} | ${item.brand} | ${item.modelEn} | ${item.subCategory} | ${item.keyTechKnown ? '있음' : '미확인'} |`,
  ),
  '',
  '### 확인 체크리스트',
  '',
  ...queue.policy.checklist.map((line) => `- [ ] ${line}`),
  '',
  '> 외부 사이트를 자동 수집하지 않습니다. 위 목록은 사람이 브랜드 공식 페이지에서 직접 확인해 주세요.',
];

if (problems.length > 0) {
  issueLines.push('', '### 무결성 문제', '');
  for (const problem of problems) issueLines.push(`- \`${problem.code}\` ${problem.message}`);
}

const report = issueLines.join('\n');
console.log(report);

if (process.env.GITHUB_STEP_SUMMARY) {
  await writeFile(process.env.GITHUB_STEP_SUMMARY, `${report}\n`, { flag: 'a' });
}

let queueChanged = false;
const nextQueue = `${JSON.stringify(queue, null, 2)}\n`;
let currentQueue = '';
try {
  currentQueue = await readFile(queuePath, 'utf8');
} catch {
  currentQueue = '';
}
queueChanged = currentQueue !== nextQueue;

if (write && queueChanged) {
  await mkdir(dirname(queuePath), { recursive: true });
  await writeFile(queuePath, nextQueue);
  console.error(`\n[refresh-shoe-data] 큐 파일을 갱신했습니다: data/shoe-verification-queue.json`);
} else if (queueChanged) {
  console.error('\n[refresh-shoe-data] 큐 파일 변경 사항이 있습니다(--write로 반영하세요).');
} else {
  console.error('\n[refresh-shoe-data] 큐 파일 변경 없음.');
}

if (problems.length > 0) {
  console.error(`\n[refresh-shoe-data] 무결성 검사 실패: ${problems.length}건`);
  for (const problem of problems) console.error(` - ${problem.code}: ${problem.message}`);
  process.exit(1);
}

process.exit(0);
