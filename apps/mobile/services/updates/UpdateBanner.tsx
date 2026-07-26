// 새 러닝봄 Preview APK가 있을 때만 조용히 나타나는 자급자족 안내 배너입니다.
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  checkForUpdate,
  dismissUpdate,
  isDismissed,
  type PreviewReleaseManifest,
} from './checkForUpdate';

export type UpdateBannerProps = {
  /** 확인 주기 제한을 무시하고 즉시 확인합니다. */
  force?: boolean;
  /** 배너를 닫았을 때 부모가 추가 처리를 하고 싶을 때 사용합니다. */
  onDismiss?: () => void;
};

/**
 * Preview 빌드가 아니거나, 최신이거나, 네트워크가 없으면 아무것도 렌더링하지 않습니다.
 * 어떤 경우에도 예외를 던지지 않으므로 어느 화면에 붙여도 안전합니다.
 */
export function UpdateBanner({ force, onDismiss }: UpdateBannerProps) {
  const [manifest, setManifest] = useState<PreviewReleaseManifest | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const result = await checkForUpdate({ force });
      if (!active) return;
      if (result.status !== 'update-available' || !result.manifest) return;
      if (await isDismissed(result.manifest.versionCode)) return;
      if (!active) return;
      setManifest(result.manifest);
    })();

    return () => {
      active = false;
    };
  }, [force]);

  const handleDownload = useCallback(() => {
    if (!manifest) return;
    void Linking.openURL(manifest.apkUrl).catch(() => {
      // 브라우저를 열 수 없는 환경에서도 앱이 죽지 않도록 무시합니다.
    });
  }, [manifest]);

  const handleDismiss = useCallback(() => {
    if (manifest) void dismissUpdate(manifest.versionCode);
    setManifest(null);
    onDismiss?.();
  }, [manifest, onDismiss]);

  if (!manifest) return null;

  return (
    <View accessibilityRole="alert" style={styles.card}>
      <Text style={styles.title}>새 Preview 버전이 있어요</Text>
      <Text style={styles.body}>
        {`버전 ${manifest.latestVersion} (빌드 ${manifest.versionCode})을 내려받아 그대로 설치하면 업데이트됩니다.`}
      </Text>
      {manifest.notes.slice(0, 3).map((note) => (
        <Text key={note} style={styles.note}>
          {`· ${note}`}
        </Text>
      ))}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="새 Preview 버전 다운로드"
          onPress={handleDownload}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryLabel}>다운로드</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="업데이트 안내 닫기"
          onPress={handleDismiss}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryLabel}>나중에</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFE2D4',
    borderColor: '#F26B3A',
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  title: {
    color: '#182033',
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    color: '#4F5B6D',
    fontSize: 14,
  },
  note: {
    color: '#4F5B6D',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  primaryButton: {
    backgroundColor: '#F26B3A',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    borderColor: '#F26B3A',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  secondaryLabel: {
    color: '#B9431D',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default UpdateBanner;
