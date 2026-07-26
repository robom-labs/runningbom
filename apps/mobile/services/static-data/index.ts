// 번들 fallback과 Expo 저장소를 연결한 정적 데이터 로드 진입점을 제공합니다.
import { bundledStaticManifest, bundledStaticPayloadTexts } from './bundled';
import { ExpoStaticDataStorage } from './expoStorage';
import { sha256Utf8 } from './hash';
import { refreshStaticData } from './repository';

export async function loadRunningbomStaticData(options: {
  appVersion: string;
  baseUrl?: string;
  signal?: AbortSignal;
}) {
  return refreshStaticData({
    ...options,
    bundledManifest: bundledStaticManifest,
    bundledPayloadTexts: bundledStaticPayloadTexts,
    storage: new ExpoStaticDataStorage(),
    digest: sha256Utf8,
  });
}

export * from './types';
