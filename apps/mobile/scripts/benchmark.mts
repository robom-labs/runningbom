// 러닝봄이 실제로 얼마나 "빠릿빠릿한지"를 숫자로 재는 성능 측정 스크립트입니다.
//
// 실행법 (apps/mobile 기준):
//   node --import ./node_modules/tsx/dist/loader.mjs scripts/benchmark.mts
//     → 전 항목을 여러 번 반복해 평균·최댓값(ms)을 표로 출력합니다.
//   node --import ./node_modules/tsx/dist/loader.mjs scripts/benchmark.mts --json
//     → 같은 결과를 JSON으로 출력합니다(before/after 비교용).
//   node --import ./node_modules/tsx/dist/loader.mjs scripts/benchmark.mts --save before
//     → scripts/.bench/before.json 으로 저장합니다.
//   node --import ./node_modules/tsx/dist/loader.mjs scripts/benchmark.mts --save after --compare before
//     → 저장해 둔 결과와 before → after 표를 함께 출력합니다.
//   옵션: --only <이름조각>  (항목 이름에 그 조각이 든 것만 측정)
//         --rounds <n>       (반복 횟수 배수. 기본 1)
//
// 규칙
// - 측정 대상 함수의 동작을 바꾸지 않습니다. 여기서는 "부르기만" 합니다.
// - 매 항목을 예열(warmup) 후 여러 번 돌려 평균·최댓값·합계를 냅니다.
// - 결과가 비어 있지 않은지 확인해, 최적화가 결과를 지워 버리는 사고를 막습니다.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { shoeCatalog } from '../domains/shoes/catalog';
import {
  countByBrand,
  countByCategory,
  emptyResultAdvice,
  emptyShoeFilterState,
  filterShoes,
  shoeSorts,
} from '../domains/shoes/filters';
import {
  countCategoryShoes,
  countDistanceShoes,
  countLevelShoes,
  countSubCategoryShoes,
  shoeCategoryGuides,
  shoeDistanceEntries,
  shoeLevelEntries,
  shoeSubCategoryGuidesOf,
} from '../domains/shoes/browse';
import { recommendShoeEntries } from '../domains/shoes/advisor';
import {
  findKnowledgeCards,
  knowledgeCards,
  knowledgeCountsByCategory,
  knowledgeCategories,
  searchKnowledge,
  splitBySearchTerms,
  suggestKnowledge,
} from '../app/screens/guide/knowledge';
import {
  applyQuickFilters,
  countRaces,
  filterRaceGroups,
  groupRaces,
  raceCountsByDay,
  raceMonthBuckets,
  sortRaceGroups,
  type RaceGroup,
} from '../domains/races/aggregate';
import { races, raceFeedFromRecords } from '../src/races';
import bundledRaceData from '../src/data/races.json';
import { createCoachSession, currentPhase, nextPhase, recentCues } from '../domains/coaching/model';
import { runningTypes } from '../domains/coaching/sessionTypes';
import {
  badgeDefinitions,
  badgeProgressList,
  calculateStreak,
  unlockedBadges,
} from '../domains/badges/rules';
import {
  badgeSections,
  earnedDates,
  mostRecentEarned,
  toBadgeView,
} from '../domains/badges/presentation';
import {
  recentActivityCards,
  todayHeadline,
  weekDayMarks,
  weekInsight,
} from '../app/screens/home/model';
import { recommendWeeklyGoal, startingWeeklyGoal } from '../domains/badges/goals';
import { monthlyTrend } from '../domains/activities/trend';
import { personalBestSummary } from '../domains/activities/personalBests';
import { beginnerProgram, findSession, sessionShape } from '../domains/programs/beginnerProgram';
import { sessionTimeline } from '../domains/programs/session';
import { buildTrainingPlan } from '../domains/programs/racePlan';
import type { RunPlan } from '../domains/activities/plans';
import type { ActivityRecord } from '../domains/activities/types';

// ---------------------------------------------------------------------------
// 측정 뼈대
// ---------------------------------------------------------------------------

