// 러닝봄 production과 Preview의 Expo 식별자와 안전한 런타임 정책을 분리합니다.
const PREVIEW_VARIANT = 'preview';
// Preview APK를 새로 배포할 때마다 이 값을 올려야 기존 설치본 위에 덮어쓰기 업데이트가 됩니다.
const PREVIEW_DEFAULT_VERSION_CODE = 9;

// GPS 러닝 추적은 Preview에서만 켭니다. Play 심사 중인 정식 앱의 실효 권한은 늘리지 않습니다.
const FOREGROUND_LOCATION_PERMISSIONS = [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
];
// 백그라운드 위치는 Play 별도 승인이 필요하므로 어떤 변형에서도 쓰지 않고 항상 차단합니다.
const BACKGROUND_LOCATION_PERMISSION = 'android.permission.ACCESS_BACKGROUND_LOCATION';
const LOCATION_WHEN_IN_USE_USAGE =
  '러닝 중 이동 거리와 페이스를 계산하려고 앱을 쓰는 동안에만 위치를 사용합니다.';

function normalizeVariant(value) {
  return value === PREVIEW_VARIANT ? PREVIEW_VARIANT : 'production';
}

function uniqueList(values) {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value)));
}

// Preview에만 포그라운드 위치 권한을 더합니다. production 선언 목록은 그대로 둡니다.
function resolveAndroidPermissions(config, isPreview) {
  const declared = config.android?.permissions ?? [];
  if (!isPreview) {
    return uniqueList(
      declared.filter(
        (permission) =>
          !FOREGROUND_LOCATION_PERMISSIONS.includes(permission) &&
          permission !== BACKGROUND_LOCATION_PERMISSION,
      ),
    );
  }
  return uniqueList([...declared, ...FOREGROUND_LOCATION_PERMISSIONS]);
}

// expo-location 라이브러리 매니페스트가 위치 권한을 병합하므로 production에서는 명시적으로 제거합니다.
function resolveAndroidBlockedPermissions(config, isPreview) {
  const blocked = config.android?.blockedPermissions ?? [];
  if (isPreview) {
    return uniqueList([...blocked, BACKGROUND_LOCATION_PERMISSION]);
  }
  return uniqueList([
    ...blocked,
    ...FOREGROUND_LOCATION_PERMISSIONS,
    BACKGROUND_LOCATION_PERMISSION,
  ]);
}

// iOS도 Preview에만 "앱 사용 중" 위치 설명을 넣고, 백그라운드 위치 모드는 두지 않습니다.
function resolveIosInfoPlist(config, isPreview) {
  const infoPlist = { ...config.ios?.infoPlist };
  delete infoPlist.NSLocationAlwaysUsageDescription;
  delete infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription;
  delete infoPlist.UIBackgroundModes;

  if (isPreview) {
    infoPlist.NSLocationWhenInUseUsageDescription = LOCATION_WHEN_IN_USE_USAGE;
  } else {
    delete infoPlist.NSLocationWhenInUseUsageDescription;
  }

  return infoPlist;
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
        ...resolveIosInfoPlist(config, isPreview),
        CFBundleDisplayName: isPreview ? '러닝봄 Preview' : '러닝봄',
      },
    },
    android: {
      ...config.android,
      package: isPreview ? 'kr.robom.runningbom.preview' : 'kr.robom.runningbom',
      permissions: resolveAndroidPermissions(config, isPreview),
      blockedPermissions: resolveAndroidBlockedPermissions(config, isPreview),
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
module.exports.FOREGROUND_LOCATION_PERMISSIONS = FOREGROUND_LOCATION_PERMISSIONS;
module.exports.BACKGROUND_LOCATION_PERMISSION = BACKGROUND_LOCATION_PERMISSION;
