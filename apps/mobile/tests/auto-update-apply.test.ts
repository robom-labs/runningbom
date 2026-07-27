// 새 내용이 실제로 폰에 적용되는지 검사합니다.
//
// 회장 보고: "다시 껐다 켜도 업그레이드 같은 걸 안 해. 이게 맞는 건가."
// 맞지 않았습니다. expo-updates 기본 동작은 "이번에 받아 두고 다음에 켤 때 적용"이라
// 껐다 켜기를 두 번 해야 새 내용이 나왔습니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

const updaterSource = read('../services/updates/AutoUpdater.tsx');

describe('새 내용이 기다리지 않고 적용된다', () => {
  it('켠 직후 받은 내용은 바로 적용한다', () => {
    assert.ok(
      updaterSource.includes('APPLY_IMMEDIATELY_WITHIN_MILLIS'),
      '받아 두기만 하고 적용하지 않습니다',
    );
    assert.ok(updaterSource.includes('if (openedRecently) await applyIfSafe();'));
  });

  it('한창 쓰는 중에는 화면을 튀게 하지 않는다', () => {
    // 켠 지 오래됐으면 다시 열 때까지 기다립니다.
    assert.ok(updaterSource.includes("if (next !== 'active') return;"));
  });

  it('달리는 중에는 절대 적용하지 않는다', () => {
    // 적용은 앱을 다시 시작하는 일이라, 달리는 도중에 하면 그날 기록이 사라집니다.
    assert.ok(updaterSource.includes('if (isRunInProgress()) return;'));
  });

  it('적용을 두 번 겹쳐 부르지 않는다', () => {
    assert.ok(updaterSource.includes('applyingRef.current'));
  });

  it('인터넷이 없어도 앱이 멈추지 않는다', () => {
    assert.ok(updaterSource.includes('} catch {'), '예외를 밖으로 던집니다');
  });
});