type Sample = {
  name: string;
  /** 한 번 도는 데 걸린 시간(ms) 평균 */
  avgMs: number;
  /** 가장 오래 걸린 한 번(ms) */
  maxMs: number;
  /** 전체 반복에 걸린 시간(ms) */
  totalMs: number;
  runs: number;
  /** 결과가 비어 있지 않은지 확인하는 값(개수 등). 최적화 전후로 같아야 합니다. */
  checksum: number;
};

const args = process.argv.slice(2);
function flag(name: string): boolean {
  return args.includes(`--${name}`);
}
function option(name: string): string | undefined {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? undefined : args[at + 1];
}

const roundsScale = Math.max(1, Number(option('rounds') ?? 1) || 1);
const only = option('only');
const results: Sample[] = [];

/** 항목 하나를 예열한 뒤 runs번 돌려 평균·최댓값을 냅니다. */
function measure(name: string, runs: number, body: () => number): void {
  if (only && !name.includes(only)) return;
  const total = Math.max(1, Math.round(runs * roundsScale));
  // 예열: JIT가 자리를 잡기 전 첫 회를 평균에 섞지 않습니다.
  const warmup = Math.min(3, total);
  let checksum = 0;
  for (let index = 0; index < warmup; index += 1) checksum = body();

  let sum = 0;
  let max = 0;
  for (let index = 0; index < total; index += 1) {
    const started = performance.now();
    checksum = body();
    const took = performance.now() - started;
    sum += took;
    if (took > max) max = took;
  }
  results.push({
    name,
    avgMs: sum / total,
    maxMs: max,
    totalMs: sum,
    runs: total,
    checksum,
  });
}

// ---------------------------------------------------------------------------
// 시뮬레이션 데이터
// 실제 사용자를 흉내 낸 기록입니다. 무작위 씨앗을 고정해 매번 같은 입력으로 잽니다.
// ---------------------------------------------------------------------------

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

/** 오늘로부터 거꾸로 하루에 최대 1건씩 쌓은 활동 기록입니다. */
function makeActivities(count: number, now = Date.parse('2026-07-27T09:00:00+09:00')): ActivityRecord[] {
  const random = seededRandom(20_260_727);
  const list: ActivityRecord[] = [];
  for (let index = 0; index < count; index += 1) {
    // 하루 걸러 하루꼴로 뒤로 물러납니다(연속 기록·주간 집계가 실제처럼 섞이도록).
    const daysAgo = Math.floor(index * 1.35);
    const completedAt = new Date(now - daysAgo * 86_400_000 - Math.floor(random() * 8) * 3_600_000);
    const roll = random();
    const kind: ActivityRecord['kind'] = roll > 0.82 ? 'walk' : roll > 0.74 ? 'recovery' : 'run';
    const durationMinutes = 20 + Math.floor(random() * 55);
    list.push({
      id: roll > 0.5 ? `coach:인터벌:${index}` : `manual:${index}`,
      localUuid: `uuid-${index}`,
      kind,
      durationMinutes,
      distanceKm: kind === 'run' ? Math.round((durationMinutes / 6.2) * 100) / 100 : undefined,
      source: roll > 0.4 ? 'COACH_COMPLETED' : 'SELF_LOGGED',
      completedAt: completedAt.toISOString(),
      timezoneId: 'Asia/Seoul',
    });
  }
  // 화면은 최신순으로 받습니다.
  return list;
}

const NOW = Date.parse('2026-07-27T09:00:00+09:00');
const activities1000 = makeActivities(1000);
const activities120 = makeActivities(120);
const plans: RunPlan[] = [
  {
    id: 'plan-1',
    date: '2026-07-28',
    title: '가볍게 30분',
    kind: 'run',
    createdAt: '2026-07-20T00:00:00.000Z',
  },
  {
    id: 'plan-2',
    date: '2026-08-02',
    title: '롱런 12km',
    kind: 'run',
    createdAt: '2026-07-20T00:00:00.000Z',
  },
];
const weeklyGoal = recommendWeeklyGoal(activities120, NOW);

const searchQueries = ['페가수스', 'nike', '보메로', '카본', '알파플라이', '없는신발이름'];
const knowledgeQueries = ['무릎', '러닝화 고르기', '겨울 달리기', '체중', '숨쉬기', '없는말123'];

