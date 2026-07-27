// 배지를 눌렀을 때 뜨는 상세입니다. 큰 엠블럼, 이름, 조건, 받은 날짜, 진행률을 한 장에 담습니다.
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Chip, ProgressBar } from '../../design-system/components';
import { BadgeEmblem } from '../../design-system/emblem';
import {
  elevation,
  fontWeight,
  layout,
  lineHeight,
  palette,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';
import { badgeCategoryLabels, badgeTierLabels, badgeTierNotes } from '../../../domains/badges/rules';
import type { BadgeView } from '../../../domains/badges/presentation';

type BadgeDetailProps = {
  view?: BadgeView;
  featured: boolean;
  onClose: () => void;
  onFeature?: (badgeId: string) => void;
};

export function BadgeDetail({ view, featured, onClose, onFeature }: BadgeDetailProps) {
  if (!view) return null;
  const { badge, state } = view;
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <Pressable accessibilityLabel="닫기" onPress={onClose} style={styles.scrim}>
        <Pressable onPress={() => undefined} style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.sheetBody}>
            <BadgeEmblem
              category={badge.category}
              ratio={view.ratio}
              size={148}
              state={state}
              tier={badge.tier}
            />
            <Text accessibilityRole="header" style={styles.title}>
              {badge.title}
            </Text>
            <View style={styles.chips}>
              <Chip label={badgeCategoryLabels[badge.category]} />
              {state === 'earned' ? (
                <Chip label={badgeTierLabels[badge.tier]} tone="positive" />
              ) : (
                <Chip label={state === 'progress' ? '진행 중' : '아직 잠김'} />
              )}
            </View>
            <Text style={styles.body}>{badge.description}</Text>
            {state === 'earned' ? (
              <>
                <Text style={styles.note}>{badgeTierNotes[badge.tier]}</Text>
                {view.earnedLabel ? (
                  <Text style={styles.meta}>받은 날 · {view.earnedLabel}</Text>
                ) : null}
              </>
            ) : (
              <View style={styles.progressBlock}>
                <ProgressBar label={view.progressLabel} ratio={view.ratio} />
                <Text style={styles.note}>{view.hintLabel}</Text>
              </View>
            )}
            {state === 'earned' && onFeature ? (
              <Button
                label={featured ? '대표 배지예요' : '대표 배지로 두기'}
                onPress={() => onFeature(badge.id)}
                tone={featured ? 'quiet' : 'secondary'}
              />
            ) : null}
            <Button label="닫기" onPress={onClose} tone="quiet" />
          </ScrollView>
        </Pressable>
      </Pressable>
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
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '86%',
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    ...elevation.raised,
  },
  sheetBody: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  title: {
    textAlign: 'center',
    color: palette.ink,
    fontSize: typeScale.title,
    lineHeight: lineHeight.title,
    fontWeight: fontWeight.heavy,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
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
  meta: {
    textAlign: 'center',
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  progressBlock: { alignSelf: 'stretch', gap: spacing.xs },
});
