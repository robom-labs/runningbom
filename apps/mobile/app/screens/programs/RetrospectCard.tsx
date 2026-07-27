// 회차를 마친 직후 한 번 묻는 회고입니다.
//
// 이모지가 아니라 **말**로 고릅니다. 셋이면 헷갈리지 않고, 말이면 뜻이 하나입니다.
// 그리고 여기서 고른 값이 **내일 제안을 실제로 바꿉니다**(`domains/today/suggest.ts`).
//
// 건너뛸 수 있어야 합니다. 답해야만 넘어가는 화면은 다음부터 앱을 안 켜게 만듭니다.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '../../design-system/components';
import {
  borderWidth,
  fontWeight,
  layout,
  lineHeight,
  palette,
  pressedOpacity,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';
import {
  bodyTags,
  effortChoices,
  toggleBodyTag,
  type BodyTagId,
  type EffortId,
  type Retrospect,
} from '../../../domains/activities/retrospect';

export type RetrospectCardProps = {
  onSave: (value: Retrospect) => void;
  onSkip: () => void;
};

export function RetrospectCard({ onSave, onSkip }: RetrospectCardProps) {
  const [effort, setEffort] = useState<EffortId | undefined>(undefined);
  const [tagIds, setTagIds] = useState<BodyTagId[]>([]);

  return (
    <Card elevated style={styles.card}>
      <Text style={styles.title}>오늘 어땠어요?</Text>
      <Text style={styles.lead}>
        여기 답해 주시면 다음 제안이 달라져요. 지금 안 하셔도 괜찮아요.
      </Text>

      <View accessibilityRole="radiogroup" style={styles.list}>
        {effortChoices.map((choice) => {
          const selected = effort === choice.id;
          return (
            <Pressable
              accessibilityLabel={`${choice.label}, ${choice.hint}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={choice.id}
              onPress={() => setEffort(choice.id)}
              style={({ pressed }) => [
                styles.row,
                selected && styles.rowOn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.rowLabel, selected && styles.rowLabelOn]}>{choice.label}</Text>
              <Text style={styles.rowHint}>{choice.hint}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.subTitle}>몸은 어땠어요?</Text>
      <View style={styles.tags}>
        {bodyTags.map((tag) => {
          const selected = tagIds.includes(tag.id);
          return (
            <Pressable
              accessibilityLabel={tag.label}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              key={tag.id}
              onPress={() => setTagIds((current) => toggleBodyTag(current, tag.id))}
              style={({ pressed }) => [
                styles.tag,
                selected && styles.tagOn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.tagText, selected && styles.tagTextOn]}>{tag.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Button
        disabled={!effort}
        label="남기기"
        onPress={() => {
          if (!effort) return;
          onSave({ effort, bodyTagIds: tagIds });
        }}
        size="lg"
        testID="retrospect-save"
      />
      {/* 건너뛰기가 없으면, 답하기 싫은 날에 앱을 아예 안 켜게 됩니다. */}
      <Button label="지금은 넘어갈게요" onPress={onSkip} tone="quiet" />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  title: {
    color: palette.ink,
    fontSize: typeScale.title,
    lineHeight: lineHeight.title,
    fontWeight: fontWeight.heavy,
  },
  lead: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    paddingBottom: spacing.xxs,
  },
  subTitle: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    fontWeight: fontWeight.bold,
    paddingTop: spacing.xs,
  },
  list: { gap: spacing.xs },
  row: {
    minHeight: layout.touchTarget,
    justifyContent: 'center',
    gap: 2,
    borderColor: palette.line,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rowOn: { borderColor: palette.accentStrong, backgroundColor: palette.accentSoft },
  pressed: { opacity: pressedOpacity },
  rowLabel: { color: palette.ink, fontSize: typeScale.body, fontWeight: fontWeight.bold },
  rowLabelOn: { color: palette.accentDark },
  rowHint: { color: palette.muted, fontSize: typeScale.caption },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs },
  tag: {
    minHeight: 40,
    justifyContent: 'center',
    borderColor: palette.line,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    paddingHorizontal: spacing.sm,
  },
  tagOn: { borderColor: palette.accentStrong, backgroundColor: palette.accentSoft },
  tagText: { color: palette.inkSoft, fontSize: typeScale.caption, fontWeight: fontWeight.medium },
  tagTextOn: { color: palette.accentDark, fontWeight: fontWeight.bold },
});