// ---------------------------------------------------------------------------
// 1) 러닝화 123종 · 목록 만들기 · 필터 · 정렬
// ---------------------------------------------------------------------------

measure('러닝화 · 전체 목록 정렬(추천순)', 400, () => filterShoes(emptyShoeFilterState).length);

measure('러닝화 · 정렬 5종 전부', 200, () => {
  let total = 0;
  for (const sort of shoeSorts) total += filterShoes({ ...emptyShoeFilterState, sort }).length;
  return total;
});

measure('러닝화 · 검색 6개 질의', 200, () => {
  let total = 0;
  for (const query of searchQueries) {
    total += filterShoes({ ...emptyShoeFilterState, query }).length;
  }
  return total;
});

measure('러닝화 · 복합 필터(갈래+브랜드+실력+거리)', 300, () => {
  return filterShoes({
    ...emptyShoeFilterState,
    category: '데일리',
    brands: ['Nike', 'ASICS', 'HOKA'],
    levels: ['중급'],
    distances: ['10K', '하프'],
    sort: '이름순',
  }).length;
});

measure('러닝화 · 0건일 때 풀 축 안내(emptyResultAdvice)', 60, () => {
  const advice = emptyResultAdvice({
    ...emptyShoeFilterState,
    query: '알파플라이',
    category: '데일리',
    brands: ['HOKA'],
    levels: ['입문'],
    distances: ['풀'],
    priceBands: ['프리미엄'],
  });
  return advice ? advice.count : 0;
});

measure('러닝화 · 탐색 첫 화면 개수 집계', 300, () => {
  let total = 0;
  for (const guide of shoeCategoryGuides) {
    total += countCategoryShoes(guide.category);
    for (const sub of shoeSubCategoryGuidesOf(guide.category)) {
      total += countSubCategoryShoes(sub.category, sub.subCategory);
    }
  }
  for (const entry of shoeDistanceEntries) total += countDistanceShoes(entry.key);
  for (const entry of shoeLevelEntries) total += countLevelShoes(entry.level);
  total += Object.values(countByCategory()).reduce((a, b) => a + b, 0);
  total += Object.values(countByBrand()).reduce((a, b) => a + b, 0);
  return total;
});

measure('러닝화 · 추천(advisor)', 300, () =>
  recommendShoeEntries({
    experience: '1년내',
    goal: '대회준비',
    distance: '10K',
    budget: '미들',
  }).length,
);

// ---------------------------------------------------------------------------
// 2) 러닝 궁금증 130건 · 검색 · 분류
// ---------------------------------------------------------------------------

measure('궁금증 · 검색 6개 질의', 200, () => {
  let total = 0;
  for (const query of knowledgeQueries) total += searchKnowledge(query).length;
  return total;
});

measure('궁금증 · 분류+검색(findKnowledgeCards)', 100, () => {
  let total = 0;
  for (const category of knowledgeCategories) {
    total += findKnowledgeCards(category, '러닝').length;
  }
  return total;
});

measure('궁금증 · 0건일 때 비슷한 질문(suggestKnowledge)', 100, () => {
  let total = 0;
  for (const query of knowledgeQueries) total += suggestKnowledge(query).length;
  return total;
});

measure('궁금증 · 분류별 개수', 2000, () => {
  const counts = knowledgeCountsByCategory();
  return counts['전체'];
});

measure('궁금증 · 검색어 강조 조각내기(130건)', 200, () => {
  let total = 0;
  for (const card of knowledgeCards) total += splitBySearchTerms(card.question, '무릎 통증').length;
  return total;
});

// ---------------------------------------------------------------------------
// 3) 대회 183건 · 묶기 · 필터 · 정렬 · 달력
// ---------------------------------------------------------------------------

measure('대회 · 183건 묶기(groupRaces)', 300, () => groupRaces(races, NOW).length);

measure('대회 · 개수 세기(countRaces)', 300, () => countRaces(races, NOW));

const raceGroups: RaceGroup[] = groupRaces(races, NOW);

measure('대회 · 필터(지역+거리+기간+검색)', 500, () => {
  let total = 0;
  for (const query of ['', '마라톤', '서울']) {
    total += filterRaceGroups(
      raceGroups,
      { region: '전체', distance: '전체', registration: '전체', period: '3개월', query },
      NOW,
    ).length;
  }
  return total;
});

