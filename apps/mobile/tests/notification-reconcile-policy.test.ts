// 자동 알림 재조정이 사용자 동의 없이 시스템 권한 창을 다시 띄우지 않는지 검증합니다.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('접수 알림 권한 정책', () => {
  it('자동 재조정은 권한을 조회만 하고 시스템 권한을 재요청하지 않는다', async () => {
    const source = await readFile(path.join(root, 'src/notifications.ts'), 'utf8');
    assert.match(
      source,
      /scheduleRegistrationNotification\(race, \{ requestPermission: false \}\)/,
    );
    assert.match(source, /if \(!requestPermission\) \{\s*return false;/);
  });

  it('사용자가 직접 누른 예약은 기존처럼 권한 요청을 허용한다', async () => {
    const source = await readFile(path.join(root, 'src/notifications.ts'), 'utf8');
    assert.match(source, /options\.requestPermission \?\? true/);
  });
});
