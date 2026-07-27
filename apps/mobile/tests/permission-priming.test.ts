// 알림·위치·배터리 사전 설명과 거부 처리 규칙을 회귀 검증합니다.
// 스토어 안전선(새 권한 선언 금지, 위치는 Preview 전용)도 여기서 함께 지킵니다.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import appJson from '../app.json';
import {
  bannedPhrases,
  onboardingDoneCopy,
  onboardingLoginCopy,
  permissionPriming,
} from '../app/permissions/copy';
import {
  MAX_SYSTEM_ASKS,
  PERMISSION_LEDGER_KEY,
  canShowSystemPrompt,
  emptyPermissionLedger,
  emptyPermissionRecord,
  grantedPermissionKeys,
  mergeProbeIntoRecord,
  nextPermissionAction,
  parsePermissionLedger,
  permissionActionLabel,
  permissionStatusLabel,
  permissionStatusTone,
  recordPermissionOutcome,
} from '../app/permissions/rules';
import { permissionKeys, type PermissionKey } from '../app/permissions/types';
import {
  buildOnboardingSteps,
  isPermissionStep,
  onboardingStepIds,
  permissionStepIds,
} from '../app/screens/onboarding/steps';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { resolveRunningbomConfig } = require(path.join(root, 'app.config.js')) as {
  resolveRunningbomConfig: (
    config: typeof appJson.expo,
    variant?: string,
  ) => { android: { permissions: string[]; blockedPermissions: string[] } };
};

const BATTERY_PERMISSION = 'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS';

describe('사전 설명 문구', () => {
  it('세 가지 모두 제목·본문·정직한 안내를 갖는다', () => {
    for (const key of permissionKeys) {
      const copy = permissionPriming[key];
      assert.equal(copy.key, key);
      assert.ok(copy.title.length > 0, `${key} 제목 누락`);
      assert.ok(copy.body.length > 0, `${key} 본문 누락`);
      assert.ok(copy.honesty.length > 0, `${key} 정직한 안내 누락`);
      assert.ok(copy.allowLabel.length > 0 && copy.laterLabel.length > 0, `${key} 버튼 누락`);
      assert.ok(copy.settingsLabel.includes('설정'), `${key} 설정 버튼 글자 누락`);
    }
  });

  it('버튼은 언제나 주 버튼과 "나중에" 두 개다', () => {
    for (const key of permissionKeys) {
      assert.equal(permissionPriming[key].laterLabel, '나중에');
    }
    assert.equal(permissionPriming.notification.allowLabel, '허용하고 계속');
    assert.equal(permissionPriming.location.allowLabel, '허용하고 계속');
  });

  it('부탁하는 말과 기술 용어를 쓰지 않는다', () => {
    const texts = [
      ...permissionKeys.flatMap((key) => {
        const copy = permissionPriming[key];
        return [
          copy.title,
          copy.body,
          copy.honesty,
          copy.promise ?? '',
          copy.settingsNote,
          copy.deniedNote,
          copy.shortDescription,
          ...(copy.steps ?? []),
        ];
      }),
      ...Object.values(onboardingDoneCopy),
      ...Object.values(onboardingLoginCopy),
    ];
    for (const text of texts) {
      for (const banned of bannedPhrases) {
        assert.equal(text.includes(banned), false, `"${banned}"가 문구에 남아 있습니다: ${text}`);
      }
    }
  });

  it('위치 화면은 앱을 끈 사이의 위치를 요청하지 않는다는 사실을 반드시 적는다', () => {
    const copy = permissionPriming.location;
    assert.ok(copy.promise?.includes('러닝 중에만'));
    assert.ok(copy.promise?.includes('앱을 끈 사이의 위치는 아예 요청하지 않아요'));
    assert.ok(copy.honesty.includes('시간 기반 코칭은 그대로'));
  });

  it('알림 화면은 무엇을 알려 주는지와 광고를 보내지 않는다는 사실을 적는다', () => {
    const copy = permissionPriming.notification;
    assert.ok(copy.title.includes('접수'));
    assert.ok(copy.promise?.includes('광고 알림은 보내지 않아요'));
  });

  it('배터리 화면은 시스템 창이 없으므로 눌러야 할 것을 번호로 적는다', () => {
    const steps = permissionPriming.battery.steps ?? [];
    assert.ok(steps.length >= 3, '배터리 안내 번호가 부족합니다.');
    steps.forEach((step, order) => {
      assert.ok(step.startsWith(`${order + 1}.`), `${order + 1}번 번호가 없습니다: ${step}`);
    });
    assert.ok(steps.some((step) => step.includes('러닝봄')));
    assert.ok(steps.some((step) => step.includes('제한 없음')));
  });
});

