// 드로어 메뉴, 화면 라우팅, 딥링크 요청이 공유하는 타입을 정의합니다.
export type ExploreSection = '대회' | '러닝화';

export type ExploreRequest = {
  section: ExploreSection;
  raceId?: string;
  shoeId?: string;
  nonce: number;
};

export type RouteKey =
  | 'home'
  | 'start'
  | 'programs'
  | 'calendar'
  | 'races'
  | 'shoes'
  | 'cadence'
  | 'challenges'
  | 'community'
  | 'guide'
  | 'stats'
  | 'badges'
  | 'profile'
  | 'settings'
  | 'voice'
  | 'help';

/**
 * 드로어 부모 메뉴 아래에 접었다 펴는 세부 하위 항목입니다.
 * `target`은 실제로 이동할 화면이고, `focus`는 그 화면이 이미 받을 수 있는
 * 초기 구획 값만 담습니다(화면이 받지 못하는 항목은 focus 없이 이동만 합니다).
 */
export type MenuChild = {
  key: string;
  label: string;
  target: RouteKey;
  focus?: string;
};

export type MenuItem = {
  key: RouteKey;
  label: string;
  icon: string;
  hint: string;
  children?: MenuChild[];
};

/** 기록·통계 화면이 하위 메뉴에서 받을 수 있는 구획 값입니다. */
export const statsFocusKeys = ['week', 'badges', 'records'] as const;
export type StatsFocus = (typeof statsFocusKeys)[number];

export function isStatsFocus(value: unknown): value is StatsFocus {
  return typeof value === 'string' && (statsFocusKeys as readonly string[]).includes(value);
}

export type MenuGroup = {
  id: 'main' | 'system';
  title: string;
  items: MenuItem[];
};
