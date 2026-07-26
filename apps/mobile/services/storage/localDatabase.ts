// 러닝봄의 활동, 일일 진행, 배지, 동기화 큐를 기기 SQLite에 안전하게 저장합니다.
import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import type { ActivityRecord } from '../../domains/activities/types';

const DATABASE_NAME = 'runningbom-vnext.db';
export const DB_SCHEMA_VERSION = 1;

let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

async function database(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  const db = await databasePromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY NOT NULL,
      local_uuid TEXT NOT NULL,
      kind TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      distance_km REAL,
      source TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      timezone_id TEXT NOT NULL,
      synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS activities_completed_at_idx ON activities(completed_at);
    CREATE TABLE IF NOT EXISTS daily_activities (
      day_key TEXT PRIMARY KEY NOT NULL,
      movement_completed INTEGER NOT NULL DEFAULT 0,
      run_completed INTEGER NOT NULL DEFAULT 0,
      algorithm_version TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS badge_progress (
      badge_id TEXT PRIMARY KEY NOT NULL,
      progress REAL NOT NULL DEFAULT 0,
      unlocked_at TEXT,
      rule_version TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0
    );
    INSERT OR REPLACE INTO schema_meta(key, value) VALUES ('version', '${DB_SCHEMA_VERSION}');
  `);
  return db;
}

export async function initializeLocalDatabase(): Promise<void> {
  await database();
}

export async function createLocalUuid(): Promise<string> {
  return Crypto.randomUUID();
}

export async function insertActivity(activity: ActivityRecord): Promise<void> {
  const db = await database();
  await db.runAsync(
    `INSERT OR REPLACE INTO activities
      (id, local_uuid, kind, duration_minutes, distance_km, source, completed_at, timezone_id, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    activity.id,
    activity.localUuid,
    activity.kind,
    activity.durationMinutes,
    activity.distanceKm ?? null,
    activity.source,
    activity.completedAt,
    activity.timezoneId,
    activity.syncedAt ?? null,
  );
}

type ActivityRow = {
  id: string;
  local_uuid: string;
  kind: ActivityRecord['kind'];
  duration_minutes: number;
  distance_km: number | null;
  source: ActivityRecord['source'];
  completed_at: string;
  timezone_id: string;
  synced_at: string | null;
};

type SyncQueueRow = {
  id: string;
  entity_id: string;
  payload_json: string;
  attempts: number;
};

export type PendingActivitySync = {
  queueId: string;
  activity: ActivityRecord;
  attempts: number;
};

function isActivityRecord(value: unknown): value is ActivityRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<ActivityRecord>;
  return (
    typeof record.id === 'string' &&
    typeof record.localUuid === 'string' &&
    (record.kind === 'run' || record.kind === 'walk' || record.kind === 'recovery') &&
    Number.isInteger(record.durationMinutes) &&
    Number(record.durationMinutes) >= 1 &&
    Number(record.durationMinutes) <= 1_440 &&
    (record.distanceKm === undefined ||
      (Number.isFinite(record.distanceKm) &&
        Number(record.distanceKm) > 0 &&
        Number(record.distanceKm) <= 500)) &&
    (record.source === 'COACH_COMPLETED' ||
      record.source === 'HEALTH_LINKED' ||
      record.source === 'SELF_LOGGED' ||
      record.source === 'CREW_ATTENDANCE') &&
    typeof record.completedAt === 'string' &&
    !Number.isNaN(Date.parse(record.completedAt)) &&
    typeof record.timezoneId === 'string'
  );
}

export async function listActivities(): Promise<ActivityRecord[]> {
  const db = await database();
  const rows = await db.getAllAsync<ActivityRow>(
    'SELECT * FROM activities ORDER BY completed_at DESC',
  );
  return rows.map((row) => ({
    id: row.id,
    localUuid: row.local_uuid,
    kind: row.kind,
    durationMinutes: row.duration_minutes,
    ...(row.distance_km === null ? {} : { distanceKm: row.distance_km }),
    source: row.source,
    completedAt: row.completed_at,
    timezoneId: row.timezone_id,
    ...(row.synced_at === null ? {} : { syncedAt: row.synced_at }),
  }));
}

export async function queueActivityForSync(activity: ActivityRecord): Promise<void> {
  const db = await database();
  await db.runAsync(
    `INSERT OR IGNORE INTO sync_queue
      (id, entity_type, entity_id, payload_json, created_at)
      VALUES (?, 'activity', ?, ?, ?)`,
    `activity:${activity.id}`,
    activity.id,
    JSON.stringify(activity),
    new Date().toISOString(),
  );
}

export async function listPendingSelfLoggedActivitySync(
  limit = 100,
): Promise<PendingActivitySync[]> {
  const db = await database();
  const rows = await db.getAllAsync<SyncQueueRow>(
    `SELECT id, entity_id, payload_json, attempts
       FROM sync_queue
      WHERE entity_type = 'activity'
      ORDER BY created_at ASC
      LIMIT ?`,
    Math.max(1, Math.min(limit, 500)),
  );

  const pending: PendingActivitySync[] = [];
  const invalidQueueIds: string[] = [];
  for (const row of rows) {
    try {
      const activity: unknown = JSON.parse(row.payload_json);
      if (
        !isActivityRecord(activity) ||
        activity.id !== row.entity_id ||
        activity.source !== 'SELF_LOGGED'
      ) {
        invalidQueueIds.push(row.id);
        continue;
      }
      pending.push({ queueId: row.id, activity, attempts: row.attempts });
    } catch {
      invalidQueueIds.push(row.id);
    }
  }

  if (invalidQueueIds.length > 0) {
    await db.withTransactionAsync(async () => {
      for (const queueId of invalidQueueIds) {
        await db.runAsync('DELETE FROM sync_queue WHERE id = ?', queueId);
      }
    });
  }
  return pending;
}

export async function pendingSelfLoggedActivitySyncCount(): Promise<number> {
  return (await listPendingSelfLoggedActivitySync(500)).length;
}

export async function markActivitiesSynced(
  activityIds: string[],
  syncedAt = new Date().toISOString(),
): Promise<void> {
  if (activityIds.length === 0) return;
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const activityId of activityIds) {
      await db.runAsync(
        'UPDATE activities SET synced_at = ? WHERE id = ?',
        syncedAt,
        activityId,
      );
      await db.runAsync(
        "DELETE FROM sync_queue WHERE entity_type = 'activity' AND entity_id = ?",
        activityId,
      );
    }
  });
}

export async function exportLocalData(): Promise<{
  schemaVersion: number;
  exportedAt: string;
  activities: ActivityRecord[];
}> {
  return {
    schemaVersion: DB_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    activities: await listActivities(),
  };
}

export async function clearLocalActivityData(): Promise<void> {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM sync_queue;
      DELETE FROM badge_progress;
      DELETE FROM daily_activities;
      DELETE FROM activities;
    `);
  });
}
