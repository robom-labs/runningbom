// production과 Preview Expo 설정이 서로 안전하게 분리되는지 회귀 검증합니다.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import appJson from '../app.json';
import easJson from '../eas.json';

const require = createRequire(import.meta.url);
const {
  resolveRunningbomConfig,
}: {
  resolveRunningbomConfig: (
    config: typeof appJson.expo,
    variant?: string,
  ) => typeof appJson.expo & {
    extra: typeof appJson.expo.extra & {
      appVariant: string;
      releaseChannel: string;
      preview: { enabled: boolean; label: string };
      runtimePolicy: {
        productionOauthRedirectsEnabled: boolean;
        productionSocialWriteEnabled: boolean;
      };
    };
  };
} = require('../app.config.js');

describe('Expo 앱 변형', () => {
  it('production은 기존 식별자와 projectId를 유지한다', () => {
    const config = resolveRunningbomConfig(structuredClone(appJson.expo), 'production');

    assert.equal(config.name, '러닝봄');
    assert.equal(config.scheme, 'runningbom');
    assert.equal(config.android.package, 'kr.robom.runningbom');
    assert.equal(config.ios.bundleIdentifier, 'kr.robom.runningbom');
    assert.equal(config.extra.appVariant, 'production');
    assert.equal(config.extra.releaseChannel, 'production');
    assert.equal(config.extra.preview.enabled, false);
    assert.equal(config.extra.eas.projectId, appJson.expo.extra.eas.projectId);
  });

  it('Preview는 앱 식별자를 분리하고 production 쓰기를 차단한다', () => {
    const config = resolveRunningbomConfig(structuredClone(appJson.expo), 'preview');

    assert.equal(config.name, '러닝봄 Preview');
    assert.equal(config.scheme, 'runningbom-preview');
    assert.equal(config.android.package, 'kr.robom.runningbom.preview');
    assert.equal(config.ios.bundleIdentifier, 'kr.robom.runningbom.preview');
    assert.equal(config.ios.infoPlist.CFBundleDisplayName, '러닝봄 Preview');
    assert.equal(config.extra.releaseChannel, 'preview');
    assert.equal(config.extra.preview.enabled, true);
    assert.equal(config.extra.preview.label, 'Preview');
    assert.equal(config.extra.runtimePolicy.productionOauthRedirectsEnabled, false);
    assert.equal(config.extra.runtimePolicy.productionSocialWriteEnabled, false);
    assert.equal(config.extra.eas.projectId, appJson.expo.extra.eas.projectId);
    assert.deepEqual(
      config.android.intentFilters.flatMap((filter) =>
        filter.data.map((entry) => entry.scheme),
      ),
      ['runningbom-preview'],
    );
  });

  it('EAS Preview는 internal APK이며 로그인·소셜 기능을 기본 차단한다', () => {
    const preview = easJson.build.preview;

    assert.equal(preview.distribution, 'internal');
    assert.equal(preview.android.buildType, 'apk');
    assert.equal(preview.env.RUNNINGBOM_VARIANT, 'preview');
    assert.equal(preview.env.EXPO_PUBLIC_RELEASE_CHANNEL, 'preview');
    assert.equal(preview.env.EXPO_PUBLIC_COMMUNITY_MODE, 'CORE_ONLY');
    assert.equal(preview.env.EXPO_PUBLIC_SOCIAL_ENABLED, 'false');
    assert.equal(preview.env.EXPO_PUBLIC_AUTH_GOOGLE_ENABLED, 'false');
    assert.equal(preview.env.EXPO_PUBLIC_AUTH_KAKAO_ENABLED, 'false');
    assert.equal(preview.env.EXPO_PUBLIC_AUTH_NAVER_ENABLED, 'false');
    assert.equal(preview.env.EXPO_PUBLIC_AUTH_APPLE_ENABLED, 'false');
  });

  it('EAS production은 기존 앱의 AAB를 생성하며 submit 설정이 없다', () => {
    assert.equal(easJson.build.production.env.RUNNINGBOM_VARIANT, 'production');
    assert.equal(easJson.build.production.android.buildType, 'app-bundle');
    assert.equal('submit' in easJson, false);
  });
});
