// 원격 대회 피드가 앱의 공식 링크를 피싱·내부망 주소로 바꾸지 못하는지 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isTrustedRaceOfficialUrl,
  raceFeedFromRecords,
  races,
  resolveRaceFeedUrl,
  safeHttpsUrl,
} from '../src/races';

describe('외부 URL 공통 방어', () => {
  it('공개 HTTPS만 허용하고 로컬·사설망·자격정보 주소는 거부한다', () => {
    assert.equal(safeHttpsUrl('https://example.com/path'), 'https://example.com/path');
    assert.equal(safeHttpsUrl('https://fc.example.com/path'), 'https://fc.example.com/path');
    assert.equal(safeHttpsUrl('http://example.com/path'), undefined);
    assert.equal(safeHttpsUrl('https://localhost/path'), undefined);
    assert.equal(safeHttpsUrl('https://127.0.0.1/path'), undefined);
    assert.equal(safeHttpsUrl('https://192.168.0.1/path'), undefined);
    assert.equal(safeHttpsUrl('https://[fd00::1]/path'), undefined);
    assert.equal(safeHttpsUrl('https://[fe80::1]/path'), undefined);
    assert.equal(safeHttpsUrl('https://user:pass@example.com/path'), undefined);
    assert.equal(safeHttpsUrl('https://example.com/\u0000bad'), undefined);
  });

  it('원격 피드는 로봄 저장소·공식 Pages 경로만 받는다', () => {
    const fallback = resolveRaceFeedUrl();
    assert.ok(fallback.startsWith('https://raw.githubusercontent.com/robom-labs/runningbom/'));
    assert.equal(
      resolveRaceFeedUrl('https://raw.githubusercontent.com/robom-labs/runningbom/main/data.json'),
      'https://raw.githubusercontent.com/robom-labs/runningbom/main/data.json',
    );
    assert.equal(
      resolveRaceFeedUrl('https://robom-labs.github.io/runningbom/races.json'),
      'https://robom-labs.github.io/runningbom/races.json',
    );
    assert.equal(resolveRaceFeedUrl('https://evil.example/races.json'), fallback);
    assert.equal(resolveRaceFeedUrl('http://robom-labs.github.io/runningbom/races.json'), fallback);
  });
});

describe('대회 공식 링크 신뢰', () => {
  const verified = races.find((race) => race.officialUrl);

  it('번들에 검증된 대회 도메인은 유지하고 임의 도메인 교체를 막는다', () => {
    assert.ok(verified?.officialUrl, '검증된 공식 링크가 있는 번들 대회가 필요합니다.');
    assert.equal(isTrustedRaceOfficialUrl(verified.id, verified.officialUrl), true);
    assert.equal(isTrustedRaceOfficialUrl(verified.id, 'https://evil.example/register'), false);
  });

  it('새 대회도 이미 검증된 운영 도메인만 사용할 수 있다', () => {
    assert.ok(verified?.officialUrl);
    assert.equal(isTrustedRaceOfficialUrl('new-race', verified.officialUrl), true);
    assert.equal(isTrustedRaceOfficialUrl('new-race', 'https://evil.example/register'), false);
  });

  it('원격 피드에서 피싱 링크가 든 항목만 제외하고 정상 마지막본은 유지한다', () => {
    assert.ok(verified?.officialUrl);
    const feed = raceFeedFromRecords(
      'security-test',
      [
        verified,
        {
          ...verified,
          id: 'malicious-copy',
          name: '가짜 접수 대회',
          officialUrl: 'https://evil.example/register',
        },
      ],
      Date.parse('2026-01-01T00:00:00.000Z'),
    );
    assert.equal(feed.races.some((race) => race.id === verified.id), true);
    assert.equal(feed.races.some((race) => race.id === 'malicious-copy'), false);
  });
});
