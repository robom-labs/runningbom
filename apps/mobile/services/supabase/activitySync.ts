// 명시적으로 선택한 직접 입력 기록만 현재 Supabase 계정에 중복 없이 동기화합니다.
import {
  listPendingSelfLoggedActivitySync,
  markActivitiesSynced,
  pendingSelfLoggedActivitySyncCount,
} from '../storage/localDatabase';
import { supabase } from './client';

export type ActivitySyncResult = {
  synced: number;
  remaining: number;
};

export async function syncPendingSelfLoggedActivities(): Promise<ActivitySyncResult> {
  if (!supabase) throw new Error('계정 동기화 서버가 연결되지 않았습니다.');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw sessionError ?? new Error('로그인이 필요합니다.');
  }

  const pending = await listPendingSelfLoggedActivitySync(100);
  if (pending.length === 0) return { synced: 0, remaining: 0 };

  const userId = sessionData.session.user.id;
  const syncedAt = new Date().toISOString();
  const rows = pending.map(({ activity }) => ({
    id: activity.id,
    user_id: userId,
    local_uuid: activity.localUuid,
    kind: activity.kind,
    duration_minutes: activity.durationMinutes,
    distance_km: activity.distanceKm ?? null,
    source: 'SELF_LOGGED' as const,
    completed_at: activity.completedAt,
    timezone_id: activity.timezoneId,
    client_created_at: activity.completedAt,
  }));

  const { error } = await supabase
    .from('activities')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false });
  if (error) throw error;

  await markActivitiesSynced(
    pending.map(({ activity }) => activity.id),
    syncedAt,
  );
  return {
    synced: pending.length,
    remaining: await pendingSelfLoggedActivitySyncCount(),
  };
}
