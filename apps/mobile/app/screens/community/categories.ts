// 서버에 카테고리 필드가 아직 없어, 공개 글을 화면에서만 분류하는 규칙입니다.
import type { PublicPost, ReactionKind } from '../../../domains/social/types';

export const feedCategories = ['전체', '초보질문', '장비', '대회후기', '코스추천', '인증'] as const;
export type FeedCategory = (typeof feedCategories)[number];

const keywords: Record<Exclude<FeedCategory, '전체'>, string[]> = {
  초보질문: ['초보', '처음', '어떻게', '질문', '알려주', '입문'],
  장비: ['러닝화', '신발', '워치', '장비', '양말', '조끼', '깔창'],
  대회후기: ['대회', '마라톤', '완주', '기록회', '후기', '레이스'],
  코스추천: ['코스', '경로', '트랙', '공원', '한강', '추천 코스'],
  인증: ['인증', '완료', '오늘도', '달렸'],
};

export function categoryFor(post: PublicPost): FeedCategory {
  const body = post.body.toLocaleLowerCase('ko-KR');
  for (const category of ['초보질문', '장비', '대회후기', '코스추천'] as const) {
    if (keywords[category].some((word) => body.includes(word))) return category;
  }
  if (post.kind === 'COACH_COMPLETED' || post.kind === 'BADGE_UNLOCKED') return '인증';
  if (keywords['인증'].some((word) => body.includes(word))) return '인증';
  return '전체';
}

export function totalReactions(counts: Partial<Record<ReactionKind, number>>): number {
  return Object.values(counts).reduce((total, value) => total + (value ?? 0), 0);
}

export type FeedSort = '최신순' | '반응순' | '댓글순';
export const feedSorts: FeedSort[] = ['최신순', '반응순', '댓글순'];

export function sortPosts(posts: PublicPost[], sort: FeedSort): PublicPost[] {
  const values = [...posts];
  if (sort === '반응순') {
    return values.sort((left, right) => totalReactions(right.reactionCounts) - totalReactions(left.reactionCounts));
  }
  if (sort === '댓글순') {
    return values.sort((left, right) => right.commentCount - left.commentCount);
  }
  return values.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function filterByCategory(posts: PublicPost[], category: FeedCategory): PublicPost[] {
  if (category === '전체') return posts;
  return posts.filter((post) => categoryFor(post) === category);
}
