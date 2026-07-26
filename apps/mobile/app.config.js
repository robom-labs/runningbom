// 러닝봄 production과 Preview의 Expo 식별자와 안전한 런타임 정책을 분리합니다.
const PREVIEW_VARIANT = 'preview';

function normalizeVariant(value) {
  return value === PREVIEW_VARIANT ? PREVIEW_VARIANT : 'production';
}

function resolveRunningbomConfig(config, requestedVariant = process.env.RUNNINGBOM_VARIANT) {
  const variant = normalizeVariant(requestedVariant);
  const isPreview = variant === PREVIEW_VARIANT;
  const scheme = isPreview ? 'runningbom-preview' : 'runningbom';

  return {
    ...config,
    name: isPreview ? '러닝봄 Preview' : '러닝봄',
    scheme,
    ios: {
      ...config.ios,
      bundleIdentifier: isPreview ? 'kr.robom.runningbom.preview' : 'kr.robom.runningbom',
      infoPlist: {
        ...config.ios?.infoPlist,
        CFBundleDisplayName: isPreview ? '러닝봄 Preview' : '러닝봄',
      },
    },
    android: {
      ...config.android,
      package: isPreview ? 'kr.robom.runningbom.preview' : 'kr.robom.runningbom',
      intentFilters: (config.android?.intentFilters ?? []).map((filter) => ({
        ...filter,
        data: (filter.data ?? []).map((entry) =>
          entry.scheme === 'runningbom' ? { ...entry, scheme } : entry,
        ),
      })),
    },
    extra: {
      ...config.extra,
      appVariant: variant,
      releaseChannel: isPreview ? 'preview' : 'production',
      sourceSha:
        process.env.EAS_BUILD_GIT_COMMIT_HASH ??
        process.env.EXPO_PUBLIC_SOURCE_SHA ??
        'local',
      preview: {
        enabled: isPreview,
        label: isPreview ? 'Preview' : '',
      },
      runtimePolicy: {
        productionOauthRedirectsEnabled: !isPreview,
        productionSocialWriteEnabled: !isPreview,
      },
    },
  };
}

module.exports = ({ config }) => resolveRunningbomConfig(config);
module.exports.resolveRunningbomConfig = resolveRunningbomConfig;
