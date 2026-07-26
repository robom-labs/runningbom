// 러닝화 메뉴의 화면 껍데기입니다. 목록은 domains/shoes의 화면이 그대로 담당합니다.
import { ScrollView, StyleSheet } from 'react-native';

import { ShoeScreen } from '../../../domains/shoes/ShoeScreen';
import { palette, spacing } from '../../design-system/theme';

export function ShoesScreen({ focusedShoeId }: { focusedShoeId?: string }) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
      <ShoeScreen focusedShoeId={focusedShoeId} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  content: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
});
