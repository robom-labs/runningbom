// 공개 읽기는 허용하되 외부 연결이 없으면 안전한 CORE_ONLY 결과를 반환합니다.
import type { PublicPost } from '../../domains/social/types';
import type { ReactionKind } from '../../domains/social/types';
import { featureFlags } from '../feature-flags/flags';
import { communityMode, supabase } from './client';
import {
  crewCapacitySchema,
  eventCapacitySchema,
  isoDateTimeSchema,
  publicPostRowSchema,
  reportReasonSchema,
  uuidSchema,
} from './contracts';

type FeedResult = {
  mode: ReturnType<typeof communityMode>;
  posts: PublicPost[];
  rejectedRows: number;
  error?: string;
};

export async function loadPublicFeed(limit = 20): Promise<FeedResult> {
  const mode = communityMode();
  if (!featureFlags.social || !supabase) {
    return { mode: 'CORE_ONLY', posts: [], rejectedRows: 0 };
  }

  const { data, error } = await supabase
    .from('public_posts')
    .select(
      'id,author_id,author_nickname,body,kind,visibility,created_at,edited_at,reaction_counts,comment_count',
    )
    .eq('visibility', 'PUBLIC')
    .order('created_at', { ascending: false })
    .limit(Math.min(50, Math.max(1, limit)));

  if (error) {
    return {
      mode: 'CORE_ONLY',
      posts: [],
      rejectedRows: 0,
      error: '공개 피드를 불러오지 못했어요.',
    };
  }

  const rows = (data ?? []).map((row) => publicPostRowSchema.safeParse(row));
  const validRows = rows.flatMap((result) => (result.success ? [result.data] : []));
  const rejectedRows = rows.length - validRows.length;
  return {
    mode,
    rejectedRows,
    posts: validRows.map((row) => ({
      id: row.id,
      authorId: row.author_id,
      authorNickname: row.author_nickname,
      body: row.body,
      kind: row.kind,
      visibility: row.visibility,
      createdAt: row.created_at,
      ...(row.edited_at ? { editedAt: String(row.edited_at) } : {}),
      reactionCounts: row.reaction_counts ?? {},
      commentCount: row.comment_count,
    })),
    ...(rejectedRows > 0
      ? { error: `형식이 잘못된 공개 글 ${rejectedRows}건을 안전하게 제외했어요.` }
      : {}),
  };
}

