// 홈의 "이번 달 지도"입니다. 알(egg) 대신 쓰는 성장 표시입니다.
//
// 알은 깨지면 끝이라, 필연적으로 "연속으로 안 하면 잃는다"는 장치가 붙습니다.
// 그 장치는 아픈 날에도 뛰게 만듭니다. 지도는 다릅니다 — **쉰다고 사라지지 않습니다.**
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, ProgressBar } from '../../design-system/components';
import {
  fontWeight,
  lineHeight,
  palette,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';
import type { ActivityRecord } from '../../../domains/activities/types';
import { MONTH_MAP_NOTE, monthMap, terrains } from '../../../domains/growth/monthMap';

export type MonthMapCardProps = {
  activities: ActivityRecord[];
  now?: Date;
};

export function MonthMapCard({ activities, now }: MonthMapCardProps) {
  const at = now ?? new Date();
  const map = useMemo(
    () => monthMap(activities, at),
    // 지도는 하루 안에서 여러 번 바뀔 이유가 없습니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activities, at.toISOString().slice(0, 10)],
  );

  return (
    <Card style={styles.card}>
      <Text style={styles.eyebrow}>{`${at.getMonth() + 1}월 지도`}</Text>
      <Text style={styles.title}>{map.headline}</Text>
      <Text style={styles.note}>{map.note}</Text>

      {/* 다섯 칸 — 지나온 곳은 채워지고, 지금 자리는 테두리가 생깁니다. */}
      <View accessibilityLabel={`${map.headline}까지 왔어요`} style={styles.trail}>
        {terrains.map((terrain) => {
          const passed = map.minutes >= terrain.minutes;
          const here = terrain.id === map.current.id;
          return (
            <View key={terrain.id} style={styles.stop}>
              <View style={[styles.dot, passed && styles.dotOn, here && styles.dotHere]} />
              <Text
                numberOfLines={1}
                style={[styles.stopLabel, passed && styles.stopLabelOn]}
              >
                {terrain.label}
              </Text>
            </View>
          );
        })}
      </View>

      {map.next ? (
        <ProgressBar
          label={`${map.next.label}까지 ${map.remainingMinutes}분`}
          ratio={map.ratio}
          tone="accent"
        />
      ) : null}

      <Text style={styles.stats}>
        {`이번 달 ${map.minutes}분 · ${map.activeDays}일 움직였어요`}
      </Text>
      {/* 쉰 것을 벌하지 않습니다. 이 한 줄이 그 약속입니다. */}
      <Text style={styles.promise}>{MONTH_MAP_NOTE}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xxs },
  eyebrow: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    fontWeight: fontWeight.bold,
  },
  title: {
    color: palette.ink,
    fontSize: typeScale.title,
    lineHeight: lineHeight.title,
    fontWeight: fontWeight.heavy,
  },
  note: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    paddingBottom: spacing.xs,
  },
  trail: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: spacing.xs,
  },
  stop: { flex: 1, alignItems: 'center', gap: spacing.xxs },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: palette.line,
  },
  dotOn: { backgroundColor: palette.accent },
  dotHere: {
    backgroundColor: palette.accentStrong,
    transform: [{ scale: 1.4 }],
  },
  stopLabel: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    textAlign: 'center',
  },
  stopLabelOn: { color: palette.inkSoft, fontWeight: fontWeight.bold },
  stats: { color: palette.inkSoft, fontSize: typeScale.caption },
  promise: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
  },
});
