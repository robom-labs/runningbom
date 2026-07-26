// 홈과 외부 링크가 탐색 탭의 정확한 콘텐츠를 열도록 요청 형식을 정의합니다.
export type ExploreSection = '대회' | '러닝화';

export type ExploreRequest = {
  section: ExploreSection;
  raceId?: string;
  shoeId?: string;
  nonce: number;
};
