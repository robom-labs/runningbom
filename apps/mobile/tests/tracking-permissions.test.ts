// GPS 위치 권한이 Preview에만 열리고 정식 앱에서는 차단되는지 회귀 검증합니다.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import appJson from '../app.json';
import packageJson from '../package.json';

const require = createRequire(import.meta.url);
const {
  resolveRunningbomConfig,
}: {
  resolveRunningbomConfig: (
    config: typeof appJson.expo,
    variant?: string,
  ) => typeof appJson.expo & {
    android: typeof appJson.expo.android & {
      permissions: string[];
      blockedPermissions: string[];
    };
    ios: typeof appJson.expo.ios & { infoPlist: Record<string, unknown> };
  };
} = require('../app.config.js');

const FINE = 'android.permission.ACCESS_FINE_LOCATION';
const COARSE = 'android.permission.ACCESS_COARSE_LOCATION';
const BACKGROUND = 'android.permission.ACCESS_BACKGROUND_LOCATION';

const preview = resolveRunningbomConfig(structuredClone(appJson.expo), 'preview');
const production = resolveRunningbomConfig(structuredClone(appJson.expo), 'production');

describe('GPS 위치 권한 분기', () => {
  it('Preview는 포그라운드 위치 권한을 선언한다', () => {
    assert.ok(preview.android.permissions.includes(FINE));
    assert.ok(preview.android.permissions.includes(COARSE));
    assert.equal(preview.extra.preview.enabled, true);
  });

  it('production은 위치 권한을 선언하지 않고 명시적으로 차단한다', () => {
    assert.equal(production.android.permissions.includes(FINE), false);
    assert.equal(production.android.permissions.includes(COARSE), false);
    assert.ok(production.android.blockedPermissions.includes(FINE));
    assert.ok(production.android.blockedPermissions.includes(COARSE));
    assert.equal(production.extra.preview.enabled, false);
  });

  it('production의 기존 알림 권한과 기존 차단 목록은 그대로 유지된다', () => {
    assert.deepEqual(production.android.permissions, ['android.permission.POST_NOTIFICATIONS']);
    for (const permission of appJson.expo.android.blockedPermissions) {
      assert.ok(
        production.android.blockedPermissions.includes(permission),
        `${permission} 차단이 사라졌습니다.`,
      );
      assert.ok(
        preview.android.blockedPermissions.includes(permission),
        `${permission} 차단이 사라졌습니다.`,
      );
    }
  });

  it('백그라운드 위치는 어떤 변형에서도 선언하지 않고 항상 차단한다', () => {
    for (const config of [preview, production]) {
      assert.equal(config.android.permissions.includes(BACKGROUND), false);
      assert.ok(config.android.blockedPermissions.includes(BACKGROUND));
    }
  });

  it('iOS 위치 설명도 Preview에만 넣고 백그라운드 모드는 두지 않는다', () => {
    assert.equal(typeof preview.ios.infoPlist.NSLocationWhenInUseUsageDescription, 'string');
    assert.equal(production.ios.infoPlist.NSLocationWhenInUseUsageDescription, undefined);
    for (const config of [preview, production]) {
      assert.equal(config.ios.infoPlist.UIBackgroundModes, undefined);
      assert.equal(config.ios.infoPlist.NSLocationAlwaysUsageDescription, undefined);
      assert.equal(
        config.ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription,
        undefined,
      );
    }
  });

  it('expo-location은 SDK 57 호환 버전으로 고정한다', () => {
    assert.ok(packageJson.dependencies['expo-location']?.startsWith('~57.0.'));
  });

  it('백그라운드 위치를 켜는 expo-location 플러그인 설정을 두지 않는다', () => {
    const locationPlugin = appJson.expo.plugins.find(
      (plugin) => plugin === 'expo-location' || (Array.isArray(plugin) && plugin[0] === 'expo-location'),
    );
    assert.equal(locationPlugin, undefined);
  });

  it('production versionCode와 식별자는 그대로다', () => {
    assert.equal(production.android.versionCode, appJson.expo.android.versionCode);
    assert.equal(production.android.package, 'kr.robom.runningbom');
    assert.equal(production.ios.bundleIdentifier, 'kr.robom.runningbom');
  });
});
