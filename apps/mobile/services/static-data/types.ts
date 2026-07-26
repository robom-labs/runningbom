// 정적 데이터 manifest와 버전별 LKG snapshot의 공통 타입을 정의합니다.
export const STATIC_DATA_FILE_NAMES = [
  'races.json',
  'shoes.json',
  'upcoming-shoes.json',
  'coaching.json',
] as const;

export type StaticDataFileName = (typeof STATIC_DATA_FILE_NAMES)[number];

export type StaticDataManifest = {
  schemaVersion: 1;
  contentVersion: string;
  generatedAt: string;
  minimumAppVersion: string;
  checksums: Record<StaticDataFileName, string>;
  sizes: Record<StaticDataFileName, number>;
  recordCounts: Record<StaticDataFileName, number>;
};

export type StaticDataset<T = unknown> = {
  schemaVersion: 1;
  contentVersion: string;
  generatedAt: string;
  source: unknown;
  records: T[];
};

export type StaticDataPayloadTexts = Record<StaticDataFileName, string>;

export type StaticDataSnapshotSource = 'remote' | 'lkg' | 'bundle';

export type StaticDataSnapshot = {
  source: StaticDataSnapshotSource;
  manifest: StaticDataManifest;
  datasets: Record<StaticDataFileName, StaticDataset>;
  fallbackReason?: string;
};

export type StaticDataTextStorage = {
  readText(path: string): Promise<string | null>;
  replaceAtomically(path: string, text: string): Promise<void>;
};

export type StaticDataTextRequest = (
  url: string,
  signal?: AbortSignal,
) => Promise<string>;

export type StaticDataDigest = (text: string) => Promise<string>;