describe('거부 처리 규칙', () => {
  it('새 저장 키만 쓰고 기존 키를 건드리지 않는다', () => {
    assert.equal(PERMISSION_LEDGER_KEY, 'runningbom:vnext:permission-ledger:v1');
    assert.notEqual(PERMISSION_LEDGER_KEY, 'runningbom:vnext:preferences:v1');
    assert.notEqual(PERMISSION_LEDGER_KEY, 'runningbom:vnext:onboarding:v1');
  });

  it('손상된 저장값은 "아직 안 물어봤음"으로 되돌린다', () => {
    assert.deepEqual(parsePermissionLedger(null), emptyPermissionLedger);
    assert.deepEqual(parsePermissionLedger({ notification: { outcome: 'weird' } }).notification, {
      outcome: 'unknown',
      refusedCount: 0,
    });
    const parsed = parsePermissionLedger({
      location: { outcome: 'denied', refusedCount: 2, canAskAgain: false },
    });
    assert.equal(parsed.location.refusedCount, 2);
    assert.equal(parsed.location.canAskAgain, false);
  });

  it('시스템 창에서 거절할 때만 거절 횟수가 늘어난다', () => {
    const once = recordPermissionOutcome(emptyPermissionLedger, 'notification', {
      outcome: 'denied',
      now: '2026-07-27T00:00:00.000Z',
    });
    assert.equal(once.notification.refusedCount, 1);
    const later = recordPermissionOutcome(once, 'notification', { outcome: 'later' });
    assert.equal(later.notification.refusedCount, 1, '"나중에"는 거절로 세지 않습니다.');
    const twice = recordPermissionOutcome(later, 'notification', { outcome: 'denied' });
    assert.equal(twice.notification.refusedCount, 2);
  });

  it('허용하면 거절 횟수를 0으로 되돌린다', () => {
    const denied = recordPermissionOutcome(emptyPermissionLedger, 'location', {
      outcome: 'denied',
    });
    const granted = recordPermissionOutcome(denied, 'location', { outcome: 'granted' });
    assert.equal(granted.location.outcome, 'granted');
    assert.equal(granted.location.refusedCount, 0);
  });

  it('두 번 거절하면 시스템 창을 더 띄우지 않고 설정 화면으로 보낸다', () => {
    assert.equal(MAX_SYSTEM_ASKS, 2);
    let ledger = emptyPermissionLedger;
    assert.equal(nextPermissionAction('notification', ledger.notification, true), 'ask');

    ledger = recordPermissionOutcome(ledger, 'notification', { outcome: 'denied' });
    assert.equal(
      nextPermissionAction('notification', ledger.notification, true),
      'ask',
      '한 번 거절은 아직 다시 물어볼 수 있어야 합니다.',
    );

    ledger = recordPermissionOutcome(ledger, 'notification', { outcome: 'denied' });
    assert.equal(nextPermissionAction('notification', ledger.notification, true), 'open-app-settings');
    assert.equal(canShowSystemPrompt(ledger.notification), false);
    assert.equal(permissionActionLabel('open-app-settings'), '설정에서 켜기');
  });

  it('휴대폰이 "다시 못 물어봄"이라고 하면 한 번만에도 설정 화면으로 보낸다', () => {
    const ledger = recordPermissionOutcome(emptyPermissionLedger, 'location', {
      outcome: 'denied',
      canAskAgain: false,
    });
    assert.equal(nextPermissionAction('location', ledger.location, true), 'open-app-settings');
  });

  it('배터리는 시스템 창이 없으므로 언제나 설정 화면으로만 안내한다', () => {
    assert.equal(nextPermissionAction('battery', emptyPermissionRecord, true), 'open-battery-settings');
    const opened = recordPermissionOutcome(emptyPermissionLedger, 'battery', { outcome: 'opened' });
    assert.equal(nextPermissionAction('battery', opened.battery, true), 'open-battery-settings');
    assert.equal(nextPermissionAction('battery', opened.battery, false), 'unavailable');
  });

  it('이미 켜져 있으면 더 물어보지 않는다', () => {
    const granted = recordPermissionOutcome(emptyPermissionLedger, 'notification', {
      outcome: 'granted',
    });
    assert.equal(nextPermissionAction('notification', granted.notification, true), 'done');
    assert.equal(permissionActionLabel('done'), undefined);
  });

  it('상태를 다시 확인해도 거절 횟수는 늘지 않고 사용자의 "나중에" 선택도 지우지 않는다', () => {
    const later = recordPermissionOutcome(emptyPermissionLedger, 'notification', {
      outcome: 'later',
    });
    const refreshed = mergeProbeIntoRecord(later.notification, { outcome: 'unknown' });
    assert.equal(refreshed.outcome, 'later');

    const denied = recordPermissionOutcome(emptyPermissionLedger, 'notification', {
      outcome: 'denied',
    });
    const rechecked = mergeProbeIntoRecord(denied.notification, { outcome: 'denied' });
    assert.equal(rechecked.refusedCount, 1, '새로 고침이 거절 횟수를 늘리면 안 됩니다.');

    const turnedOnOutside = mergeProbeIntoRecord(denied.notification, { outcome: 'granted' });
    assert.equal(turnedOnOutside.outcome, 'granted');
    assert.equal(turnedOnOutside.refusedCount, 0);
  });

  it('설정 화면에 쓰는 상태 글자는 기술 용어 없이 읽힌다', () => {
    assert.equal(permissionStatusLabel('notification', emptyPermissionRecord), '아직 안 물어봤어요');
    assert.equal(permissionStatusLabel('battery', emptyPermissionRecord), '아직 안 열어 봤어요');
    assert.equal(
      permissionStatusLabel('location', { outcome: 'granted', refusedCount: 0 }),
      '켜짐',
    );
    assert.equal(permissionStatusLabel('location', { outcome: 'denied', refusedCount: 2 }), '꺼짐');
    assert.equal(
      permissionStatusLabel('location', { outcome: 'unavailable', refusedCount: 0 }),
      '이 앱에서는 안 써요',
    );
    assert.equal(permissionStatusTone({ outcome: 'granted', refusedCount: 0 }), 'positive');
    assert.equal(permissionStatusTone({ outcome: 'denied', refusedCount: 1 }), 'warning');
  });

  it('완료 화면은 켜진 것만 골라 보여 준다', () => {
    const support: Record<PermissionKey, boolean> = {
      notification: true,
      location: false,
      battery: true,
    };
    let ledger = recordPermissionOutcome(emptyPermissionLedger, 'notification', {
      outcome: 'granted',
    });
    ledger = recordPermissionOutcome(ledger, 'location', { outcome: 'granted' });
    assert.deepEqual(grantedPermissionKeys(ledger, support), ['notification']);
  });
});

