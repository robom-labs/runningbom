// V7 최상위 목적지입니다. **순수합니다.**
//
// 왜 바꾸는가 — 코드로 센 증거:
//   지금 앱에는 전역 내비게이션이 **두 개** 있습니다.
//     - 좌상단 햄버거 → DrawerMenu (상위 13개 + 하위 14개)
//     - 하단 탭 5개
//   같은 목적지가 두 곳에 있고, 어느 쪽이 "진짜 위치"인지 사용자가 알 수 없습니다.
//   설정은 드로어에도 있고 탭(나)에도 있습니다. 러닝화도, 대회도 마찬가지입니다.
//
//   Android·Apple 가이드가 공통으로 말하는 것은 하나입니다 —
//   **최상위 목적지는 한 곳에서만 이동한다.**
//
// 그래서 최상위를 정확히 다섯 개로 못 박고, 드로어는 런타임에서 걷어냅니다.
// 드로어에 있던 화면은 사라지지 않습니다. 각각 **자기 집**이 생깁니다.

/** 하단 탭이 가리키는 다섯 곳입니다. 여기 없는 것은 최상위가 아닙니다. */
export const primaryDestinations = ['today', 'training', 'run', 'explore', 'me'] as const;
export type PrimaryDestination = (typeof primaryDestinations)[number];

export type DestinationDefinition = {
  id: PrimaryDestination;
  /** 탭 아래에 쓰는 말입니다. **한 단어**입니다. 두 단어면 작은 화면에서 줄바꿈됩니다. */
  label: string;
  /** 화면 낭독기가 읽는 말입니다. label만으로는 무엇인지 모호합니다. */
  accessibilityLabel: string;
  icon: string;
  activeIcon: string;
  /** 가운데 강조 여부입니다. 강조해도 **역할은 이동**이지 실행이 아닙니다. */
  emphasized?: boolean;
};

export const destinations: DestinationDefinition[] = [
  {
    id: 'today',
    label: '오늘',
    accessibilityLabel: '오늘, 오늘 할 러닝과 이번 주',
    icon: 'today-outline',
    activeIcon: 'today',
  },
  {
    id: 'training',
    label: '훈련',
    accessibilityLabel: '훈련, 내 계획과 훈련 라이브러리',
    icon: 'barbell-outline',
    activeIcon: 'barbell',
  },
  {
    // 가운데입니다. 시각적으로는 강조하지만 **누르면 준비 화면으로 갑니다.**
    // 탭을 누르자마자 기록이 시작되면, 잘못 눌렀을 때 되돌릴 방법이 없습니다.
    // 탭은 이동이고, 시작은 큰 버튼 하나로만 합니다.
    id: 'run',
    label: '달리기',
    accessibilityLabel: '달리기, 러닝 준비 화면으로 이동',
    icon: 'play-circle-outline',
    activeIcon: 'play-circle',
    emphasized: true,
  },
  {
    id: 'explore',
    label: '찾기',
    accessibilityLabel: '찾기, 대회와 러닝화와 러닝 지식',
    icon: 'search-outline',
    activeIcon: 'search',
  },
  {
    id: 'me',
    label: '나',
    accessibilityLabel: '나, 기록과 성취와 설정',
    icon: 'person-outline',
    activeIcon: 'person',
  },
];

/**
 * 화면이 어느 목적지에 속하는지입니다.
 *
 * **기존 라우트 키를 바꾸지 않습니다.** 딥링크와 알림이 그 값을 씁니다.
 * 바꾸는 것은 "그 화면이 어느 탭 아래에 있는가"뿐입니다.
 */
const destinationByRoute: Record<string, PrimaryDestination> = {
  // 오늘 — 오늘 할 행동과 맥락만
  home: 'today',

  // 훈련 — 계획·훈련·도전·프로젝트·박자
  programs: 'training',
  challenges: 'training',
  cadence: 'training',
  calendar: 'training',

  // 달리기 — 준비·실행·완료
  start: 'run',

  // 찾기 — 대회·러닝화·러닝 지식
  races: 'explore',
  shoes: 'explore',
  guide: 'explore',

  // 나 — 기록·성취·보관함·프로필·설정
  stats: 'me',
  badges: 'me',
  profile: 'me',
  settings: 'me',
  voice: 'me',
  help: 'me',
  community: 'me',
};

export function destinationForRoute(route: string): PrimaryDestination | undefined {
  return destinationByRoute[route];
}

/** 목적지를 눌렀을 때 실제로 여는 화면입니다. */
const routeByDestination: Record<PrimaryDestination, string> = {
  today: 'home',
  training: 'programs',
  run: 'start',
  explore: 'races',
  me: 'stats',
};

export function routeForDestination(destination: PrimaryDestination): string {
  return routeByDestination[destination];
}

/**
 * 최상위 화면인지입니다. **햄버거·뒤로가기 규칙이 여기서 갈립니다.**
 *
 * 최상위: 뒤로가기 없음, 짧은 제목
 * 하위:   왼쪽 뒤로가기, 현재 제목, 부모 탭은 계속 켜져 있음
 */
export function isTopLevelRoute(route: string): boolean {
  return (Object.values(routeByDestination) as string[]).includes(route);
}

/**
 * 하단 탭을 감추는 화면입니다.
 *
 * 달리는 중에는 탭이 없어야 합니다. 뛰면서 잘못 누르면 코칭이 끊깁니다.
 */
const tabHiddenRoutes = new Set(['start']);

export function tabBarVisible(route: string): boolean {
  return !tabHiddenRoutes.has(route);
}

/**
 * 예전 값에서 옮겨 옵니다. **저장된 lastTab을 무효로 만들지 않습니다.**
 *
 * 예전 탭 키(home·races·programs·shoes·stats)와 라우트 키가 섞여 저장돼 있습니다.
 * 둘 다 받아서 새 목적지로 옮깁니다. 모르는 값이면 오늘로 갑니다 —
 * 앱이 빈 화면으로 열리는 것보다 낫습니다.
 */
export function destinationFromLegacy(value: string | undefined): PrimaryDestination {
  if (!value) return 'today';
  const direct = primaryDestinations.find((id) => id === value);
  if (direct) return direct;

  // 예전 탭 키 다섯 개입니다.
  const legacyTabs: Record<string, PrimaryDestination> = {
    home: 'today',
    races: 'explore',
    programs: 'training',
    shoes: 'explore',
    stats: 'me',
  };
  if (legacyTabs[value]) return legacyTabs[value];

  return destinationForRoute(value) ?? 'today';
}