measure('대회 · 빠른 칩 + 정렬 3종', 500, () => {
  let total = 0;
  const quick = applyQuickFilters(raceGroups, ['접수 중만'], { myRegion: '서울' }, NOW);
  for (const sort of ['가까운 날짜순', '거리순', '지역순'] as const) {
    total += sortRaceGroups(quick, sort).length;
  }
  return total;
});

measure('대회 · 달력 월별 묶기 + 날짜별 개수', 300, () => {
  const buckets = raceMonthBuckets(raceGroups);
  let total = buckets.length;
  for (const bucket of buckets) total += Object.keys(raceCountsByDay(raceGroups, bucket.month)).length;
  return total;
});

// ---------------------------------------------------------------------------
// 4) 코치 세션 생성 (전 유형)
// ---------------------------------------------------------------------------

measure(`코치 · 전 ${runningTypes.length}유형 세션 생성(30분)`, 40, () => {
  let total = 0;
  for (const type of runningTypes) total += createCoachSession(type.id, 30).cues.length;
  return total;
});

measure('코치 · 단일 세션 생성(30분 · 보통)', 300, () => createCoachSession('easy', 30).cues.length);

measure('코치 · 긴 세션 생성(90분 · 자세히)', 100, () =>
  createCoachSession('long', 90, 'detailed').cues.length,
);

// ---------------------------------------------------------------------------
// 5) 배지 48종 진행률
// ---------------------------------------------------------------------------

measure(`배지 · ${badgeDefinitions.length}종 진행률(활동 1000건)`, 40, () => {
  const streak = calculateStreak(activities1000, new Date(NOW));
  const views = badgeProgressList(activities1000, streak).map((entry) => toBadgeView(entry));
  return badgeSections(views).length + views.length;
});

measure(`배지 · ${badgeDefinitions.length}종 진행률(활동 120건)`, 200, () => {
  const streak = calculateStreak(activities120, new Date(NOW));
  const views = badgeProgressList(activities120, streak).map((entry) => toBadgeView(entry));
  return badgeSections(views).length + views.length;
});

measure('배지 · 연속 기록 계산(활동 1000건)', 100, () =>
  calculateStreak(activities1000, new Date(NOW)).best,
);

measure('배지 · 받은 날짜 되짚기(활동 120건)', 20, () =>
  Object.keys(earnedDates(activities120)).length,
);

measure('배지 · 대표 배지 고르기(활동 120건)', 40, () => {
  const streak = calculateStreak(activities120, new Date(NOW));
  const views = badgeProgressList(activities120, streak).map((entry) => toBadgeView(entry));
  const dates = earnedDates(activities120);
  return mostRecentEarned(views, dates) ? 1 : 0;
});

// ---------------------------------------------------------------------------
// 6) 홈 화면 데이터 조립 (활동 1000건)
// ---------------------------------------------------------------------------

function assembleHome(list: ActivityRecord[]): number {
  const headline = todayHeadline({
    activities: list,
    weeklyGoal,
    plans,
    coachMinutes: 30,
    goalRace: { name: '서울마라톤', raceDate: '2026-09-13' },
    now: NOW,
  });
  const week = weekInsight(list, weeklyGoal, NOW);
  const marks = weekDayMarks(list, NOW);
  const recent = recentActivityCards(list, 2);
  const groups = groupRaces(races, NOW);
  return headline.text.length + week.meaning.length + marks.length + recent.length + groups.length;
}

measure('홈 · 화면 데이터 조립(활동 1000건)', 60, () => assembleHome(activities1000));
measure('홈 · 화면 데이터 조립(활동 120건)', 200, () => assembleHome(activities120));

measure('기록 · 월별 추이 6개월(활동 1000건)', 100, () =>
  monthlyTrend(activities1000, 'distance', 6, NOW).length,
);

measure('기록 · 개인 최고 기록(활동 1000건)', 100, () =>
  personalBestSummary(activities1000).bests.length,
);

// ---------------------------------------------------------------------------
// 7) 9주 프로그램 27회차 · 훈련 계획
// ---------------------------------------------------------------------------

