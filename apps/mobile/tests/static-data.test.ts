// 정적 데이터가 원격 부재·변조·중단 상황에서도 LKG 또는 번들로 안전하게 복구되는지 검증합니다.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  bundledStaticManifest,
  bundledStaticPayloadTexts,
} from '../services/static-data/bundled';
import { refreshStaticData } from '../services/static-data/repository';
import type {
  StaticDataTextStorage,
} from '../services/static-data/types';

class MemoryStorage implements StaticDataTextStorage {
  readonly values = new Map<string, string>();
  readonly writes: string[] = [];

  async readText(path: string): Promise<string | null> {
    return this.values.get(path) ?? null;
  }

  async replaceAtomically(path: string, text: string): Promise<void> {
    this.values.set(path, text);
    this.writes.push(path);
  }
}

async function digest(text: string): Promise<string> {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function remotePayloads() {
  return new Map<string, string>([
    ['https://static.robom.kr/runningbom/manifest.json', `${JSON.stringify(bundledStaticManifest, null, 2)}\n`],
    ...Object.entries(bundledStaticPayloadTexts).map(([fileName, text]) => [
      `https://static.robom.kr/runningbom/${fileName}`,
      text,
    ] as [string, string]),
  ]);
}

describe('정적 데이터 manifest와 LKG', () => {
  it('원격 URL이 없으면 네트워크를 호출하지 않고 번들을 사용한다', async () => {
    let requestCount = 0;
    const snapshot = await refreshStaticData({
      appVersion: '0.19.0',
      bundledManifest: bundledStaticManifest,
      bundledPayloadTexts: bundledStaticPayloadTexts,
      storage: new MemoryStorage(),
      digest,
      request: async () => {
        requestCount += 1;
        throw new Error('호출되면 안 됩니다.');
      },
    });
    assert.equal(requestCount, 0);
    assert.equal(snapshot.source, 'bundle');
    assert.equal(
      snapshot.datasets['races.json'].records.length,
      bundledStaticManifest.recordCounts['races.json'],
    );
  });

  it('설치 번들보다 오래된 원격 데이터로 되돌아가지 않는다', async () => {
    const remote = remotePayloads();
    const olderManifest = {
      ...bundledStaticManifest,
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    remote.set(
      'https://static.robom.kr/runningbom/manifest.json',
      `${JSON.stringify(olderManifest, null, 2)}\n`,
    );
    const storage = new MemoryStorage();
    const snapshot = await refreshStaticData({
      appVersion: '0.19.0',
      baseUrl: 'https://static.robom.kr/runningbom/',
      bundledManifest: bundledStaticManifest,
      bundledPayloadTexts: bundledStaticPayloadTexts,
      storage,
      digest,
      request: async (url) => {
        const value = remote.get(url);
        if (!value) throw new Error(`missing test URL ${url}`);
        return value;
      },
    });
    assert.equal(snapshot.source, 'bundle');
    assert.match(snapshot.fallbackReason ?? '', /older than installed/);
    assert.equal(storage.writes.length, 0);
  });

  it('오래된 LKG보다 새 설치 번들을 우선한다', async () => {
    const storage = new MemoryStorage();
    const olderManifest = {
      ...bundledStaticManifest,
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    const versionPath = `versions/${olderManifest.contentVersion}`;
    storage.values.set('active-manifest.json', `${JSON.stringify(olderManifest, null, 2)}\n`);
    for (const [fileName, text] of Object.entries(bundledStaticPayloadTexts)) {
      storage.values.set(`${versionPath}/${fileName}`, text);
    }
    const snapshot = await refreshStaticData({
      appVersion: '0.19.0',
      bundledManifest: bundledStaticManifest,
      bundledPayloadTexts: bundledStaticPayloadTexts,
      storage,
      digest,
    });
    assert.equal(snapshot.source, 'bundle');
    assert.equal(snapshot.manifest.generatedAt, bundledStaticManifest.generatedAt);
  });

  it('모든 원격 파일 검증 후 active manifest를 마지막에 교체한다', async () => {
    const remote = remotePayloads();
    const storage = new MemoryStorage();
    const snapshot = await refreshStaticData({
      appVersion: '0.19.0',
      baseUrl: 'https://static.robom.kr/runningbom/',
      bundledManifest: bundledStaticManifest,
      bundledPayloadTexts: bundledStaticPayloadTexts,
      storage,
      digest,
      request: async (url) => {
        const value = remote.get(url);
        if (!value) throw new Error(`missing test URL ${url}`);
        return value;
      },
    });
    assert.equal(snapshot.source, 'remote');
    assert.equal(storage.writes.at(-1), 'active-manifest.json');
    assert.equal(storage.writes.length, 6);
  });

  it('변조된 원격 파일은 활성화하지 않고 기존 LKG를 유지한다', async () => {
    const remote = remotePayloads();
    const storage = new MemoryStorage();
    const common = {
      appVersion: '0.19.0',
      baseUrl: 'https://static.robom.kr/runningbom/',
      bundledManifest: bundledStaticManifest,
      bundledPayloadTexts: bundledStaticPayloadTexts,
      storage,
      digest,
    };
    await refreshStaticData({
      ...common,
      request: async (url) => remote.get(url) ?? Promise.reject(new Error('missing URL')),
    });
    const writesBeforeFailure = storage.writes.length;
    remote.set('https://static.robom.kr/runningbom/shoes.json', '{"tampered":true}\n');
    const snapshot = await refreshStaticData({
      ...common,
      request: async (url) => remote.get(url) ?? Promise.reject(new Error('missing URL')),
    });
    assert.equal(snapshot.source, 'lkg');
    assert.match(snapshot.fallbackReason ?? '', /shoes\.json/);
    assert.equal(storage.writes.length, writesBeforeFailure);
  });
});
