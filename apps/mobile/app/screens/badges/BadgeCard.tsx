// 그리드 한 칸에 들어가는 배지 카드입니다.
// 받은 것·진행 중·잠긴 것이 한눈에 달라 보이도록 엠블럼과 아래 한 줄이 함께 바뀝니다.
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BadgeEmblem } from '../../design-system/emblem';
import {
  borderWidth,
  fontWeight,
  lineHeight,
  palette,
  pressedOpacity,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';
import { badgeTierLabels } from '../../../domains/badges/rules';
import type { BadgeView } from '../../../domains/badges/presentation';

type BadgeCardProps = {
  view: BadgeView;
  onPress: (badgeId: string) => void;
  featured?: boolean;
};

const stateWords: Record<BadgeView['state'], string> = {
  earned: '받음',
  progress: '진행 중',
  locked: '잠김',
};

export const BadgeCard = memo(function BadgeCard({ view, onPress, featured }: BadgeCardProps) {
  const { badge, state } = view;
  const caption = state === 'earned' ? badgeTierLabels[badge.tier] : view.progressLabel;
  return (
    <Pressable
      accessibilityHint="배지 자세히 보기"
      accessibilityLabel={`${badge.title}. ${stateWords[state]}. ${view.progressLabel}`}
      accessibilityRole="button"
      onPress={() => onPress(badge.id)}
      style={({ pressed }) => [
        styles.card,
        state === 'earned' && styles.cardEarned,
        featured && styles.cardFeatured,
        pressed && { opacity: pressedOpacity },
      ]}
    >
      <BadgeEmblem
        category={badge.category}
        ratio={view.ratio}
        size={72}
        state={state}
        tier={badge.tier}
      />
      <Text numberOfLines={2} style={[styles.title, state !== 'earned' && styles.titleDim]}>
        {badge.title}
      </Text>
      <Text numberOfLines={2} style={styles.caption}>
        {caption}
      </Text>
      {state === 'progress' ? (
        <View accessibilityRole="progressbar" style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(view.ratio * 100)}%` }]} />
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    // 한 줄에 3칸까지만 들어가게 해서 카드가 알아볼 수 없을 만큼 작아지지 않게 합니다.
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 108,
    maxWidth: 200,
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  cardEarned: { backgroundColor: palette.surface, borderColor: palette.line },
  cardFeatured: { borderColor: palette.accentStrong, borderWidth: borderWidth.emphasis },
  title: {
    marginTop: spacing.xxs,
    textAlign: 'center',
    color: palette.ink,
    fontSize: typeScale.label,
    lineHeight: lineHeight.label,
    fontWeight: fontWeight.heavy,
  },
  titleDim: { color: palette.inkSoft },
  caption: {
    textAlign: 'center',
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
  },
  track: {
    marginTop: spacing.xxs,
    width: '82%',
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceMuted,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: palette.accentStrong },
});
