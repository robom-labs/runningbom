// 대회 메뉴의 화면 껍데기입니다. 실제 목록은 domains/races의 카드형 화면이 담당합니다.
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { RaceScreen } from '../../../domains/races/RaceScreen';
import { useGoalRace } from '../../../domains/races/useGoalRace';
import { Button, Card } from '../../design-system/components';
import {
  fontWeight,
  lineHeight,
  palette,
  spacing,
  typeScale,
} from '../../design-system/theme';

export type RacesScreenProps = {
  focusedRaceId?: string;
  onOpenPrograms?: () => void;
};

export function RacesScreen({ focusedRaceId, onOpenPrograms }: RacesScreenProps) {
  const { goalRace } = useGoalRace();

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
      {goalRace && onOpenPrograms ? (
        <Card elevated style={styles.planBanner}>
          <View style={styles.planCopy}>
            <Text style={styles.planEyebrow}>목표 대회 준비</Text>
            <Text numberOfLines={2} style={styles.planTitle}>
              {goalRace.name}
            </Text>
            <Text style={styles.planBody}>
              대회를 고르는 데서 끝내지 않고, 남은 날짜에 맞춘 이번 주 훈련으로 바로 이어가요.
            </Text>
          </View>
          <Button label="훈련 계획 보기" onPress={onOpenPrograms} size="lg" />
        </Card>
      ) : null}
      <RaceScreen focusedRaceId={focusedRaceId} />
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
    gap: spacing.md,
  },
  planBanner: {
    gap: spacing.sm,
  },
  planCopy: {
    gap: spacing.xxs,
  },
  planEyebrow: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.bold,
  },
  planTitle: {
    color: palette.ink,
    fontSize: typeScale.title,
    lineHeight: lineHeight.title,
    fontWeight: fontWeight.heavy,
  },
  planBody: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
});
