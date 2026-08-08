// 대회를 거리별 행이 아닌 대회 1건으로 세어 월간 7열 달력과 선택 날짜 목록을 보여줍니다.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, Chip } from '../../app/design-system/components';
import { palette, radius, spacing, typeScale } from '../../app/design-system/theme';
import {
  buildRaceCalendarMonth,
  formatDDay,
  raceGroupsForDate,
  raceMonthBuckets,
  type RaceGroup,
} from './aggregate';

type Props = {
  groups: RaceGroup[];
  goalRaceId?: string;
  onSelect: (group: RaceGroup) => void;
};

const calendarWeekdays = ['일', '월', '화', '수', '목', '금', '토'] as const;

function statusTone(status: string): 'positive' | 'warning' | 'neutral' {
  if (status === '접수 중') return 'positive';
  if (status === '접수 예정') return 'warning';
  return 'neutral';
}

export function RaceCalendarView({ groups, goalRaceId, onSelect }: Props) {
  const buckets = useMemo(() => raceMonthBuckets(groups), [groups]);
  const [openMonth, setOpenMonth] = useState<string | undefined>(buckets[0]?.month);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(buckets[0]?.groups[0]?.raceDate);

  // 필터가 바뀌어 현재 달이 사라지면 가장 가까운 대회가 있는 달로 이동합니다.
  useEffect(() => {
    if (buckets.length === 0) {
      setOpenMonth(undefined);
      setSelectedDate(undefined);
      return;
    }
    setOpenMonth((current) =>
      current && buckets.some((bucket) => bucket.month === current) ? current : buckets[0]?.month,
    );
  }, [buckets]);

  const activeBucket = buckets.find((bucket) => bucket.month === openMonth);
  const calendar = useMemo(
    () => (openMonth ? buildRaceCalendarMonth(groups, openMonth) : null),
    [groups, openMonth],
  );

  useEffect(() => {
    if (!activeBucket) {
      setSelectedDate(undefined);
      return;
    }
    setSelectedDate((current) =>
      current && activeBucket.groups.some((group) => group.raceDate === current)
        ? current
        : activeBucket.groups[0]?.raceDate,
    );
  }, [activeBucket]);

  const selectedGroups = useMemo(
    () => (selectedDate ? raceGroupsForDate(groups, selectedDate) : []),
    [groups, selectedDate],
  );

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
            accessibilityLabel={`${bucket.label} 대회 ${bucket.count}개`}
            accessibilityRole="button"
            accessibilityState={{ selected: bucket.month === openMonth }}
            key={bucket.month}
            onPress={() => {
              setOpenMonth(bucket.month);
              setSelectedDate(bucket.groups[0]?.raceDate);
            }}
            style={({ pressed }) => [
              styles.monthCell,
              bucket.month === openMonth && styles.monthCellSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.monthLabel, bucket.month === openMonth && styles.monthLabelSelected]}>
              {Number(bucket.month.slice(5, 7))}월
            </Text>
            <Text style={[styles.monthCount, bucket.month === openMonth && styles.monthLabelSelected]}>
              {bucket.count}개
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {calendar && activeBucket ? (
        <Card style={styles.monthCard}>
          <View style={styles.calendarHeader}>
            <View>
              <Text style={styles.calendarEyebrow}>대회 달력</Text>
              <Text style={styles.monthTitle}>{calendar.label}</Text>
            </View>
            <Text style={styles.totalCount}>대회 {activeBucket.count}개</Text>
          </View>

          <View accessibilityElementsHidden style={styles.weekRow}>
            {calendarWeekdays.map((label, index) => (
              <Text
                key={label}
                style={[
                  styles.weekLabel,
                  index === 0 && styles.sunday,
                  index === 6 && styles.saturday,
                ]}
              >
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {calendar.cells.map((cell, index) => {
              if (!cell.inMonth) return <View key={`blank-${index}`} style={styles.dayCell} />;
              const enabled = cell.groupCount > 0;
              const selected = selectedDate === cell.key;
              const goalOnDay = Boolean(goalRaceId && groups.some(
                (group) => group.raceDate === cell.key && group.raceIds.includes(goalRaceId),
              ));
              return (
                <Pressable
                  accessibilityLabel={`${cell.day}일 ${enabled ? `대회 ${cell.groupCount}개` : '대회 없음'}${goalOnDay ? ' 목표 대회 있음' : ''}`}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !enabled, selected }}
                  disabled={!enabled}
                  key={cell.key}
                  onPress={() => setSelectedDate(cell.key)}
                  style={({ pressed }) => [
                    styles.dayCell,
                    enabled && styles.dayCellEnabled,
                    cell.today && styles.dayCellToday,
                    selected && styles.dayCellSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.dayNumber, selected && styles.dayNumberSelected]}>{cell.day}</Text>
                  {enabled ? (
                    <View style={[styles.dayCount, selected && styles.dayCountSelected]}>
                      <Text style={[styles.dayCountText, selected && styles.dayCountTextSelected]}>
                        {cell.groupCount}
                      </Text>
                    </View>
                  ) : null}
                  {goalOnDay ? <View accessibilityElementsHidden style={styles.goalDot} /> : null}
                </Pressable>
              );
            })}
          </View>

          {selectedDate ? (
            <View style={styles.selectedSection}>
              <Text style={styles.selectedTitle}>
                {Number(selectedDate.slice(5, 7))}월 {Number(selectedDate.slice(8, 10))}일 · 대회 {selectedGroups.length}개
              </Text>
              {selectedGroups.map((group) => {
                const goal = Boolean(goalRaceId && group.raceIds.includes(goalRaceId));
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={group.key}
                    onPress={() => onSelect(group)}
                    style={({ pressed }) => [
                      styles.raceRow,
                      goal && styles.raceRowGoal,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.raceCopy}>
                      <Text numberOfLines={2} style={styles.raceName}>{group.name}</Text>
                      <Text style={styles.raceMeta}>
                        {formatDDay(group.raceDate)} · {group.region} · {group.distances.join(' · ')}
                      </Text>
                    </View>
                    <Chip label={goal ? '목표 대회' : group.status} tone={goal ? 'warning' : statusTone(group.status)} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}
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
  calendarHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  calendarEyebrow: { color: palette.accentDark, fontSize: 11, fontWeight: '900' },
  monthTitle: { color: palette.ink, fontSize: typeScale.body, fontWeight: '900', marginTop: 2 },
  totalCount: { color: palette.inkSoft, fontSize: typeScale.caption, fontWeight: '800' },
  weekRow: { flexDirection: 'row', marginTop: spacing.xs },
  weekLabel: {
    width: '14.2857%',
    color: palette.muted,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  sunday: { color: palette.danger },
  saturday: { color: palette.navy },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: '14.2857%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.sm,
    borderColor: 'transparent',
    borderWidth: 1,
  },
  dayCellEnabled: { backgroundColor: palette.surfaceMuted },
  dayCellToday: { borderColor: palette.accent, borderWidth: 2 },
  dayCellSelected: { backgroundColor: palette.ink, borderColor: palette.ink },
  dayNumber: { color: palette.inkSoft, fontSize: typeScale.caption, fontWeight: '900' },
  dayNumberSelected: { color: palette.white },
  dayCount: {
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: palette.accentSoft,
    paddingHorizontal: 4,
  },
  dayCountSelected: { backgroundColor: palette.white },
  dayCountText: { color: palette.accentDark, fontSize: 9, fontWeight: '900' },
  dayCountTextSelected: { color: palette.ink },
  goalDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: palette.accent },
  selectedSection: {
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  selectedTitle: { color: palette.ink, fontSize: typeScale.bodySmall, fontWeight: '900' },
  raceRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.xs,
  },
  raceRowGoal: { backgroundColor: palette.surfaceWarm, borderRadius: radius.sm },
  raceCopy: { flex: 1, minWidth: 0 },
  raceName: { color: palette.ink, fontSize: typeScale.bodySmall, lineHeight: 20, fontWeight: '800' },
  raceMeta: { color: palette.muted, fontSize: typeScale.caption, marginTop: 2 },
  empty: { alignItems: 'center', gap: spacing.xs },
  emptyTitle: { color: palette.ink, fontSize: typeScale.body, fontWeight: '800' },
  emptyBody: { color: palette.muted, fontSize: typeScale.caption },
  pressed: { opacity: 0.72 },
});
