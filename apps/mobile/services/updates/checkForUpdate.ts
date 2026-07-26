// 러닝봄 Preview 설치본이 최신 APK를 놓치지 않도록 정적 버전 매니페스트를 안전하게 조회합니다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/** GitHub Pages로 서빙되는 Preview 버전 매니페스트 주소입니다. */
export const PREVIEW_MANIFEST_URL =
  'https://robom-labs.github.io/runningbom/preview/version.json';

/** 매니페스트가 없거나 손상됐을 때 사용자에게 안내할 기본 다운로드 주소입니다. */
export const PREVIEW_RELEASE_PAGE_URL =
  'https://github.com/robom-labs/runningbom/releases/tag/preview-latest';

const LAST_CHECKED_KEY = 'runningbom:preview:update-last-checked:v1';
const DISMISSED_KEY = 'runningbom:preview:update-dismissed:v1';
// Preview는 고칠 때마다 바로 확인하는 빌드라 하루 한 번은 너무 깁니다. 3시간마다 확인합니다.
const CHECK_INTERVAL_MS = 3 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 6000;

export type PreviewReleaseManifest = {
  latestVersion: string;
  versionCode: number;
  apkUrl: string;
  releasedAt?: string;
  notes: string[];
};

export type UpdateCheckStatus =
  | 'update-available'
  | 'up-to-date'
  | 'skipped'
  | 'not-preview'
  | 'unavailable';

export type UpdateCheckResult = {
  status: UpdateCheckStatus;
  manifest?: PreviewReleaseManifest;
  installedVersion: string;
  installedVersionCode: number | null;
};

export type CheckForUpdateOptions = {
  /** 확인 주기 제한을 무시하고 즉시 확인합니다(설정 화면의 "지금 확인" 용도). */
  force?: boolean;
  /** 테스트·통합에서 매니페스트 주소를 바꿀 때 사용합니다. */
  manifestUrl?: string;
  /** 테스트에서 fetch를 주입할 때 사용합니다. */
  fetchImpl?: typeof fetch;
};

type ExpoPreviewExtra = {
  preview?: { enabled?: boolean; label?: string };
  releaseChannel?: string;
};

function previewExtra(): ExpoPreviewExtra {
  return (Constants.expoConfig?.extra ?? {}) as ExpoPreviewExtra;
}

/** 현재 실행 중인 빌드가 Preview 변형인지 판단합니다. 정식 앱에서는 항상 false입니다. */
export function isPreviewBuild(): boolean {
  const extra = previewExtra();
  return extra.preview?.enabled === true || extra.releaseChannel === 'preview';
}

/** app.json의 versionName(예: 0.19.0)입니다. */
export function installedVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/** Preview 분기가 적용된 Android versionCode입니다. 업데이트 판정의 기준값입니다. */
export function installedVersionCode(): number | null {
  const raw = Constants.expoConfig?.android?.versionCode;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function parseManifest(value: unknown): PreviewReleaseManifest | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const latestVersion = record.latestVersion;
  const versionCode = record.versionCode;
  const apkUrl = record.apkUrl;

  if (typeof latestVersion !== 'string' || latestVersion.length === 0) return null;
  if (typeof versionCode !== 'number' || !Number.isInteger(versionCode) || versionCode <= 0) {
    return null;
  }
  // 임의 주소로 유도되지 않도록 공식 릴리스 호스트만 허용합니다.
  if (typeof apkUrl !== 'string' || !apkUrl.startsWith('https://github.com/robom-labs/runningbom/')) {
    return null;
  }

  const notes = Array.isArray(record.notes)
    ? record.notes.filter((note): note is string => typeof note === 'string')
    : [];

  return {
    latestVersion,
    versionCode,
    apkUrl,
    releasedAt: typeof record.releasedAt === 'string' ? record.releasedAt : undefined,
    notes,
  };
}

async function shouldCheckNow(force: boolean): Promise<boolean> {
  if (force) return true;
  try {
    const raw = await AsyncStorage.getItem(LAST_CHECKED_KEY);
    const last = Number.parseInt(raw ?? '', 10);
    if (!Number.isFinite(last)) return true;
    return Date.now() - last >= CHECK_INTERVAL_MS;
  } catch {
    return true;
  }
}

async function rememberCheckedAt(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_CHECKED_KEY, String(Date.now()));
  } catch {
    // 저장 실패는 무시합니다. 다음 실행에서 다시 확인하면 됩니다.
  }
}

/** 사용자가 특정 versionCode 배너를 닫았는지 기록합니다. */
export async function dismissUpdate(versionCode: number): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, String(versionCode));
  } catch {
    // 무시합니다.
  }
}

/** 이미 닫은 versionCode인지 확인합니다. */
export async function isDismissed(versionCode: number): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_KEY);
    return Number.parseInt(raw ?? '', 10) === versionCode;
  } catch {
    return false;
  }
}

/**
 * Preview 최신 버전을 확인합니다.
 * 네트워크 실패·오프라인·손상된 응답에서는 절대 예외를 던지지 않고 unavailable을 돌려줍니다.
 */
export async function checkForUpdate(
  options: CheckForUpdateOptions = {},
): Promise<UpdateCheckResult> {
  const currentVersion = installedVersion();
  const currentCode = installedVersionCode();
  const base: UpdateCheckResult = {
    status: 'unavailable',
    installedVersion: currentVersion,
    installedVersionCode: currentCode,
  };

  if (!isPreviewBuild()) {
    return { ...base, status: 'not-preview' };
  }
  if (!(await shouldCheckNow(options.force === true))) {
    return { ...base, status: 'skipped' };
  }

  const request = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await request(options.manifestUrl ?? PREVIEW_MANIFEST_URL, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return base;

    const manifest = parseManifest(await response.json());
    if (!manifest) return base;

    await rememberCheckedAt();

    const newer =
      currentCode === null
        ? manifest.latestVersion !== currentVersion
        : manifest.versionCode > currentCode;

    return {
      ...base,
      status: newer ? 'update-available' : 'up-to-date',
      manifest,
    };
  } catch {
    // 오프라인·타임아웃·JSON 파싱 실패 모두 조용히 무시합니다.
    return base;
  } finally {
    clearTimeout(timer);
  }
}
