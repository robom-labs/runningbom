// 하단 탭 5개의 규칙입니다.
//
// 왜 하단 탭을 더하는가:
//   지금은 좌상단 드로어 하나로만 화면을 옮깁니다. 드로어는 "찾을 수 있는" 구조이지
//   "보이는" 구조가 아닙니다. 앱을 처음 켠 사람은 러닝화 화면이 있다는 것조차 모릅니다.
//   자주 가는 다섯 곳은 항상 보여야 합니다. 드로어는 그대로 두고(나머지 화면들이 거기 있습니다)
//   위에 다섯 개를 얹습니다.
//
// 왜 다섯 개인가:
//   엄지로 한 손에 닿는 폭에서 글자가 안 잘리는 한계가 다섯입니다. 여섯부터 줄임말이 생깁니다.
//
// 이 파일은 순수합니다. react-native를 import하지 않습니다(Node 테스트가 돌아야 합니다).

/** 하단 탭이 가리키는 다섯 화면입니다. */
export const tabKeys = ['home', 'races', 'programs', 'shoes', 'stats'] as const;
export type TabKey = (typeof tabKeys)[number];

export type TabDefinition = {
  key: TabKey;
  /** 탭 아래에 쓰는 말입니다. 4글자를 넘기지 않습니다(작은 화면에서 잘립니다). */
  label: string;
  /** 화면 낭독기가 읽는 말입니다. label만으로는 무엇인지 모호할 수 있습니다. */
  accessibilityLabel: string;
  /** Ionicons 이름입니다. 선택되지 않았을 때. */
  icon: string;
  /** 선택되었을 때의 아이콘입니다(채워진 모양). */
  activeIcon: string;
};

export const tabs: TabDefinition[] = [
  {
    key: 'home',
    label: '홈',
    accessibilityLabel: '홈, 오늘 할 것',
    icon: 'home-outline',
    activeIcon: 'home',
  },
  {
    key: 'races',
    label: '대회',
    accessibilityLabel: '대회, 일정과 목표 대회',
    icon: 'trophy-outline',
    activeIcon: 'trophy',
  },
  {
    key: 'programs',
    label: '훈련',
    accessibilityLabel: '훈련, 계획과 오늘 훈련',
    icon: 'barbell-outline',
    activeIcon: 'barbell',
  },
  {
    key: 'shoes',
    label: '러닝화',
    accessibilityLabel: '러닝화, 추천과 가격',
    icon: 'walk-outline',
    activeIcon: 'walk',
  },
  {
    key: 'stats',
    label: '나',
    accessibilityLabel: '나, 기록과 설정',
    icon: 'person-outline',
    activeIcon: 'person',
  },
];

/**
 * 어떤 화면을 보고 있을 때 어느 탭에 불이 들어오는가입니다.
 *
 * 탭이 아닌 화면(배지·설정 등)에서도 "내가 어디쯤 있는지"가 보여야 합니다.
 * 아무 탭에도 불이 안 들어오면 사용자는 앱 밖으로 나온 것처럼 느낍니다.
 */
const tabByRoute: Record<string, TabKey> = {
  home: 'home',
  start: 'home',

  races: 'races',
  calendar: 'races',

  programs: 'programs',
  challenges: 'programs',
  guide: 'programs',
  // 박자 맞추기는 훈련의 한 갈래입니다. 러닝화나 대회가 아닙니다.
  cadence: 'programs',

  shoes: 'shoes',

  stats: 'stats',
  badges: 'stats',
  profile: 'stats',
  settings: 'stats',
  voice: 'stats',
  help: 'stats',
  community: 'stats',
};

/** 이 화면을 보고 있을 때 불이 들어올 탭입니다. 모르는 화면이면 undefined입니다. */
export function tabForRoute(route: string): TabKey | undefined {
  return tabByRoute[route];
}

/**
 * 하단 탭을 감출 화면입니다.
 *
 * 달리는 중에는 탭이 없어야 합니다. 뛰면서 잘못 누르면 코칭이 끊깁니다.
 * 온보딩·로그인처럼 "지금 이것만 하는" 화면도 마찬가지입니다.
 */
const hiddenRoutes = new Set(['start']);

export function tabBarVisible(route: string): boolean {
  return !hiddenRoutes.has(route);
}

/** 탭을 눌렀을 때 실제로 갈 화면입니다. 탭 키가 곧 화면 키입니다. */
export function routeForTab(tab: TabKey): string {
  return tab;
}
