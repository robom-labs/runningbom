// 앱이 스스로 받아 둔 새 내용을 "지금 적용할지" 물어보는 얇은 안내입니다.
// APK를 다시 받을 필요가 없는 경우가 여기에 해당합니다.
import * as Updates from 'expo-updates';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

/** 화면에 보이는 상태입니다. 받아 둔 게 없으면 아무것도 그리지 않습니다. */
type BannerState = 'hidden' | 'ready' | 'applying';

/**
 * expo-updates가 켜져 있지 않은 빌드(정식 앱, 개발 서버)에서는 항상 아무것도 그리지 않습니다.
 * 어떤 경우에도 예외를 밖으로 던지지 않습니다.
 */
export function OtaBanner() {
  const [state, setState] = useState<BannerState>('hidden');

  const check = useCallback(async () => {
    if (!Updates.isEnabled) return;
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) return;
      await Updates.fetchUpdateAsync();
      setState('ready');
    } catch {
      // 인터넷이 없거나 서버가 응답하지 않으면 조용히 넘어갑니다. 다음에 다시 확인합니다.
    }
  }, []);

  useEffect(() => {
    void check();
    // 앱을 다시 열 때마다 한 번 더 확인합니다.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check();
    });
    return () => subscription.remove();
  }, [check]);

  const apply = useCallback(() => {
    setState('applying');
    void Updates.reloadAsync().catch(() => {
      // 다시 여는 데 실패해도 다음 실행에서 자동으로 적용됩니다.
      setState('ready');
    });
  }, []);

  if (state === 'hidden') return null;

  return (
    <View accessibilityRole="alert" style={styles.card}>
      <Text style={styles.title}>새 내용이 준비됐어요</Text>
      <Text style={styles.body}>
        따로 받지 않아도 돼요. 지금 바로 적용하거나, 앱을 다음에 열 때 자동으로 적용돼요.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="새 내용 지금 적용하기"
        disabled={state === 'applying'}
        onPress={apply}
        style={styles.button}
      >
        <Text style={styles.label}>{state === 'applying' ? '적용하는 중…' : '지금 적용'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#E4F0E8',
    borderColor: '#4F7C5C',
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  title: { color: '#22301F', fontSize: 15, fontWeight: '800' },
  body: { color: '#3E4A3C', fontSize: 13, lineHeight: 19 },
  button: {
    alignItems: 'center',
    backgroundColor: '#4F7C5C',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  label: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
