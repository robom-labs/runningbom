// 원격·LKG·번들 정적 데이터의 schema, SHA-256, 크기와 건수를 검증합니다.
import {
  STATIC_DATA_FILE_NAMES,
  type StaticDataDigest,
  type StaticDataFileName,
  type StaticDataManifest,
  type StaticDataPayloadTexts,
  type StaticDataset,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSemver(value: unknown): value is string {
  return typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);
}

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

export function parseStaticDataManifest(value: unknown): StaticDataManifest {
  if (!isRecord(value)) throw new Error('static manifest must be an object');
  if (value.schemaVersion !== 1) throw new Error('static manifest schema unsupported');
  if (
    typeof value.contentVersion !== 'string' ||
    !/^static-[a-f0-9]{20}$/.test(value.contentVersion)
  ) {
    throw new Error('static manifest contentVersion invalid');
  }
  if (typeof value.generatedAt !== 'string' || !Number.isFinite(Date.parse(value.generatedAt))) {
    throw new Error('static manifest generatedAt invalid');
  }
  if (!isSemver(value.minimumAppVersion)) {
    throw new Error('static manifest minimumAppVersion invalid');
  }
  if (
    !isRecord(value.checksums) ||
    !isRecord(value.sizes) ||
    !isRecord(value.recordCounts)
  ) {
    throw new Error('static manifest maps invalid');
  }

  for (const fileName of STATIC_DATA_FILE_NAMES) {
    if (!/^[a-f0-9]{64}$/.test(String(value.checksums[fileName] ?? ''))) {
      throw new Error(`${fileName} checksum invalid`);
    }
    if (!Number.isInteger(value.sizes[fileName]) || Number(value.sizes[fileName]) < 1) {
      throw new Error(`${fileName} size invalid`);
    }
    if (
      !Number.isInteger(value.recordCounts[fileName]) ||
      Number(value.recordCounts[fileName]) < 0
    ) {
      throw new Error(`${fileName} recordCount invalid`);
    }
  }
  return value as StaticDataManifest;
}

export function parseStaticDataset(value: unknown, fileName: StaticDataFileName): StaticDataset {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new Error(`${fileName} dataset schema unsupported`);
  }
  if (
    typeof value.contentVersion !== 'string' ||
    !value.contentVersion ||
    typeof value.generatedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.generatedAt)) ||
    !Array.isArray(value.records)
  ) {
    throw new Error(`${fileName} dataset metadata invalid`);
  }
  return value as StaticDataset;
}

export async function verifyStaticDataPayloads(
  manifest: StaticDataManifest,
  texts: StaticDataPayloadTexts,
  digest: StaticDataDigest,
): Promise<Record<StaticDataFileName, StaticDataset>> {
  const parsed = {} as Record<StaticDataFileName, StaticDataset>;
  for (const fileName of STATIC_DATA_FILE_NAMES) {
    const text = texts[fileName];
    if (utf8ByteLength(text) !== manifest.sizes[fileName]) {
      throw new Error(`${fileName} byte size mismatch`);
    }
    if ((await digest(text)).toLowerCase() !== manifest.checksums[fileName]) {
      throw new Error(`${fileName} SHA-256 mismatch`);
    }
    const dataset = parseStaticDataset(JSON.parse(text), fileName);
    if (dataset.records.length !== manifest.recordCounts[fileName]) {
      throw new Error(`${fileName} recordCount mismatch`);
    }
    parsed[fileName] = dataset;
  }
  return parsed;
}

export function appSupportsMinimumVersion(appVersion: string, minimumAppVersion: string): boolean {
  if (!isSemver(appVersion) || !isSemver(minimumAppVersion)) return false;
  const current = appVersion.split('.').map(Number);
  const minimum = minimumAppVersion.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (current[index] > minimum[index]) return true;
    if (current[index] < minimum[index]) return false;
  }
  return true;
}
