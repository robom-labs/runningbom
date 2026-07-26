// 러닝봄의 활동, 일일 진행, 배지, 동기화 큐를 기기 SQLite에 안전하게 저장합니다.
import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import {
  sanitizeRoutePoints,
  sanitizeSplits,
  type ActivityRecord,
  type ActivityRoutePoint,
  type ActivitySplit,
} from '../../domains/activities/types';

const DATABASE_NAME = 'runningbom-vnext.db';
/** v1 = 최초 스키마, v2 = activities에 구간(splits)·경로(route_points) 선택 열 추가 */
export const DB_SCHEMA_VERSION = 2;

let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;
let activityColumnsEnsured = false;

/**
 * v1에서 만들어진 기존 activities 표에 새 열만 덧붙입니다.
 * 기존 행·열은 그대로 두고 새 열만 NULL로 추가되므로 기존 기록은 유실되지 않습니다.
 */
const ACTIVITY_COLUMN_MIGRATIONS: ReadonlyArray<{ column: string; ddl: string }> = [
  { column: 'splits_json', ddl: 'ALTER TABLE activities ADD COLUMN splits_json TEXT' },
  { column: 'route_points_json', ddl: 'ALTER TABLE activities ADD COLUMN route_points_json TEXT' },
];

async function ensureActivityColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  if (activityColumnsEnsured) return;
  try {
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(activities)');
    const existing = new Set(columns.map((column) => column.name));
    for (const migration of ACTIVITY_COLUMN_MIGRATIONS) {
      if (existing.has(migration.column)) continue;
      try {
        await db.execAsync(migration.ddl);
      } catch {
        // 다른 인스턴스가 먼저 추가했을 수 있습니다. 실패해도 기존 기능은 그대로 동작합니다.
      }
    }
    activityColumnsEnsured = true;
  } catch {
    // 마이그레이션이 실패해도 앱이 멈추면 안 되므로, 새 필드만 없는 채로 계속 동작합니다.
  }
}

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
      synced_at TEXT,
      splits_json TEXT,
      route_points_json TEXT
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
  // 위 CREATE TABLE은 새로 설치한 기기에만 적용되므로, 기존 기기는 여기서 열만 덧붙입니다.
  await ensureActivityColumns(db);
  return db;
}

export async function initializeLocalDatabase(): Promise<void> {
  await database();
}

export async function createLocalUuid(): Promise<string> {
  return Crypto.randomUUID();
}

/** JSON 열은 값이 있을 때만 문자열로 씁니다. 없으면 NULL이라 기존 행과 똑같이 보입니다. */
function toJsonColumn(value: unknown[] | undefined): string | null {
  if (!value || value.length === 0) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function fromJsonColumn(raw: string | null | undefined): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    // 손상된 JSON은 조용히 버립니다. 활동 기록 자체는 절대 잃지 않습니다.
    return undefined;
  }
}

export async function insertActivity(activity: ActivityRecord): Promise<void> {
  const db = await database();
  await db.runAsync(
    `INSERT OR REPLACE INTO activities
      (id, local_uuid, kind, duration_minutes, distance_km, source, completed_at, timezone_id, synced_at, splits_json, route_points_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    activity.id,
    activity.localUuid,
    activity.kind,
    activity.durationMinutes,
    activity.distanceKm ?? null,
    activity.source,
    activity.completedAt,
    activity.timezoneId,
    activity.syncedAt ?? null,
    toJsonColumn(activity.splits),
    toJsonColumn(activity.routePoints),
  );
}

/**
 * 이미 저장된 활동에 GPS 구간·경로만 덧붙입니다.
 * 활동 저장(=사용자 기록) 이후에 실행되며, 실패해도 기록 자체에는 영향을 주지 않습니다.
 */
export async function attachActivityTrack(
  activityId: string,
  track: { splits?: ActivitySplit[]; routePoints?: ActivityRoutePoint[] },
): Promise<boolean> {
  const splitsJson = toJsonColumn(track.splits);
  const routeJson = toJsonColumn(track.routePoints);
  if (splitsJson === null && routeJson === null) return false;

  try {
    const db = await database();
    // COALESCE로 한쪽만 있어도 다른 쪽 값을 지우지 않습니다.
    const result = await db.runAsync(
      `UPDATE activities
          SET splits_json = COALESCE(?, splits_json),
              route_points_json = COALESCE(?, route_points_json)
        WHERE id = ?`,
      splitsJson,
      routeJson,
      activityId,
    );
    return result.changes > 0;
  } catch {
    return false;
  }
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
  /** v1 기기에서 올라온 행에는 없을 수 있어 옵셔널입니다. */
  splits_json?: string | null;
  route_points_json?: string | null;
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
  return rows.map((row) => {
    const splits = sanitizeSplits(fromJsonColumn(row.splits_json));
    const routePoints = sanitizeRoutePoints(fromJsonColumn(row.route_points_json));
    return {
      id: row.id,
      localUuid: row.local_uuid,
      kind: row.kind,
      durationMinutes: row.duration_minutes,
      ...(row.distance_km === null ? {} : { distanceKm: row.distance_km }),
      source: row.source,
      completedAt: row.completed_at,
      timezoneId: row.timezone_id,
      ...(row.synced_at === null ? {} : { syncedAt: row.synced_at }),
      // 예전 기록에는 아예 없는 선택 필드입니다. 값이 없으면 키 자체를 넣지 않습니다.
      ...(splits === undefined ? {} : { splits }),
      ...(routePoints === undefined ? {} : { routePoints }),
    };
  });
}

export async function queueActivityForSync(activity: ActivityRecord): Promise<void> {
  const db = await database();
  // 구간·경로는 기기에만 두고 동기화 payload는 기존 계약 그대로 유지합니다(서버 스키마 변경 없음).
  const { splits: _splits, routePoints: _routePoints, ...payload } = activity;
  await db.runAsync(
    `INSERT OR IGNORE INTO sync_queue
      (id, entity_type, entity_id, payload_json, created_at)
      VALUES (?, 'activity', ?, ?, ?)`,
    `activity:${activity.id}`,
    activity.id,
    JSON.stringify(payload),
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
