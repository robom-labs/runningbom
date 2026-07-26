// 러닝봄 production과 Preview의 Expo 식별자와 안전한 런타임 정책을 분리합니다.
const PREVIEW_VARIANT = 'preview';
// Preview APK를 새로 배포할 때마다 이 값을 올려야 기존 설치본 위에 덮어쓰기 업데이트가 됩니다.
const PREVIEW_DEFAULT_VERSION_CODE = 9;

function normalizeVariant(value) {
  return value === PREVIEW_VARIANT ? PREVIEW_VARIANT : 'production';
}

// PREVIEW_VERSION_CODE 환경값이 기본값 이상의 정수일 때만 이를 사용합니다(정식 앱 versionCode와 무관).
function resolvePreviewVersionCode(rawValue = process.env.PREVIEW_VERSION_CODE) {
  const parsed = Number.parseInt(String(rawValue ?? ''), 10);
  if (!Number.isInteger(parsed) || parsed < PREVIEW_DEFAULT_VERSION_CODE) {
    return PREVIEW_DEFAULT_VERSION_CODE;
  }
  return parsed;
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
      // Preview는 정식 앱의 Play versionCode와 분리해, 설치된 Preview APK도 안전하게 업데이트합니다.
      versionCode: isPreview ? resolvePreviewVersionCode() : config.android?.versionCode,
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
module.exports.resolvePreviewVersionCode = resolvePreviewVersionCode;
module.exports.PREVIEW_DEFAULT_VERSION_CODE = PREVIEW_DEFAULT_VERSION_CODE;
