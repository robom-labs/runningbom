// 대회를 월별 달력처럼 훑어보는 뷰입니다. 어떤 달에 어떤 대회가 있는지 한눈에 봅니다.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, Chip } from '../../app/design-system/components';
import { palette, radius, spacing, typeScale } from '../../app/design-system/theme';
import { formatDDay, raceMonthBuckets, type RaceGroup } from './aggregate';

type Props = {
  groups: RaceGroup[];
  goalRaceId?: string;
  onSelect: (group: RaceGroup) => void;
};

const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];

function statusTone(status: string): 'positive' | 'warning' | 'neutral' {
  if (status === '접수 중') return 'positive';
  if (status === '접수 예정') return 'warning';
  return 'neutral';
}

function weekdayOf(raceDate: string): string {
  const date = new Date(`${raceDate}T00:00:00Z`);
  return weekdayNames[date.getUTCDay()] ?? '';
}

export function RaceCalendarView({ groups, goalRaceId, onSelect }: Props) {
  const buckets = useMemo(() => raceMonthBuckets(groups), [groups]);
  const [openMonth, setOpenMonth] = useState<string | undefined>(buckets[0]?.month);

  // 필터가 바뀌어 지금 펼친 달이 사라지면 첫 달로 돌아갑니다.
  useEffect(() => {
    if (buckets.length === 0) {
      setOpenMonth(undefined);
      return;
    }
    setOpenMonth((current) =>
      current && buckets.some((bucket) => bucket.month === current) ? current : buckets[0]?.month,
    );
  }, [buckets]);

  const activeBucket = buckets.find((bucket) => bucket.month === openMonth);

  if (buckets.length === 0) {
    return (
      <Card style={styles.empty}>
        <Text style={styles.emptyTitle}>조건에 맞는 대회가 없어요</Text>
        <Text style={styles.emptyBody}>필터를 줄이면 더 많은 달을 볼 수 있어요.</Text>
      </Card>
    );
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.monthRow}
      >
        {buckets.map((bucket) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: bucket.month === openMonth }}
            key={bucket.month}
            onPress={() => setOpenMonth(bucket.month)}
            style={({ pressed }) => [
              styles.monthCell,
              bucket.month === openMonth && styles.monthCellSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.monthLabel,
                bucket.month === openMonth && styles.monthLabelSelected,
              ]}
            >
              {Number(bucket.month.slice(5, 7))}월
            </Text>
            <Text
              style={[
                styles.monthCount,
                bucket.month === openMonth && styles.monthLabelSelected,
              ]}
            >
              {bucket.count}개
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {activeBucket ? (
        <Card style={styles.monthCard}>
          <Text style={styles.monthTitle}>
            {activeBucket.label} · 대회 {activeBucket.count}개
          </Text>
          {activeBucket.groups.map((group) => (
            <Pressable
              accessibilityRole="button"
              key={group.key}
              onPress={() => onSelect(group)}
              style={({ pressed }) => [
                styles.dayRow,
                group.id === goalRaceId && styles.dayRowGoal,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.dayBox}>
                <Text style={styles.dayNumber}>{Number(group.raceDate.slice(8, 10))}</Text>
                <Text style={styles.dayWeekday}>{weekdayOf(group.raceDate)}</Text>
              </View>
              <View style={styles.dayCopy}>
                <Text numberOfLines={2} style={styles.dayName}>
                  {group.name}
                </Text>
                <Text style={styles.dayMeta}>
                  {formatDDay(group.raceDate)} · {group.region} · {group.distances.join(' · ')}
                </Text>
              </View>
              <Chip label={group.status} tone={statusTone(group.status)} />
            </Pressable>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  monthRow: { flexDirection: 'row', gap: spacing.xs, paddingVertical: 2 },
  monthCell: {
    minWidth: 64,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.sm,
  },
  monthCellSelected: { backgroundColor: palette.ink, borderColor: palette.ink },
  monthLabel: { color: palette.ink, fontSize: typeScale.bodySmall, fontWeight: '900' },
  monthCount: { color: palette.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  monthLabelSelected: { color: palette.white },
  monthCard: { gap: spacing.xs },
  monthTitle: { color: palette.ink, fontSize: typeScale.body, fontWeight: '900' },
  dayRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.xs,
  },
  dayRowGoal: { backgroundColor: palette.surfaceWarm, borderRadius: radius.sm },
  dayBox: {
    width: 44,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: palette.surfaceMuted,
  },
  dayNumber: { color: palette.ink, fontSize: typeScale.titleSmall, fontWeight: '900' },
  dayWeekday: { color: palette.muted, fontSize: 10, fontWeight: '800' },
  dayCopy: { flex: 1, minWidth: 0 },
  dayName: { color: palette.ink, fontSize: typeScale.bodySmall, lineHeight: 20, fontWeight: '800' },
  dayMeta: { color: palette.muted, fontSize: typeScale.caption, marginTop: 2 },
  empty: { alignItems: 'center', gap: spacing.xs },
  emptyTitle: { color: palette.ink, fontSize: typeScale.body, fontWeight: '800' },
  emptyBody: { color: palette.muted, fontSize: typeScale.caption },
  pressed: { opacity: 0.72 },
});