describe('온보딩 단계 편성', () => {
  it('소개 → 목표 → 지금 상태 → 음성 → 로그인 → 알림 → 위치 → 배터리 → 완료 순서다', () => {
    assert.deepEqual(onboardingStepIds, [
      'intro',
      'goal',
      'start',
      'voice',
      'login',
      'notification',
      'location',
      'battery',
      'done',
    ]);
    assert.ok(
      onboardingStepIds.indexOf('notification') < onboardingStepIds.indexOf('location'),
      '거부감이 적은 알림을 먼저 물어야 합니다.',
    );
    assert.ok(onboardingStepIds.indexOf('location') < onboardingStepIds.indexOf('battery'));
  });

  it('사전 설명이 붙는 단계는 알림·위치·배터리뿐이다', () => {
    assert.deepEqual([...permissionStepIds], ['notification', 'location', 'battery']);
    assert.equal(isPermissionStep('notification'), true);
    assert.equal(isPermissionStep('intro'), false);
    assert.equal(isPermissionStep('login'), false);
  });

  it('정식 빌드에서는 위치 단계를 아예 만들지 않는다', () => {
    const production = buildOnboardingSteps({ locationStep: false, batteryStep: true });
    assert.equal(production.includes('location'), false);
    assert.equal(production.length, 8, '진행 점 개수가 실제 단계 수와 같아야 합니다.');

    const preview = buildOnboardingSteps({ locationStep: true, batteryStep: true });
    assert.equal(preview.length, 9);
    assert.equal(preview.includes('location'), true);
  });

  it('배터리 설정이 없는 기기에서는 배터리 단계를 빼고 진행 점도 줄인다', () => {
    const ios = buildOnboardingSteps({ locationStep: true, batteryStep: false });
    assert.equal(ios.includes('battery'), false);
    assert.equal(ios.length, 8);

    const minimal = buildOnboardingSteps({ locationStep: false, batteryStep: false });
    assert.deepEqual(minimal, ['intro', 'goal', 'start', 'voice', 'login', 'notification', 'done']);
  });
});

