// 좌상단 드로어 메뉴의 정보 구조와 마지막 방문 화면 복원 규칙을 정의합니다.
import type { MenuGroup, RouteKey } from './types';

export const routeTitles: Record<RouteKey, string> = {
  home: '홈',
  start: '러닝 시작',
  calendar: '캘린더',
  races: '대회',
  shoes: '러닝화',
  community: '커뮤니티',
  stats: '기록·통계',
  profile: '프로필',
  settings: '설정',
  help: '도움말·문의',
};

export const menuGroups: MenuGroup[] = [
  {
    id: 'main',
    title: '주요',
    items: [
      { key: 'home', label: '홈', icon: 'home-outline', hint: '오늘의 러닝 한 장' },
      { key: 'start', label: '러닝 시작', icon: 'play-circle-outline', hint: '음성 코칭으로 바로 시작' },
      { key: 'calendar', label: '캘린더', icon: 'calendar-outline', hint: '일정 등록과 기록 확인' },
      { key: 'races', label: '대회', icon: 'trophy-outline', hint: '접수 일정과 알림' },
      { key: 'shoes', label: '러닝화', icon: 'walk-outline', hint: '국내 구매 경로 비교' },
      { key: 'community', label: '커뮤니티', icon: 'people-outline', hint: '공개 피드 읽기' },
      { key: 'stats', label: '기록·통계', icon: 'stats-chart-outline', hint: '주간·월간 요약과 배지' },
    ],
  },
  {
    id: 'system',
    title: '그 밖에',
    items: [
      { key: 'settings', label: '설정', icon: 'settings-outline', hint: '음성·알림·연동·계정' },
      { key: 'help', label: '도움말·문의', icon: 'help-circle-outline', hint: '문의와 개인정보 안내' },
    ],
  },
];

export const routeKeys: RouteKey[] = Object.keys(routeTitles) as RouteKey[];

export function isRouteKey(value: unknown): value is RouteKey {
  return typeof value === 'string' && routeKeys.includes(value as RouteKey);
}

// 하단 탭 시절의 마지막 화면 값(한글 탭 이름)도 새 라우트로 복원합니다.
const legacyTabRoutes: Record<string, RouteKey> = {
  홈: 'home',
  탐색: 'races',
  시작: 'start',
  커뮤니티: 'community',
  마이: 'stats',
};

export function routeFromStoredValue(value: string | undefined): RouteKey {
  if (isRouteKey(value)) return value;
  if (value && legacyTabRoutes[value]) return legacyTabRoutes[value] as RouteKey;
  return 'home';
}