async function requireUserId(): Promise<string> {
  if (!supabase) throw new Error('커뮤니티 서버가 연결되지 않았습니다.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error('로그인이 필요합니다.');
  return data.user.id;
}

function assertWriteAllowed(): void {
  if (!featureFlags.social || communityMode() !== 'NORMAL') {
    throw new Error('현재 커뮤니티는 읽기 전용입니다.');
  }
}

export async function createPublicPost(
  body: string,
  kind: PublicPost['kind'] = 'GENERAL',
): Promise<string> {
  assertWriteAllowed();
  const authorId = await requireUserId();
  const normalized = body.trim();
  if (normalized.length < 1 || normalized.length > 2_000) {
    throw new Error('글은 1자부터 2,000자까지 작성할 수 있습니다.');
  }
  const { data, error } = await supabase!
    .from('posts')
    .insert({ author_id: authorId, body: normalized, kind, visibility: 'PUBLIC' })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('글을 저장하지 못했습니다.');
  return String(data.id);
}

export async function setReaction(postId: string, kind: ReactionKind | null): Promise<void> {
  assertWriteAllowed();
  uuidSchema.parse(postId);
  const userId = await requireUserId();
  if (kind === null) {
    const { error } = await supabase!
      .from('reactions')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase!
    .from('reactions')
    .upsert(
      { post_id: postId, user_id: userId, kind, updated_at: new Date().toISOString() },
      { onConflict: 'post_id,user_id' },
    );
  if (error) throw error;
}

export async function reportTarget(
  targetType: 'POST' | 'COMMENT' | 'PROFILE' | 'CREW',
  targetId: string,
  reason: string,
): Promise<void> {
  assertWriteAllowed();
  await requireUserId();
  uuidSchema.parse(targetId);
  const normalized = reportReasonSchema.parse(reason);
  const { error } = await supabase!.rpc('submit_report', {
    next_target_type: targetType,
    next_target_id: targetId,
    next_reason: normalized,
    next_details: '',
  });
  if (error) throw error;
}

export async function blockUser(blockedId: string): Promise<void> {
  assertWriteAllowed();
  uuidSchema.parse(blockedId);
  const blockerId = await requireUserId();
  if (blockedId === blockerId) throw new Error('자기 자신은 차단할 수 없습니다.');
  const { error } = await supabase!
    .from('blocks')
    .upsert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
}

export async function requestAccountDeletion(): Promise<void> {
  await requireUserId();
  const { error } = await supabase!.rpc('request_account_deletion');
  if (error) throw error;
}

export async function createCrew(input: {
  name: string;
  description: string;
  visibility: 'PUBLIC' | 'APPROVAL' | 'PRIVATE';
  capacity: number;
}): Promise<string> {
  assertWriteAllowed();
  await requireUserId();
  crewCapacitySchema.parse(input.capacity);
  const { data, error } = await supabase!.rpc('create_crew', {
    crew_name: input.name.trim(),
    crew_description: input.description.trim(),
    crew_visibility: input.visibility,
    crew_capacity: input.capacity,
  });
  if (error || !data) throw error ?? new Error('크루를 만들지 못했습니다.');
  return String(data);
}

export async function requestCrewMembership(crewId: string): Promise<void> {
  assertWriteAllowed();
  uuidSchema.parse(crewId);
  const userId = await requireUserId();
  const { error } = await supabase!
    .from('crew_members')
    .insert({ crew_id: crewId, user_id: userId, role: 'PENDING' });
  if (error) throw error;
}

export async function manageCrewMembership(
  crewId: string,
  userId: string,
  role: 'ADMIN' | 'MODERATOR' | 'MEMBER' | 'PENDING' | 'BANNED',
): Promise<void> {
  assertWriteAllowed();
  await requireUserId();
  uuidSchema.parse(crewId);
  uuidSchema.parse(userId);
  const { error } = await supabase!.rpc('manage_crew_membership', {
    target_crew_id: crewId,
    target_user_id: userId,
    next_role: role,
  });
  if (error) throw error;
}

export async function createCrewEvent(input: {
  crewId: string;
  title: string;
  startsAt: string;
  capacity?: number;
  publicPlace?: string;
  memberPlace?: string;
}): Promise<string> {
  assertWriteAllowed();
  uuidSchema.parse(input.crewId);
  isoDateTimeSchema.parse(input.startsAt);
  if (input.capacity !== undefined) eventCapacitySchema.parse(input.capacity);
  const userId = await requireUserId();
  const title = input.title.trim();
  if (title.length < 2 || title.length > 80) {
    throw new Error('일정 제목은 2자부터 80자까지 입력해 주세요.');
  }
  const { data, error } = await supabase!
    .from('crew_events')
    .insert({
      crew_id: input.crewId,
      created_by: userId,
      title,
      starts_at: input.startsAt,
      capacity: input.capacity ?? null,
      place_public: input.publicPlace?.trim() || null,
      place_members: input.memberPlace?.trim() || null,
    })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('크루 일정을 만들지 못했습니다.');
  return String(data.id);
}

export async function updateCrewEvent(input: {
  eventId: string;
  title: string;
  startsAt: string;
  capacity?: number;
  publicPlace?: string;
  memberPlace?: string;
  status: 'ACTIVE' | 'CANCELLED' | 'COMPLETED';
}): Promise<void> {
  assertWriteAllowed();
  await requireUserId();
  uuidSchema.parse(input.eventId);
  isoDateTimeSchema.parse(input.startsAt);
  if (input.capacity !== undefined) eventCapacitySchema.parse(input.capacity);
  const { error } = await supabase!.rpc('update_crew_event', {
    target_event_id: input.eventId,
    next_title: input.title.trim(),
    next_starts_at: input.startsAt,
    next_capacity: input.capacity ?? null,
    next_place_public: input.publicPlace?.trim() || null,
    next_place_members: input.memberPlace?.trim() || null,
    next_status: input.status,
  });
  if (error) throw error;
}

export async function setCrewAttendance(
  eventId: string,
  status: 'ATTENDING' | 'MAYBE' | 'DECLINED' | 'WAITLIST',
): Promise<void> {
  assertWriteAllowed();
  uuidSchema.parse(eventId);
  const userId = await requireUserId();
  const { error } = await supabase!
    .from('crew_event_attendance')
    .upsert({ event_id: eventId, user_id: userId, status, updated_at: new Date().toISOString() });
  if (error) throw error;
}
