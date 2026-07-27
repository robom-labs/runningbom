// 원격 데이터가 완전히 검증된 경우에만 versioned LKG로 전환하고 실패 시 안전하게 복구합니다.
import {
  appSupportsMinimumVersion,
  parseStaticDataManifest,
  verifyStaticDataPayloads,
} from './contracts';
import {
  STATIC_DATA_FILE_NAMES,
  type StaticDataDigest,
  type StaticDataManifest,
  type StaticDataPayloadTexts,
  type StaticDataSnapshot,
  type StaticDataTextRequest,
  type StaticDataTextStorage,
} from './types';

const ACTIVE_MANIFEST_PATH = 'active-manifest.json';
const DEFAULT_STATIC_DATA_BASE_URL = 'https://robom-labs.github.io/runningbom/data/';

function safeVersionPath(contentVersion: string): string {
  if (!/^static-[a-f0-9]{20}$/.test(contentVersion)) {
    throw new Error('unsafe static contentVersion');
  }
  return `versions/${contentVersion}`;
}

/**
 * 빌드 환경값이 바뀌어도 러닝봄이 관리하는 공개 데이터 경로 밖으로 요청하지 않습니다.
 * 테스트·향후 전용 CDN을 위해 static.robom.kr/runningbom 경로도 같은 계약으로 허용합니다.
 */
export function resolveStaticDataBaseUrl(value?: string): string | undefined {
  if (value === undefined) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
      return DEFAULT_STATIC_DATA_BASE_URL;
    }
    const normalizedPath = `${url.pathname.replace(/\/+$/, '')}/`;
    const allowed =
      (url.hostname === 'robom-labs.github.io' && normalizedPath === '/runningbom/data/') ||
      (url.hostname === 'static.robom.kr' && normalizedPath === '/runningbom/');
    return allowed ? `${url.origin}${normalizedPath}` : DEFAULT_STATIC_DATA_BASE_URL;
  } catch {
    return DEFAULT_STATIC_DATA_BASE_URL;
  }
}

async function defaultRequest(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`static data HTTP ${response.status}`);
  return response.text();
}

async function snapshotFromTexts(
  source: StaticDataSnapshot['source'],
  manifest: StaticDataManifest,
  texts: StaticDataPayloadTexts,
  digest: StaticDataDigest,
  fallbackReason?: string,
): Promise<StaticDataSnapshot> {
  return {
    source,
    manifest,
    datasets: await verifyStaticDataPayloads(manifest, texts, digest),
    fallbackReason,
  };
}

async function loadLkg(
  storage: StaticDataTextStorage,
  digest: StaticDataDigest,
  appVersion: string,
): Promise<StaticDataSnapshot | null> {
  try {
    const manifestText = await storage.readText(ACTIVE_MANIFEST_PATH);
    if (!manifestText) return null;
    const manifest = parseStaticDataManifest(JSON.parse(manifestText));
    if (!appSupportsMinimumVersion(appVersion, manifest.minimumAppVersion)) return null;
    const versionPath = safeVersionPath(manifest.contentVersion);
    const pairs = await Promise.all(
      STATIC_DATA_FILE_NAMES.map(async (fileName) => [
        fileName,
        await storage.readText(`${versionPath}/${fileName}`),
      ] as const),
    );
    if (pairs.some(([, text]) => text === null)) return null;
    const texts = Object.fromEntries(pairs) as StaticDataPayloadTexts;
    return snapshotFromTexts('lkg', manifest, texts, digest);
  } catch {
    return null;
  }
}

async function storeVerifiedSnapshot(
  storage: StaticDataTextStorage,
  manifestText: string,
  manifest: StaticDataManifest,
  texts: StaticDataPayloadTexts,
): Promise<void> {
  const versionPath = safeVersionPath(manifest.contentVersion);
  for (const fileName of STATIC_DATA_FILE_NAMES) {
    await storage.replaceAtomically(`${versionPath}/${fileName}`, texts[fileName]);
  }
  await storage.replaceAtomically(`${versionPath}/manifest.json`, manifestText);
  await storage.replaceAtomically(ACTIVE_MANIFEST_PATH, manifestText);
}

export type RefreshStaticDataOptions = {
  appVersion: string;
  baseUrl?: string;
  bundledManifest: StaticDataManifest;
  bundledPayloadTexts: StaticDataPayloadTexts;
  storage: StaticDataTextStorage;
  digest: StaticDataDigest;
  request?: StaticDataTextRequest;
  signal?: AbortSignal;
};

export async function refreshStaticData(
  options: RefreshStaticDataOptions,
): Promise<StaticDataSnapshot> {
  const bundledManifest = parseStaticDataManifest(options.bundledManifest);
  const bundle = await snapshotFromTexts(
    'bundle',
    bundledManifest,
    options.bundledPayloadTexts,
    options.digest,
  );
  const lkg = await loadLkg(options.storage, options.digest, options.appVersion);

  if (!options.baseUrl) {
    return lkg ?? bundle;
  }

  try {
    const resolvedBaseUrl = resolveStaticDataBaseUrl(options.baseUrl);
    if (!resolvedBaseUrl) throw new Error('static data URL unavailable');
    const baseUrl = new URL(resolvedBaseUrl);
    const request = options.request ?? defaultRequest;
    const manifestUrl = new URL('manifest.json', baseUrl);
    const manifestText = await request(manifestUrl.toString(), options.signal);
    const manifest = parseStaticDataManifest(JSON.parse(manifestText));
    if (!appSupportsMinimumVersion(options.appVersion, manifest.minimumAppVersion)) {
      throw new Error('static data requires a newer app version');
    }
    const pairs = await Promise.all(
      STATIC_DATA_FILE_NAMES.map(async (fileName) => [
        fileName,
        await request(new URL(fileName, manifestUrl).toString(), options.signal),
      ] as const),
    );
    const texts = Object.fromEntries(pairs) as StaticDataPayloadTexts;
    const datasets = await verifyStaticDataPayloads(manifest, texts, options.digest);
    await storeVerifiedSnapshot(options.storage, manifestText, manifest, texts);
    return { source: 'remote', manifest, datasets };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ...(lkg ?? bundle),
      fallbackReason: reason,
    };
  }
}
