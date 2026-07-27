// 지금 폰에 무엇이 깔려 있는지 볼 수 있는지 검사합니다.
//
// 이 화면이 없던 동안, "고쳤습니다"와 "안 되는데요" 사이에서 무엇이 문제인지
// 아무도 알 수 없었습니다. 고친 내용이 폰에 도달하지 않은 것인지,
// 도달했는데 틀린 것인지 구분할 방법이 없었기 때문입니다. 그 상태로 세 번을 헤맸습니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { contentLabel, updateOutcomeLabels } from '../domains/updates/contentLabel';

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

const cardSource = read('../app/screens/settings/AppContentCard.tsx');
const settingsSource = read('../app/screens/settings/SettingsScreen.tsx');
const runnerSource = read('../app/screens/programs/SessionRunner.tsx');
const configSource = read('../app.config.js');

describe('지금 앱 내용을 말로 알려 준다', () => {
  it('처음 설치본과 새로 받은 내용을 구분한다', () => {
    assert.equal(contentLabel(true, true, undefined), '처음 설치한 내용 그대로예요.');
    const at = new Date(2026, 6, 27, 22, 33);
    assert.equal(contentLabel(true, false, at), '7월 27일 22:33에 올린 내용이에요.');
  });

  it('자동 업데이트가 꺼진 빌드도 그렇다고 말한다', () => {
    // 정식 앱은 Play 심사 대상이라 원격 업데이트를 켜지 않습니다.
    assert.ok(contentLabel(false, false, new Date()).includes('쓰지 않아요'));
  });

  it('시각이 깨져 있어도 화면이 무너지지 않는다', () => {
    assert.equal(contentLabel(true, false, new Date('깨진값')), '처음 설치한 내용 그대로예요.');
  });

  it('확인 결과를 전부 쉬운 말로 준비해 둔다', () => {
    for (const key of ['disabled', 'upToDate', 'downloaded', 'failed'] as const) {
      assert.ok(updateOutcomeLabels[key].length > 0, `${key} 안내가 없습니다`);
      // 화면에 영어 오류 문구를 그대로 내보내지 않습니다.
      assert.ok(!/[A-Za-z]{4,}/.test(updateOutcomeLabels[key]), `${key}에 영어가 있습니다`);
    }
  });
});

describe('사용자가 직접 확인할 수 있다', () => {
  it('설정에 앱 내용 카드가 있다', () => {
    assert.ok(settingsSource.includes('<AppContentCard />'), '설정에서 볼 수 없습니다');
  });

  it('지금 바로 확인하는 단추가 있다', () => {
    assert.ok(cardSource.includes('지금 업데이트 확인'));
    assert.ok(cardSource.includes('checkForUpdateNow'));
  });

  it('달리는 중에는 다시 시작하지 않는다', () => {
    // 다시 시작은 앱을 새로 켜는 일이라, 달리는 도중에 하면 그날 기록이 사라집니다.
    assert.ok(cardSource.includes('isRunInProgress()'), '달리는 중에도 앱을 다시 시작합니다');
  });

  it('회차 화면에서도 지금 내용을 볼 수 있다', () => {
    // 문제를 겪는 바로 그 자리에서 확인할 수 있어야 합니다.
    assert.ok(runnerSource.includes('appContentStatus()'));
  });
});

describe('자동 업데이트 설정이 유지된다', () => {
  it('Preview에서만 켜고 정식 앱에서는 끈다', () => {
    // 정식 앱에서 켜지면 Play 심사가 다시 시작됩니다.
    assert.ok(configSource.includes('if (!isPreview) return { enabled: false };'));
  });

  it('앱을 열 때 확인하고 화면을 막지 않는다', () => {
    assert.ok(configSource.includes("checkAutomatically: 'ON_LOAD'"));
    assert.ok(configSource.includes('fallbackToCacheTimeout: 0'));
  });
});