measure(`프로그램 · 9주 ${beginnerProgram.sessions.length}회차 조립`, 500, () => {
  let total = 0;
  for (const session of beginnerProgram.sessions) {
    total += sessionShape(session).length;
    total += sessionTimeline(session).entries.length;
    total += findSession(session.id) ? 1 : 0;
  }
  return total;
});

measure('훈련 계획 · 16주 계획 만들기', 300, () =>
  buildTrainingPlan({
    distance: 'half',
    weeksLeft: 16,
    runsPerWeek: 4,
    weeklyKm: 25,
    longestRecentKm: 10,
  }).weeks.length,
);

measure('훈련 계획 · 거리 4종 × 주차 3종', 100, () => {
  let total = 0;
  for (const distance of ['5k', '10k', 'half', 'full'] as const) {
    for (const weeksLeft of [8, 16, 24]) {
      total += buildTrainingPlan({ distance, weeksLeft, runsPerWeek: 4, weeklyKm: 30 }).weeks.length;
    }
  }
  return total;
});

// ---------------------------------------------------------------------------
// 8) 앱 첫 실행 때 실제로 도는 계산
// (모듈을 읽어 들이는 시간이 아니라, 읽는 동안·직후에 앱이 하는 일을 잽니다.)
// ---------------------------------------------------------------------------

measure('앱 시작 · 대회 183건 훑어 담기', 200, () =>
  raceFeedFromRecords(bundledRaceData.revision, bundledRaceData.races, NOW).races.length,
);

/** AppStateProvider가 기록을 읽은 직후 하는 일 그대로입니다. */
function prepareAppState(list: ActivityRecord[]): number {
  const streak = calculateStreak(list);
  const progress = badgeProgressList(list, streak, { interestedRaceCount: 3 });
  const badges = unlockedBadges(list, streak, { interestedRaceCount: 3 });
  const goal = startingWeeklyGoal(list, '1~3년', NOW);
  return streak.best + progress.length + badges.length + goal.target;
}

measure('앱 시작 · 상태 준비(활동 1000건)', 60, () => prepareAppState(activities1000));
measure('앱 시작 · 상태 준비(활동 120건)', 200, () => prepareAppState(activities120));

// ---------------------------------------------------------------------------
// 9) 러닝 중 1초마다 도는 계산
// 시간 표시가 1초에 한 번 바뀌므로, 그때 도는 계산이 무거우면 화면이 끊깁니다.
// ---------------------------------------------------------------------------

const longSession = createCoachSession('long', 60, 'detailed');

measure('러닝 화면 · 1초 갱신 60분(3600틱)', 30, () => {
  let total = 0;
  for (let elapsed = 0; elapsed < 3_600; elapsed += 1) {
    total += currentPhase(longSession, elapsed) ? 1 : 0;
    total += nextPhase(longSession, elapsed) ? 1 : 0;
    total += recentCues(longSession, elapsed, 4).length;
  }
  return total;
});

// ---------------------------------------------------------------------------
// 10) 앱 첫 실행 · 무거운 모듈 읽어 들이기
// 모듈 캐시를 우회해 "처음 켤 때 한 번" 드는 비용을 잽니다.
// ---------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, '..');

/**
 * 모듈이 "처음 읽힐 때" 드는 비용은 같은 프로세스에서 두 번 잴 수 없습니다(캐시).
 * 그래서 아이가 되는 프로세스를 새로 띄워 그 안에서 import 시간만 재고 숫자를 받아 옵니다.
 */
