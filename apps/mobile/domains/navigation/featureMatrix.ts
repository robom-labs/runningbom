// 기능 보존 매트릭스입니다. **순수합니다.**
//
// V7은 기능을 지우는 작업이 아닙니다. 그런데 화면을 갈아엎으면 기능은 **조용히 사라집니다.**
// 메뉴에서 항목 하나가 빠지면 그 기능은 코드에 남아 있어도 아무도 도달할 수 없습니다.
// 그러면 "삭제하지 않았다"는 말은 사실이지만 사용자에게는 삭제된 것과 같습니다.
//
// 그래서 기존 기능을 전부 표로 적고, **도달할 수 없는 것이 하나라도 있으면 테스트가 막습니다.**
//
// 노출 등급:
//   PRIMARY         항상 보입니다
//   CONTEXTUAL      해당 상황일 때 자동으로 나타납니다
//   SECONDARY       그 목적지 안에서 한 번 더 들어가면 있습니다
//   ADVANCED        상세 설정 안에만 있습니다
//   FEATURE_GATED   준비가 끝났을 때만 보입니다
//   DEVELOPER_ONLY  일반 사용자에게 숨깁니다

import { destinationForRoute, type PrimaryDestination } from './destinations';

export type Visibility =
  | 'PRIMARY'
  | 'CONTEXTUAL'
  | 'SECONDARY'
  | 'ADVANCED'
  | 'FEATURE_GATED'
  | 'DEVELOPER_ONLY';

export type FeatureMigration = {
  featureId: string;
  /** 사람이 읽는 이름입니다. */
  label: string;
  /** 예전에 어디로 갔는지입니다(드로어 항목·탭·화면). */
  oldEntry: string;
  /** 예전 라우트입니다. 딥링크가 이 값을 씁니다. */
  legacyRoute: string;
  newPrimary: PrimaryDestination;
  /** 새 위치입니다. `라우트 > 구역 > 하위` 형태로 적습니다. */
  newRoute: string;
  visibility: Visibility;
  /** 이 기능이 건드리는 저장 키입니다. 바뀌면 안 됩니다. */
  preservedStorageKeys: string[];
};

