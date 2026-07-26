// 저장된 러닝·걷기·회복 기록을 월간 달력에서 확인하는 화면 조각입니다.
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { activityCalendarMonth } from '../../../domains/activities/calendar';
import type { ActivityRecord } from '../../../domains/activities/types';
import { Card } from '../../design-system/components';
import { palette, radius, spacing, typeScale } from '../../design-system/theme';

const weekLabels = ['일', '월', '화', '수', '목', '금', '토'];

function monthTitle(value: Date) {
  return `${value.getFullYear()}년 ${value.getMonth() + 1}월`;
}

export function ActivityCalendar({ activities }: { activities: ActivityRecord[] }) {
  const [month, setMonth] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState<string>();
  const days = useMemo(() => activityCalendarMonth(activities, month), [activities, month]);
  const selected = days.find((day) => day.key === selectedKey);

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="이전 달" onPress={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))} style={styles.monthButton}>
          <Text style={styles.monthButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{monthTitle(month)}</Text>
        <Pressable accessibilityLabel="다음 달" onPress={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))} style={styles.monthButton}>
          <Text style={styles.monthButtonText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {weekLabels.map((label) => <Text key={label} style={styles.weekLabel}>{label}</Text>)}
        {days.map((day) => {
          const active = day.activities.length > 0;
          const selectedDay = day.key === selectedKey;
          return (
            <Pressable
              key={day.key}
              accessibilityLabel={`${day.key}${active ? ` 활동 ${day.activities.length}건` : ''}`}
              onPress={() => setSelectedKey(day.key)}
              style={[styles.day, !day.inMonth && styles.dayOutside, selectedDay && styles.daySelected]}
            >
              <Text style={[styles.dayNumber, !day.inMonth && styles.dayNumberOutside]}>{day.day}</Text>
              {active ? <View style={styles.dayMarker}><Text style={styles.dayMinutes}>{day.totalMinutes}분</Text></View> : null}
            </Pressable>
          );
        })}
      </View>
      {selected ? (
        <View style={styles.detail}>
          <Text style={styles.detailTitle}>{selected.key}</Text>
          {selected.activities.length ? (
            <Text style={styles.detailBody}>
              {selected.activities.length}회 · {selected.totalMinutes}분{selected.distanceKm > 0 ? ` · ${selected.distanceKm.toFixed(1)}km` : ''}
            </Text>
          ) : <Text style={styles.detailBody}>저장된 활동이 없어요.</Text>}
        </View>
      ) : <Text style={styles.hint}>날짜를 누르면 그날의 활동 요약을 볼 수 있어요.</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: palette.ink, fontSize: typeScale.body, fontWeight: '900' },
  monthButton: { alignItems: 'center', borderColor: palette.line, borderRadius: radius.sm, borderWidth: 1, height: 38, justifyContent: 'center', width: 38 },
  monthButtonText: { color: palette.ink, fontSize: 24, fontWeight: '700' },
  grid: { alignItems: 'stretch', flexDirection: 'row', flexWrap: 'wrap' },
  weekLabel: { color: palette.muted, fontSize: 11, fontWeight: '800', paddingBottom: 6, textAlign: 'center', width: '14.285%' },
  day: { alignItems: 'center', borderRadius: radius.sm, minHeight: 54, paddingTop: 5, width: '14.285%' },
  dayOutside: { opacity: 0.35 },
  daySelected: { backgroundColor: palette.surfaceWarm },
  dayNumber: { color: palette.ink, fontSize: typeScale.caption, fontWeight: '800' },
  dayNumberOutside: { color: palette.muted },
  dayMarker: { alignItems: 'center', backgroundColor: palette.accentSoft, borderRadius: 10, marginTop: 4, minWidth: 28, paddingHorizontal: 3, paddingVertical: 2 },
  dayMinutes: { color: palette.accentDark, fontSize: 9, fontWeight: '900' },
  detail: { borderTopColor: palette.line, borderTopWidth: StyleSheet.hairlineWidth, gap: 2, paddingTop: spacing.sm },
  detailTitle: { color: palette.ink, fontSize: typeScale.caption, fontWeight: '900' },
  detailBody: { color: palette.inkSoft, fontSize: typeScale.caption, lineHeight: 18 },
  hint: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 18 },
});
