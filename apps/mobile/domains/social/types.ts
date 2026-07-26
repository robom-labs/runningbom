// 러닝봄 공개 피드, 네 가지 응원, 신고와 차단의 최소 데이터 계약을 정의합니다.
export const reactionKinds = ['CHEER', 'COOL', 'TOGETHER', 'CONSISTENT'] as const;
export type ReactionKind = (typeof reactionKinds)[number];

export const reactionLabels: Record<ReactionKind, string> = {
  CHEER: '응원해요',
  COOL: '멋져요',
  TOGETHER: '함께해요',
  CONSISTENT: '꾸준해요',
};

export type PublicPost = {
  id: string;
  authorId: string;
  authorNickname: string;
  body: string;
  kind:
    | 'GENERAL'
    | 'COACH_COMPLETED'
    | 'BADGE_UNLOCKED'
    | 'RACE_GOAL'
    | 'CREW_NOTICE'
    | 'CREW_EVENT';
  visibility: 'PUBLIC' | 'CREW' | 'NEIGHBORHOOD';
  createdAt: string;
  editedAt?: string;
  reactionCounts: Partial<Record<ReactionKind, number>>;
  commentCount: number;
};

export type CrewRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER' | 'PENDING' | 'BANNED';
export type LeagueParticipation = {
  optedIn: boolean;
  competitiveDays: number;
  bonusRuns: number;
  score: number;
};

export function weeklyLeagueScore(
  competitiveDays: number,
  thirtyMinuteRuns: number,
): LeagueParticipation {
  const cappedDays = Math.max(0, Math.min(5, Math.floor(competitiveDays)));
  const bonusRuns = Math.max(0, Math.min(3, Math.floor(thirtyMinuteRuns)));
  return {
    optedIn: false,
    competitiveDays: cappedDays,
    bonusRuns,
    score: cappedDays + bonusRuns,
  };
}