describe('스토어 안전선', () => {
  it('배터리 최적화 제외 권한은 어떤 변형에서도 선언하지 않는다', () => {
    for (const variant of ['production', 'preview']) {
      const config = resolveRunningbomConfig(structuredClone(appJson.expo), variant);
      assert.equal(
        config.android.permissions.includes(BATTERY_PERMISSION),
        false,
        `${variant}에 배터리 최적화 권한이 들어갔습니다.`,
      );
    }
    assert.equal(appJson.expo.android.permissions.includes(BATTERY_PERMISSION), false);
  });

  it('정식 빌드의 선언 권한은 알림 하나뿐이다', () => {
    const production = resolveRunningbomConfig(structuredClone(appJson.expo), 'production');
    assert.deepEqual(production.android.permissions, ['android.permission.POST_NOTIFICATIONS']);
  });

  it('권한 안내 코드에 배터리 최적화 권한 이름이 등장하지 않는다', async () => {
    const directory = path.join(root, 'app/permissions');
    const files = await readdir(directory);
    for (const file of files) {
      const source = await readFile(path.join(directory, file), 'utf8');
      const mentionsPermissionName = source.includes(`android.permission.REQUEST_IGNORE`);
      assert.equal(mentionsPermissionName, false, `${file}에 배터리 최적화 권한 이름이 있습니다.`);
      assert.ok(/[가-힣]/.test(source.split(/\r?\n/, 1)[0] ?? ''), `${file} 첫 줄 한국어 주석 누락`);
    }
  });

  it('배터리는 권한 없이 열리는 시스템 설정 화면만 쓴다', async () => {
    const source = await readFile(path.join(root, 'app/permissions/systemSettings.ts'), 'utf8');
    assert.ok(source.includes('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'));
    assert.ok(source.includes('Linking.sendIntent'));
    assert.ok(source.includes('Linking.openSettings'), '폴백이 없습니다.');
  });

  it('위치 요청은 Preview 판정을 그대로 쓰고 백그라운드 위치를 건드리지 않는다', async () => {
    const source = await readFile(path.join(root, 'app/permissions/locationPermission.ts'), 'utf8');
    assert.ok(source.includes('gpsTrackingEnabled'), 'Preview 판정을 재사용해야 합니다.');
    assert.equal(source.includes('requestBackgroundPermissionsAsync'), false);
    assert.equal(source.includes('ACCESS_BACKGROUND_LOCATION'), false);
  });
});
