// 월간 달력 격자입니다. 활동 강도는 도트 색, 예정 일정은 테두리로 표시합니다.
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ActivityCalendarDay } from '../../../domains/activities/calendar';
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

const weekLabels = ['일', '월', '화', '수', '목', '금', '토'];

const intensityColors = [
  'transparent',
  palette.accentSoft,
  palette.accent,
  palette.accentDark,
] as const;

type Props = {
  days: ActivityCalendarDay[];
  selectedKey?: string;
  todayKey: string;
  onSelect: (key: string) => void;
};

// 42칸을 매번 다시 그리지 않도록 memo 합니다(같은 달을 다시 보면 렌더를 건너뜁니다).
export const MonthGrid = memo(function MonthGrid({ days, selectedKey, todayKey, onSelect }: Props) {
  return (
    <View style={styles.grid}>
      {weekLabels.map((label) => (
        <Text key={label} style={styles.weekLabel}>
          {label}
        </Text>
      ))}
      {days.map((day) => {
        const selected = day.key === selectedKey;
        const planned = day.plans.length > 0;
        return (
          <Pressable
            accessibilityLabel={`${day.key}${day.activities.length ? ` 활동 ${day.activities.length}건 ${day.totalMinutes}분` : ' 활동 없음'}${planned ? ` 예정 ${day.plans.length}건` : ''}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={day.key}
            onPress={() => onSelect(day.key)}
            style={({ pressed }) => [
              styles.day,
              !day.inMonth && styles.dayOutside,
              day.key === todayKey && styles.dayToday,
              planned && styles.dayPlanned,
              selected && styles.daySelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.dayNumber, !day.inMonth && styles.dayNumberOutside]}>
              {day.day}
            </Text>
            <View
              style={[
                styles.dot,
                { backgroundColor: intensityColors[day.intensity] },
                day.intensity === 0 && styles.dotEmpty,
              ]}
            />
            {day.distanceKm > 0 ? (
              <Text numberOfLines={1} style={styles.dayMeta}>
                {Math.round(day.distanceKm)}km
              </Text>
            ) : day.totalMinutes > 0 ? (
              <Text numberOfLines={1} style={styles.dayMeta}>
                {day.totalMinutes}분
              </Text>
            ) : (
              <Text style={styles.dayMeta}> </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  weekLabel: {
    width: '14.285%',
    textAlign: 'center',
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    fontWeight: fontWeight.bold,
    paddingBottom: spacing.xxs,
  },
  day: {
    width: '14.285%',
    minHeight: 60,
    alignItems: 'center',
    paddingTop: spacing.xxs,
    paddingBottom: spacing.xxs / 2,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: 'transparent',
  },
  dayOutside: { opacity: 0.4 },
  dayToday: { backgroundColor: palette.surfaceMuted },
  dayPlanned: { borderColor: palette.accent, borderStyle: 'dashed' },
  daySelected: { backgroundColor: palette.surfaceWarm, borderColor: palette.accentDark },
  dayNumber: {
    color: palette.ink,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.bold,
  },
  dayNumberOutside: { color: palette.muted },
  dot: { width: spacing.xs, height: spacing.xs, borderRadius: spacing.xxs, marginTop: spacing.xxs },
  dotEmpty: { borderColor: palette.line, borderWidth: borderWidth.thin },
  dayMeta: {
    color: palette.accentDark,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    fontWeight: fontWeight.heavy,
    marginTop: spacing.xxs / 2,
  },
  pressed: { opacity: pressedOpacity },
});

export const calendarLegend = [
  { label: '기록 없음', intensity: 0 },
  { label: '30분 미만', intensity: 1 },
  { label: '30~60분', intensity: 2 },
  { label: '60분 이상', intensity: 3 },
] as const;

export { intensityColors };
