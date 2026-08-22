// 대회 메뉴의 화면 껍데기입니다. 실제 목록은 domains/races의 카드형 화면이 담당합니다.
import { ScrollView, StyleSheet } from 'react-native';

import { RaceScreen } from '../../../domains/races/RaceScreen';
import type { RacePreference } from '../../../domains/races/preference';
import { palette, spacing } from '../../design-system/theme';

type Props = {
  focusedRaceId?: string;
  initialPreference?: RacePreference;
  preferenceNonce?: number;
};

export function RacesScreen({ focusedRaceId, initialPreference, preferenceNonce }: Props) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
      <RaceScreen
        focusedRaceId={focusedRaceId}
        initialPreference={initialPreference}
        preferenceNonce={preferenceNonce}
      />
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