function measureImport(name: string, specifier: string, runs = 5): void {
  if (only && !name.includes(only)) return;
  const script = `const t = performance.now(); const m = await import(${JSON.stringify(
    specifier,
  )}); console.log(JSON.stringify([performance.now() - t, Object.keys(m).length]));`;
  let sum = 0;
  let max = 0;
  let checksum = 0;
  for (let index = 0; index < runs; index += 1) {
    const out = execFileSync(
      process.execPath,
      ['--import', './node_modules/tsx/dist/loader.mjs', '--input-type=module', '-e', script],
      { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const [took, keys] = JSON.parse(out.trim()) as [number, number];
    sum += took;
    if (took > max) max = took;
    checksum = keys;
  }
  results.push({ name, avgMs: sum / runs, maxMs: max, totalMs: sum, runs, checksum });
}

measureImport('첫 실행 · 러닝화 정본 읽기', './domains/shoes/catalog.ts');
measureImport('첫 실행 · 궁금증 130건 읽기', './app/screens/guide/knowledge.ts');
measureImport('첫 실행 · 대회 목록 읽기', './src/races.ts');
measureImport('첫 실행 · 코치 큐 사전 읽기', './domains/coaching/cueLibrary.ts');
measureImport('첫 실행 · 9주 프로그램 읽기', './domains/programs/beginnerProgram.ts');

// ---------------------------------------------------------------------------
// 출력
// ---------------------------------------------------------------------------

function fmt(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(3);
}

function pad(value: string, width: number): string {
  // 한글은 두 칸을 차지하므로 폭을 그렇게 세어 표를 맞춥니다.
  let cells = 0;
  for (const char of value) cells += char.codePointAt(0)! > 0x1100 ? 2 : 1;
  return value + ' '.repeat(Math.max(0, width - cells));
}

const benchDir = join(here, '.bench');

function loadSaved(label: string): Sample[] | undefined {
  try {
    return JSON.parse(readFileSync(join(benchDir, `${label}.json`), 'utf8')) as Sample[];
  } catch {
    return undefined;
  }
}

if (flag('json')) {
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
} else {
  const compareLabel = option('compare');
  const baseline = compareLabel ? loadSaved(compareLabel) : undefined;
  const baseByName = new Map((baseline ?? []).map((entry) => [entry.name, entry]));
  const nameWidth = Math.max(...results.map((entry) => [...entry.name].reduce((sum, char) => sum + (char.codePointAt(0)! > 0x1100 ? 2 : 1), 0)), 28);

  const header = baseline
    ? `${pad('항목', nameWidth)}  ${pad('before(ms)', 11)}${pad('after(ms)', 11)}${pad('변화', 10)}${pad('최댓값', 9)}검증`
    : `${pad('항목', nameWidth)}  ${pad('평균(ms)', 11)}${pad('최댓값(ms)', 12)}${pad('반복', 6)}검증`;
  process.stdout.write(`${header}\n${'-'.repeat(header.length)}\n`);

  for (const entry of results) {
    const base = baseByName.get(entry.name);
    if (baseline && base) {
      const delta = base.avgMs === 0 ? 0 : ((entry.avgMs - base.avgMs) / base.avgMs) * 100;
      const mark = delta <= -5 ? '↓' : delta >= 5 ? '↑' : '·';
      const same = base.checksum === entry.checksum ? 'ok' : `다름(${base.checksum}→${entry.checksum})`;
      process.stdout.write(
        `${pad(entry.name, nameWidth)}  ${pad(fmt(base.avgMs), 11)}${pad(fmt(entry.avgMs), 11)}${pad(
          `${mark}${delta > 0 ? '+' : ''}${delta.toFixed(0)}%`,
          10,
        )}${pad(fmt(entry.maxMs), 9)}${same}\n`,
      );
      continue;
    }
    process.stdout.write(
      `${pad(entry.name, nameWidth)}  ${pad(fmt(entry.avgMs), 11)}${pad(fmt(entry.maxMs), 12)}${pad(
        String(entry.runs),
        6,
      )}${entry.checksum}\n`,
    );
  }

  const slowest = [...results].sort((left, right) => right.avgMs - left.avgMs).slice(0, 5);
  process.stdout.write('\n가장 느린 5개\n');
  slowest.forEach((entry, index) => {
    process.stdout.write(`  ${index + 1}. ${entry.name} — 평균 ${fmt(entry.avgMs)}ms\n`);
  });
}

const saveLabel = option('save');
if (saveLabel) {
  mkdirSync(benchDir, { recursive: true });
  writeFileSync(join(benchDir, `${saveLabel}.json`), `${JSON.stringify(results, null, 2)}\n`);
  process.stderr.write(`\n저장했습니다: scripts/.bench/${saveLabel}.json\n`);
}
