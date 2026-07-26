// 대회, 공식 러닝화, 출시예정을 한 탐색 화면 안에서 전환합니다.
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip, Wordmark } from '../../design-system/components';
import { palette, spacing, typeScale } from '../../design-system/theme';
import { RaceScreen } from '../../../domains/races/RaceScreen';
import { ShoeScreen } from '../../../domains/shoes/ShoeScreen';
import type { ExploreRequest, ExploreSection } from '../../navigation/types';

export function ExploreScreen({ request }: { request?: ExploreRequest }) {
  const [section, setSection] = useState<ExploreSection>('대회');

  useEffect(() => {
    if (request) setSection(request.section);
  }, [request]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Wordmark compact />
          <Text style={styles.subtitle}>대회와 러닝화를 공식 정보로 살펴봐요.</Text>
        </View>
        <View accessibilityRole="tablist" style={styles.tabs}>
          {(['대회', '러닝화', '출시예정'] as ExploreSection[]).map((value) => (
            <Chip
              key={value}
              label={value}
              selected={section === value}
              onPress={() => setSection(value)}
              tone="accent"
              accessibilityRole="tab"
            />
          ))}
        </View>
        {section === '대회' ? <RaceScreen focusedRaceId={request?.raceId} /> : null}
        {section === '러닝화' ? <ShoeScreen focusedShoeId={request?.shoeId} /> : null}
        {section === '출시예정' ? (
          <ShoeScreen focusedShoeId={request?.shoeId} upcomingOnly />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  content: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: 112,
  },
  header: { paddingTop: spacing.sm, paddingBottom: spacing.md },
  subtitle: {
    color: palette.muted,
    fontSize: typeScale.bodySmall,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
});
