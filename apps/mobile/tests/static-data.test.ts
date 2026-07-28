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

/** 번들에 실제로 들어 있는 대회 수입니다. 데이터가 늘어도 테스트가 따라갑니다. */
function bundledRaceCount(): number {
  const races = require('../src/data/races.json') as { races: unknown[] };
  return races.races.length;
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
    // 대회 수는 주기적으로 늘어납니다. 숫자를 박아 두면 데이터가 갱신될 때마다
    // 아무 잘못이 없는데 테스트가 깨집니다. 실제로 183에서 192가 되면서 깨졌습니다.
    // 여기서 확인해야 하는 것은 개수가 아니라 **번들을 읽었다는 사실**입니다.
    assert.equal(
      snapshot.datasets['races.json'].records.length,
      bundledRaceCount(),
      '번들 대회 수와 다릅니다',
    );
    assert.ok(snapshot.datasets['races.json'].records.length > 100);
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