export const featureMatrix: FeatureMigration[] = [
  // ── 오늘 ──────────────────────────────────────────────────────────────────
  {
    featureId: 'today-action',
    label: '오늘 할 러닝',
    oldEntry: '홈 hero + TodayCard (두 개로 나뉘어 있었음)',
    legacyRoute: 'home',
    newPrimary: 'today',
    newRoute: 'home > TodayAction',
    visibility: 'PRIMARY',
    preservedStorageKeys: ['runningbom:vnext:programs:v1', 'runningbom.retrospect.v1'],
  },
  {
    featureId: 'weekly-goal',
    label: '이번 주 목표',
    oldEntry: '홈 카드',
    legacyRoute: 'home',
    newPrimary: 'today',
    newRoute: 'home > WeekStrip · 상세는 stats > 분석',
    visibility: 'CONTEXTUAL',
    preservedStorageKeys: ['runningbom:vnext:weekly-goal:v1'],
  },
  {
    featureId: 'goal-race',
    label: '목표 대회',
    oldEntry: '홈 카드',
    legacyRoute: 'home',
    newPrimary: 'today',
    newRoute: 'home > RunRail · 상세는 races',
    visibility: 'CONTEXTUAL',
    preservedStorageKeys: ['runningbom:vnext:goal-race:v1'],
  },
  {
    featureId: 'recent-activity',
    label: '최근 기록',
    oldEntry: '홈 카드',
    legacyRoute: 'home',
    newPrimary: 'today',
    newRoute: 'home > 최근 1개 · 전체는 stats > 활동 기록',
    visibility: 'CONTEXTUAL',
    preservedStorageKeys: [],
  },
  {
    featureId: 'month-map',
    label: '이번 달 지도',
    oldEntry: '홈 MonthMapCard',
    legacyRoute: 'home',
    newPrimary: 'me',
    newRoute: 'badges > 성취 > 월간 지도',
    visibility: 'SECONDARY',
    preservedStorageKeys: [],
  },

  // ── 훈련 ──────────────────────────────────────────────────────────────────
  {
    featureId: 'current-plan',
    label: '지금 하는 계획',
    oldEntry: '훈련 accordion 1',
    legacyRoute: 'programs',
    newPrimary: 'training',
    newRoute: 'programs > 내 계획',
    visibility: 'PRIMARY',
    preservedStorageKeys: ['runningbom:vnext:programs:v1'],
  },
  {
    featureId: 'plan-catalog',
    label: '훈련 계획',
    oldEntry: '훈련 accordion 1 안의 PlanPicker',
    legacyRoute: 'programs',
    newPrimary: 'training',
    newRoute: 'programs > 내 계획 > 계획 찾기',
    visibility: 'SECONDARY',
    preservedStorageKeys: ['runningbom:vnext:programs:v1'],
  },
  {
    featureId: 'workout-library',
    label: '일회성 훈련',
    oldEntry: '훈련 accordion 2',
    legacyRoute: 'programs',
    newPrimary: 'training',
    newRoute: 'programs > 라이브러리',
    visibility: 'SECONDARY',
    preservedStorageKeys: ['runningbom:vnext:run-plans:v1'],
  },
  {
    featureId: 'challenges',
    label: '도전',
    oldEntry: '훈련 accordion 3',
    legacyRoute: 'challenges',
    newPrimary: 'training',
    newRoute: 'challenges (훈련 > 더 활용하기)',
    visibility: 'SECONDARY',
    preservedStorageKeys: ['runningbom:vnext:challenges:v1'],
  },
  {
    featureId: 'support-projects',
    label: '보조 프로젝트',
    oldEntry: '훈련 accordion 4',
    legacyRoute: 'programs',
    newPrimary: 'training',
    newRoute: 'programs > 더 활용하기 > 챙길 것',
    visibility: 'SECONDARY',
    preservedStorageKeys: ['runningbom.projects.v1'],
  },
  {
    featureId: 'metronome',
    label: '박자 맞추기 · 케이던스',
    oldEntry: '드로어 + 훈련 탭 매핑',
    legacyRoute: 'cadence',
    newPrimary: 'training',
    newRoute: 'cadence (훈련 > 더 활용하기) · 달리기 준비에서도 바로 감',
    visibility: 'SECONDARY',
    preservedStorageKeys: [],
  },
  {
    featureId: 'calendar',
    label: '일정 · 캘린더',
    oldEntry: '드로어',
    legacyRoute: 'calendar',
    newPrimary: 'training',
    newRoute: 'calendar (훈련 > 일정)',
    visibility: 'SECONDARY',
    preservedStorageKeys: [],
  },
  {
    featureId: 'retrospect',
    label: '러닝 회고 · 몸 상태',
    oldEntry: '훈련 화면 카드',
    legacyRoute: 'programs',
    newPrimary: 'training',
    newRoute: 'programs > 오늘 · 완료 화면',
    visibility: 'CONTEXTUAL',
    preservedStorageKeys: ['runningbom.retrospect.v1'],
  },

  // ── 달리기 ────────────────────────────────────────────────────────────────
  {
    featureId: 'run-start',
    label: '러닝 시작',
    oldEntry: '홈 버튼 + 드로어',
    legacyRoute: 'start',
    newPrimary: 'run',
    newRoute: 'start > RunDock',
    visibility: 'PRIMARY',
    preservedStorageKeys: ['runningbom:vnext:preferences:v1'],
  },
  {
    featureId: 'run-extent',
    label: '시간 · 거리 · 끝낼 때까지',
    oldEntry: '시작 화면 slider + 칩 + 직접 입력',
    legacyRoute: 'start',
    newPrimary: 'run',
    newRoute: 'start > 시간 sheet',
    visibility: 'PRIMARY',
    preservedStorageKeys: ['runningbom:vnext:preferences:v1'],
  },
  {
    featureId: 'run-type',
    label: '러닝 유형',
    oldEntry: '시작 화면 유형 모달',
    legacyRoute: 'start',
    newPrimary: 'run',
    newRoute: 'start > 유형 sheet',
    visibility: 'PRIMARY',
    preservedStorageKeys: ['runningbom:vnext:preferences:v1'],
  },
  {
    featureId: 'coach-v6',
    label: 'V6 음성 코치 (성격 · 말투 · 말수 · 긴 이야기)',
    oldEntry: '설정 CoachPersonaCard + 시작 화면 안내 정도',
    legacyRoute: 'start',
    newPrimary: 'run',
    newRoute: 'start > 코치 sheet · 상세는 settings > 코치·소리',
    visibility: 'PRIMARY',
    preservedStorageKeys: ['runningbom:coaching:settings:v1', 'runningbom:coaching:voice:v1'],
  },
  {
    featureId: 'gps-tracking',
    label: 'GPS Preview 추적 · 자동 멈춤 · 구간',
    oldEntry: '시작 화면 인라인',
    legacyRoute: 'start',
    newPrimary: 'run',
    newRoute: 'start > 고급 · ActiveRun',
    visibility: 'ADVANCED',
    preservedStorageKeys: ['runningbom:run-experience:v1'],
  },
  {
    featureId: 'run-weight-calorie',
    label: '몸무게 · 칼로리',
    oldEntry: '시작 화면 입력',
    legacyRoute: 'start',
    newPrimary: 'me',
    newRoute: 'settings > 달리는 중 > 고급',
    visibility: 'ADVANCED',
    preservedStorageKeys: ['runningbom:run-experience:v1'],
  },
  {
    featureId: 'run-countdown',
    label: '카운트다운',
    oldEntry: '시작 화면',
    legacyRoute: 'start',
    newPrimary: 'run',
    newRoute: 'start > 고급',
    visibility: 'SECONDARY',
    preservedStorageKeys: ['runningbom:run-experience:v1'],
  },
  {
    featureId: 'night-run',
    label: '야간 모드',
    oldEntry: '시작 화면',
    legacyRoute: 'start',
    newPrimary: 'run',
    newRoute: '자동 · settings > 달리는 중',
    visibility: 'ADVANCED',
    preservedStorageKeys: ['runningbom:run-experience:v1'],
  },

  // ── 찾기 ──────────────────────────────────────────────────────────────────
  {
    featureId: 'races',
    label: '대회 목록 · 상세 · 접수 알림',
    oldEntry: '탭 + 드로어',
    legacyRoute: 'races',
    newPrimary: 'explore',
    newRoute: 'races > 대회',
    visibility: 'PRIMARY',
    preservedStorageKeys: ['runningbom:vnext:goal-race:v1'],
  },
  {
    featureId: 'race-filters',
    label: '대회 필터 · 달력 보기',
    oldEntry: '목록 위에 전부 펼쳐져 있었음',
    legacyRoute: 'races',
    newPrimary: 'explore',
    newRoute: 'races > 필터 sheet · 보기 전환',
    visibility: 'SECONDARY',
    preservedStorageKeys: [],
  },
  {
    featureId: 'shoes',
    label: '러닝화 · 추천 · 가격 · 순위',
    oldEntry: '탭 + 드로어 + 홈 순위 카드',
    legacyRoute: 'shoes',
    newPrimary: 'explore',
    newRoute: 'shoes > 러닝화',
    visibility: 'PRIMARY',
    preservedStorageKeys: ['runningbom:vnext:preferences:v1'],
  },
  {
    featureId: 'shoe-compare',
    label: '러닝화 비교',
    oldEntry: '러닝화 화면',
    legacyRoute: 'shoes',
    newPrimary: 'explore',
    newRoute: 'shoes > 비교',
    visibility: 'SECONDARY',
    preservedStorageKeys: [],
  },
  {
    featureId: 'knowledge',
    label: '러닝 지식 · Q&A',
    oldEntry: '드로어 + 훈련 탭 매핑 + 홈 카드',
    legacyRoute: 'guide',
    newPrimary: 'explore',
    newRoute: 'guide > 러닝 지식',
    visibility: 'SECONDARY',
    preservedStorageKeys: [],
  },

  // ── 나 ────────────────────────────────────────────────────────────────────
  {
    featureId: 'activity-history',
    label: '활동 기록 · 필터 · 수동 기록',
    oldEntry: '기록 탭',
    legacyRoute: 'stats',
    newPrimary: 'me',
    newRoute: 'stats > 활동 기록',
    visibility: 'PRIMARY',
    preservedStorageKeys: ['runningbom:vnext:local-uuid'],
  },
  {
    featureId: 'analysis',
    label: '주·월 통계 · 추이 · 최고기록',
    oldEntry: '기록 탭 한 스크롤',
    legacyRoute: 'stats',
    newPrimary: 'me',
    newRoute: 'stats > 분석',
    visibility: 'SECONDARY',
    preservedStorageKeys: ['runningbom:vnext:weekly-goal:v1'],
  },
  {
    featureId: 'badges',
    label: '배지',
    oldEntry: '드로어 + 기록 탭',
    legacyRoute: 'badges',
    newPrimary: 'me',
    newRoute: 'badges > 성취',
    visibility: 'SECONDARY',
    preservedStorageKeys: [],
  },
  {
    featureId: 'saved-items',
    label: '보관함 — 관심 대회 · 관심 러닝화 · 내 신발',
    oldEntry: '프로필 안 러닝화 검색 + 대회 화면',
    legacyRoute: 'profile',
    newPrimary: 'me',
    newRoute: 'profile > 보관함',
    visibility: 'SECONDARY',
    preservedStorageKeys: ['runningbom:vnext:preferences:v1'],
  },
  {
    featureId: 'profile',
    label: '프로필 — 닉네임 · 소개 · 경력 · 동네',
    oldEntry: '프로필 화면(러닝화 카탈로그가 섞여 있었음)',
    legacyRoute: 'profile',
    newPrimary: 'me',
    newRoute: 'profile > 프로필',
    visibility: 'SECONDARY',
    preservedStorageKeys: ['runningbom:vnext:preferences:v1'],
  },
  {
    featureId: 'record-share',
    label: '기록 공유 카드 · 임시 글',
    oldEntry: '커뮤니티 화면',
    legacyRoute: 'community',
    newPrimary: 'me',
    newRoute: 'community > 공유 기록 · 완료 화면',
    visibility: 'CONTEXTUAL',
    preservedStorageKeys: ['runningbom:vnext:community-drafts:v1'],
  },
  {
    featureId: 'social-feed',
    label: '사람들 소식 · 크루 · 리그',
    oldEntry: '커뮤니티 화면에 "준비 중"으로 상시 노출',
    legacyRoute: 'community',
    newPrimary: 'me',
    newRoute: 'community (서버가 준비된 경우에만 노출)',
    visibility: 'FEATURE_GATED',
    preservedStorageKeys: [],
  },

  // ── 설정 ──────────────────────────────────────────────────────────────────
  {
    featureId: 'settings-coach-sound',
    label: '설정 — 코치·소리',
    oldEntry: '설정 한 스크롤',
    legacyRoute: 'settings',
    newPrimary: 'me',
    newRoute: 'settings > 코치·소리',
    visibility: 'SECONDARY',
    preservedStorageKeys: ['runningbom:coaching:settings:v1', 'runningbom:coaching:voice:v1'],
  },
  {
    featureId: 'settings-run',
    label: '설정 — 달리는 중',
    oldEntry: '설정 한 스크롤',
    legacyRoute: 'settings',
    newPrimary: 'me',
    newRoute: 'settings > 달리는 중',
    visibility: 'SECONDARY',
    preservedStorageKeys: ['runningbom:run-experience:v1'],
  },
  {
    featureId: 'settings-permissions',
    label: '설정 — 알림·권한',
    oldEntry: '설정 한 스크롤',
    legacyRoute: 'settings',
    newPrimary: 'me',
    newRoute: 'settings > 알림·권한',
    visibility: 'SECONDARY',
    preservedStorageKeys: ['runningbom:vnext:permission-ledger:v1'],
  },
  {
    featureId: 'settings-account',
    label: '설정 — 계정·백업',
    oldEntry: '설정 한 스크롤(비활성 provider 목록까지 노출)',
    legacyRoute: 'settings',
    newPrimary: 'me',
    newRoute: 'settings > 계정·백업',
    visibility: 'ADVANCED',
    preservedStorageKeys: ['runningbom:auth:access', 'runningbom:auth:refresh'],
  },
  {
    featureId: 'settings-privacy-data',
    label: '설정 — 개인정보·데이터 (내보내기·삭제)',
    oldEntry: '설정 한 스크롤',
    legacyRoute: 'settings',
    newPrimary: 'me',
    newRoute: 'settings > 개인정보·데이터',
    visibility: 'ADVANCED',
    preservedStorageKeys: [],
  },
  {
    featureId: 'settings-about-help',
    label: '설정 — 앱 정보·도움말',
    oldEntry: '설정 한 스크롤 + 드로어 도움말',
    legacyRoute: 'help',
    newPrimary: 'me',
    newRoute: 'help > 앱 정보·도움말',
    visibility: 'SECONDARY',
    preservedStorageKeys: [],
  },
  {
    featureId: 'diagnostics',
    label: 'versionCode · SHA · 데이터 revision · DB schema',
    oldEntry: '설정 첫 화면에 그대로 노출',
    legacyRoute: 'settings',
    newPrimary: 'me',
    newRoute: 'help > 앱 정보 > 진단 (명시적으로 열어야 함)',
    visibility: 'DEVELOPER_ONLY',
    preservedStorageKeys: [],
  },
  {
    featureId: 'voice-pick',
    label: '목소리 고르기',
    oldEntry: '드로어 + 설정',
    legacyRoute: 'voice',
    newPrimary: 'me',
    newRoute: 'voice (settings > 코치·소리 > 목소리)',
    visibility: 'SECONDARY',
    preservedStorageKeys: ['runningbom:coaching:voice:v1', 'runningbom:coaching:voice-pick:v1'],
  },
];

