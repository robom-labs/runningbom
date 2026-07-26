// Supabase 공개 응답을 앱에 넣기 전에 런타임 스키마로 검증합니다.
import { z } from 'zod';

const reactionCountsSchema = z
  .object({
    CHEER: z.number().int().nonnegative().optional(),
    COOL: z.number().int().nonnegative().optional(),
    TOGETHER: z.number().int().nonnegative().optional(),
    CONSISTENT: z.number().int().nonnegative().optional(),
  })
  .catchall(z.never());

export const publicPostRowSchema = z.object({
  id: z.string().uuid(),
  author_id: z.string().uuid(),
  author_nickname: z.string().trim().min(2).max(16),
  body: z.string().min(1).max(2_000),
  kind: z.enum([
    'GENERAL',
    'COACH_COMPLETED',
    'BADGE_UNLOCKED',
    'RACE_GOAL',
    'CREW_NOTICE',
    'CREW_EVENT',
  ]),
  visibility: z.enum(['PUBLIC', 'CREW', 'NEIGHBORHOOD']),
  created_at: z.string().datetime({ offset: true }),
  edited_at: z.string().datetime({ offset: true }).nullable(),
  reaction_counts: reactionCountsSchema.nullish(),
  comment_count: z.coerce.number().int().nonnegative(),
});

export type PublicPostRow = z.infer<typeof publicPostRowSchema>;

export const uuidSchema = z.string().uuid();
export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const crewCapacitySchema = z.number().int().min(3).max(500);
export const eventCapacitySchema = z.number().int().min(1).max(500);
export const reportReasonSchema = z.string().trim().min(2).max(100);
