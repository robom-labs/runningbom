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
  | 'calendar'
  | 'races'
  | 'shoes'
  | 'community'
  | 'stats'
  | 'profile'
  | 'settings'
  | 'help';

export type MenuItem = {
  key: RouteKey;
  label: string;
  icon: string;
  hint: string;
};

export type MenuGroup = {
  id: 'main' | 'system';
  title: string;
  items: MenuItem[];
};
