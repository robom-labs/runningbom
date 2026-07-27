// 새 배지를 받은 순간의 연출입니다.
// 가운데 카드가 조용히 떠오르고, 엠블럼이 한 번만 살짝 커졌다 제자리로 옵니다.
// 번쩍임·튀는 움직임·반복 애니메이션은 쓰지 않습니다(내장 Animated만 사용).
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../design-system/components';
import { BadgeEmblem } from '../../design-system/emblem';
import {
  elevation,
  fontWeight,
  layout,
  lineHeight,
  motion,
  palette,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';
import { badgeTierLabels, badgeTierNotes } from '../../../domains/badges/rules';
import type { BadgeView } from '../../../domains/badges/presentation';

type BadgeAwardProps = {
  view?: BadgeView;
  /** 아직 보여 줄 배지가 더 남았으면 그 개수입니다. */
  remaining?: number;
  onDismiss: () => void;
};

export function BadgeAward({ view, remaining = 0, onDismiss }: BadgeAwardProps) {
  const enter = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const badgeId = view?.badge.id;

  useEffect(() => {
    if (!badgeId) return;
    enter.setValue(0);
    pop.setValue(0);
    Animated.sequence([
      Animated.timing(enter, {
        toValue: 1,
        duration: motion.slow,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // 커졌다 제자리로. 딱 한 번만 합니다.
      Animated.timing(pop, {
        toValue: 1,
        duration: motion.slow,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pop, {
        toValue: 0,
        duration: motion.base,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [badgeId, enter, pop]);

  if (!view) return null;
  const { badge } = view;

  const cardStyle = {
    opacity: enter,
    transform: [
      { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
    ],
  };
  const emblemStyle = {
    transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
  };

  return (
    <Modal animationType="none" onRequestClose={onDismiss} transparent visible>
      <View style={styles.scrim}>
        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.eyebrow}>새 배지</Text>
          <Animated.View style={emblemStyle}>
            <BadgeEmblem
              category={badge.category}
              size={160}
              state="earned"
              tier={badge.tier}
            />
          </Animated.View>
          <Text accessibilityRole="header" style={styles.title}>
            {badge.title}
          </Text>
          <Text style={styles.body}>{badge.description}</Text>
          <Text style={styles.note}>
            {badgeTierLabels[badge.tier]} · {badgeTierNotes[badge.tier]}
          </Text>
          <Button
            label={remaining > 0 ? `다음 배지 보기 (${remaining})` : '고맙습니다'}
            onPress={onDismiss}
            style={styles.action}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: palette.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.gutter,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xl,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    ...elevation.raised,
  },
  eyebrow: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    fontWeight: fontWeight.heavy,
    letterSpacing: 1.2,
  },
  title: {
    marginTop: spacing.xs,
    textAlign: 'center',
    color: palette.ink,
    fontSize: typeScale.headline,
    lineHeight: lineHeight.headline,
    fontWeight: fontWeight.heavy,
  },
  body: {
    textAlign: 'center',
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  note: {
    textAlign: 'center',
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  action: { alignSelf: 'stretch', marginTop: spacing.sm },
});
