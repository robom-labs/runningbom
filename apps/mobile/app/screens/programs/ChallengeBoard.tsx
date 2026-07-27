// 지금 하고 있는 도전을 보여 주는 곳입니다.
//
// 여기서 하는 일은 "이미 남긴 기록을 해석해서 보여 주는 것" 하나뿐입니다.
// 도전이 훈련량을 늘리라고 시키지 않고, 계획을 바꾸지도 않습니다.
// 그래서 따로 저장할 것도, 가입할 것도 없습니다. 기록만 있으면 저절로 채워집니다.
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, ProgressBar, SectionHeader } from '../../design-system/components';
import {
  fontWeight,
  lineHeight,
  palette,
  spacing,
  typeScale,
} from '../../design-system/theme';
import type { ActivityRecord } from '../../../domains/activities/types';
import {
  activeChallenges,
  challengeCategoryLabels,
  challengeWindowLabels,
  type ChallengeProgress,
} from '../../../domains/challenges/library';

export type ChallengeBoardProps = {
  activities: ActivityRecord[];
  /** 지금 시각입니다. 테스트에서 고정할 수 있게 밖에서 받습니다. */
  now?: Date;
};

export function ChallengeBoard({ activities, now }: ChallengeBoardProps) {
  const at = now ?? new Date();
  const items = useMemo(
    () => activeChallenges(activities, at),
    // 시각은 초 단위로 바뀌므로 날짜만 열쇠로 씁니다. 1초마다 다시 계산할 이유가 없습니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activities, at.toISOString().slice(0, 10)],
  );

  if (items.length === 0) return null;

  return (
    <View style={styles.root}>
      <SectionHeader
        subtitle="기록을 남기면 저절로 채워져요. 따로 신청할 것 없어요."
        title="지금 하는 도전"
      />
      {items.map((item) => (
        <ChallengeRow item={item} key={item.challenge.id} />
      ))}
    </View>
  );
}

function ChallengeRow({ item }: { item: ChallengeProgress }) {
  return (
    <Card style={styles.card} tone={item.achieved ? 'warm' : 'default'}>
      <Text style={styles.meta}>
        {`${challengeWindowLabels[item.challenge.window]} · ${
          challengeCategoryLabels[item.challenge.category]
        }`}
      </Text>
      <Text style={styles.title}>{item.challenge.title}</Text>
      <Text style={styles.description}>{item.challenge.description}</Text>
      <ProgressBar
        label={`${item.challenge.title} ${item.label}`}
        ratio={item.ratio}
        tone={item.achieved ? 'positive' : 'accent'}
      />
      <View style={styles.footRow}>
        <Text style={styles.value}>{item.label}</Text>
        <Text style={[styles.note, item.achieved && styles.noteDone]}>{item.note}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  card: { gap: spacing.xxs },
  meta: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    fontWeight: fontWeight.bold,
  },
  title: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.bold,
  },
  description: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    paddingBottom: spacing.xxs,
  },
  footRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xxs,
  },
  value: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    fontWeight: fontWeight.bold,
  },
  note: {
    color: palette.muted,
    fontSize: typeScale.caption,
    flexShrink: 1,
    textAlign: 'right',
  },
  noteDone: { color: palette.accentDark, fontWeight: fontWeight.bold },
});