/** 예전 라우트 16개입니다. 하나라도 매트릭스에 없으면 그 화면은 길을 잃습니다. */
export const legacyRoutes = [
  'home',
  'start',
  'programs',
  'calendar',
  'races',
  'shoes',
  'cadence',
  'challenges',
  'community',
  'guide',
  'stats',
  'badges',
  'profile',
  'settings',
  'voice',
  'help',
] as const;

export type MatrixProblem = {
  code: 'unmapped-route' | 'unreachable' | 'destination-mismatch' | 'duplicate-feature';
  detail: string;
};

/**
 * 매트릭스가 성립하는지 봅니다. **테스트가 이걸 0으로 지킵니다.**
 *
 * 잡는 것:
 *   - 예전 라우트인데 아무 기능도 그리로 매핑되지 않은 것 (길 잃은 화면)
 *   - 새 목적지가 라우트의 실제 소속과 어긋난 것 (탭이 엉뚱하게 켜짐)
 *   - featureId 중복
 */
export function validateMatrix(): MatrixProblem[] {
  const problems: MatrixProblem[] = [];

  const covered = new Set(featureMatrix.map((entry) => entry.legacyRoute));
  for (const route of legacyRoutes) {
    if (!covered.has(route)) {
      problems.push({ code: 'unmapped-route', detail: `${route} 화면으로 가는 길이 없습니다` });
    }
  }

  const seen = new Set<string>();
  for (const entry of featureMatrix) {
    if (seen.has(entry.featureId)) {
      problems.push({ code: 'duplicate-feature', detail: entry.featureId });
    }
    seen.add(entry.featureId);

    const actual = destinationForRoute(entry.legacyRoute);
    if (actual && actual !== entry.newPrimary) {
      // 새 위치가 다른 목적지로 옮겨 간 경우(예: 월간 지도는 home → me)는 정상입니다.
      // 새 라우트가 예전 라우트와 같은데 목적지만 다르면 그건 실수입니다.
      if (entry.newRoute.startsWith(entry.legacyRoute)) {
        problems.push({
          code: 'destination-mismatch',
          detail: `${entry.featureId}: ${entry.legacyRoute}는 ${actual}인데 ${entry.newPrimary}로 적혀 있습니다`,
        });
      }
    }
  }

  return problems;
}

/** 목적지별 기능 수입니다. 한 곳에만 몰려 있으면 정보구조가 잘못된 것입니다. */
export function featureCountByDestination(): Record<PrimaryDestination, number> {
  const counts = { today: 0, training: 0, run: 0, explore: 0, me: 0 };
  for (const entry of featureMatrix) counts[entry.newPrimary] += 1;
  return counts;
}

/** 이 매트릭스가 보존한다고 선언한 저장 키 전부입니다. */
export function preservedStorageKeys(): string[] {
  return [...new Set(featureMatrix.flatMap((entry) => entry.preservedStorageKeys))].sort();
}
