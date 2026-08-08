// 캘린더를 독립 메뉴로 분리한 화면입니다. 월간 달력, 날짜별 상세, 일정 등록, 수동 기록을 한곳에 둡니다.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { activityCalendarMonth } from '../../../domains/activities/calendar';
import {
  currentMonth,
  currentWeekStart,
  formatDistance,
  formatDuration,
  kstDayKey,
  totalsForMonth,
  totalsForWeek,
} from '../../../domains/activities/summary';
import { activitySourceLabels } from '../../../domains/activities/types';
import { goalRaceCountdown, goalRacePhaseLabels } from '../../../domains/races/goalRace';
import { useGoalRace } from '../../../domains/races/useGoalRace';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Metric,
  SectionHeader,
  screenStyles,
} from '../../design-system/components';
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
import { useAppState } from '../../state/AppStateProvider';
import { ManualActivityCard } from '../my/ManualActivityCard';
import { calendarLegend, intensityColors, MonthGrid } from './MonthGrid';
import { PlanForm } from './PlanForm';

const kindLabels: Record<string, string> = { run: '러닝', walk: '걷기', recovery: '회복' };

function monthTitle(value: Date): string {
  return `${value.getFullYear()}년 ${value.getMonth() + 1}월`;
}

function monthKeyOf(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

export function CalendarScreen() {
  const { activities, plans, addPlan, removePlan, completeActivity } = useAppState();
  const { goalRace } = useGoalRace();
  const [month, setMonth] = useState(() => new Date());
  const todayKey = kstDayKey(new Date());
  const [selectedKey, setSelectedKey] = useState<string>(todayKey);

  const days = useMemo(
    () => activityCalendarMonth(activities, month, plans),
    [activities, month, plans],
  );
  const selected = days.find((day) => day.key === selectedKey);

  const weekTotals = useMemo(
    () => totalsForWeek(activities, currentWeekStart()),
    [activities],
  );
  const monthTotals = useMemo(
    () => totalsForMonth(activities, monthKeyOf(month)),
    [activities, month],
  );
  const viewingCurrentMonth = monthKeyOf(month) === currentMonth();
  const goalCountdown = useMemo(
    () => (goalRace ? goalRaceCountdown(goalRace.raceDate) : undefined),
    [goalRace],
  );

  return (
    <ScrollView
      contentContainerStyle={screenStyles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={screenStyles.root}
    >
      {goalRace && goalCountdown ? (
        <Card style={styles.goalCard}>
          <View style={styles.goalTop}>
            <View style={styles.goalDDay}>
              <Text style={styles.goalDDayText}>{goalCountdown.dDayLabel}</Text>
            </View>
            <Chip label={goalRacePhaseLabels[goalCountdown.phase]} tone="accent" />
          </View>
          <Text style={styles.goalName}>목표 대회 · {goalRace.name}</Text>
          <Text style={styles.goalMeta}>
            {goalRace.raceDate} · {goalRace.region} · {goalCountdown.remainingLabel}
          </Text>
          {goalCountdown.weeks > 0 ? (
            <Text style={styles.goalMeta}>
              남은 {goalCountdown.weeks}주 동안의 러닝 일정을 아래 달력에 등록해 둘 수 있어요.
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Card style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>이번 주 · {monthTitle(month)} 요약</Text>
        <View style={styles.metrics}>
          <Metric label="이번 주 횟수" value={`${weekTotals.sessions}회`} style={styles.metric} />
          <Metric
            label="이번 주 시간"
            value={formatDuration(weekTotals.minutes)}
            style={styles.metric}
          />
          <Metric
            label="이번 주 거리"
            value={formatDistance(weekTotals.distanceKm)}
            style={styles.metric}
            accent
          />
        </View>
        <View style={styles.metrics}>
          <Metric label="이 달 횟수" value={`${monthTotals.sessions}회`} style={styles.metric} />
          <Metric
            label="이 달 시간"
            value={formatDuration(monthTotals.minutes)}
            style={styles.metric}
          />
          <Metric
            label="이 달 거리"
            value={formatDistance(monthTotals.distanceKm)}
            style={styles.metric}
          />
        </View>
      </Card>

      <Card style={styles.calendarCard}>
        <View style={styles.monthHeader}>
          <Pressable
            accessibilityLabel="이전 달"
            accessibilityRole="button"
            onPress={() =>
              setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))
            }
            style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
          >
            <Text style={styles.monthButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>{monthTitle(month)}</Text>
          <Pressable
            accessibilityLabel="다음 달"
            accessibilityRole="button"
            onPress={() =>
              setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))
            }
            style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
          >
            <Text style={styles.monthButtonText}>›</Text>
          </Pressable>
        </View>
        {!viewingCurrentMonth ? (
          <Button
            label="이번 달로"
            onPress={() => setMonth(new Date())}
            style={styles.todayButton}
            tone="quiet"
          />
        ) : null}
        <MonthGrid
          days={days}
          onSelect={setSelectedKey}
          selectedKey={selectedKey}
          todayKey={todayKey}
        />
        <View style={styles.legend}>
          {calendarLegend.map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: intensityColors[item.intensity] },
                  item.intensity === 0 && styles.legendDotEmpty,
                ]}
              />
              <Text style={styles.legendLabel}>{item.label}</Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={styles.legendPlanned} />
            <Text style={styles.legendLabel}>예정 일정</Text>
          </View>
        </View>
      </Card>

      <SectionHeader
        title={selected ? `${selected.key} 상세` : '날짜를 선택해 주세요'}
        subtitle="그날의 기록과 예정된 러닝을 함께 볼 수 있어요."
      />
      {selected && selected.activities.length === 0 && selected.plans.length === 0 ? (
        <EmptyState
          title="이 날 저장된 활동이 없어요"
          body="아래 러닝 일정 등록으로 계획을 적어 두거나, 기록 추가에서 이미 달린 기록을 이 날짜로 남길 수 있어요."
          hint="지난 날짜를 골라도 그 날짜로 기록이 저장돼요."
          tone="muted"
        />
      ) : null}

      <Card style={styles.detailCard}>
        {selected && selected.activities.length > 0 ? (
          selected.activities.map((activity) => (
            <View key={activity.id} style={styles.detailRow}>
              <Text style={styles.detailTitle}>
                {kindLabels[activity.kind] ?? activity.kind} · {activity.durationMinutes}분
                {activity.distanceKm ? ` · ${formatDistance(activity.distanceKm)}` : ''}
              </Text>
              <Text style={styles.detailMeta}>
                {activitySourceLabels[activity.source]} · {activity.completedAt.slice(11, 16)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>이 날 저장된 활동이 없어요.</Text>
        )}

        {selected && selected.plans.length > 0 ? (
          <View style={styles.planList}>
            <Text style={styles.planHeading}>예정된 러닝</Text>
            {selected.plans.map((plan) => (
              <View key={plan.id} style={styles.planRow}>
                <View style={styles.planCopy}>
                  <Text style={styles.detailTitle}>{plan.title}</Text>
                  <Text style={styles.detailMeta}>
                    {kindLabels[plan.kind] ?? plan.kind}
                    {plan.targetMinutes ? ` · ${plan.targetMinutes}분 예정` : ''}
                    {plan.targetDistanceKm ? ` · ${formatDistance(plan.targetDistanceKm)} 예정` : ''}
                  </Text>
                </View>
                <Button label="삭제" onPress={() => void removePlan(plan.id)} tone="quiet" />
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <PlanForm
        date={selectedKey || todayKey}
        onSave={async (value) => {
          await addPlan(value);
        }}
      />

      <SectionHeader title="기록 추가" subtitle="지금 바로 직접 입력해 저장할 수 있어요." />
      <ManualActivityCard
        onSave={async (input) => {
          await completeActivity({
            ...input,
            source: 'SELF_LOGGED',
            ...(selectedKey && selectedKey !== todayKey
              ? { completedAt: new Date(`${selectedKey}T12:00:00+09:00`).toISOString() }
              : {}),
          });
        }}
      />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  goalCard: {
    gap: spacing.xxs,
    backgroundColor: palette.surfaceWarm,
    borderColor: palette.accent,
    borderWidth: borderWidth.thin,
  },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  goalDDay: {
    minHeight: 30,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: palette.accentStrong,
    paddingHorizontal: spacing.sm,
  },
  goalDDayText: {
    color: palette.white,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.heavy,
  },
  goalName: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
    marginTop: spacing.xs,
  },
  goalMeta: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  summaryCard: { gap: spacing.sm },
  summaryTitle: {
    color: palette.ink,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.heavy,
  },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  metric: { flex: 1, minWidth: 0 },
  calendarCard: { gap: spacing.sm },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
  },
  monthButton: {
    minWidth: layout.touchTarget,
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: palette.line,
    borderWidth: borderWidth.thin,
    borderRadius: radius.sm,
  },
  monthButtonText: {
    color: palette.ink,
    fontSize: typeScale.title,
    lineHeight: lineHeight.title,
    fontWeight: fontWeight.semibold,
  },
  todayButton: { alignSelf: 'flex-start', minWidth: 110 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  legendDot: { width: spacing.xs, height: spacing.xs, borderRadius: spacing.xxs },
  legendDotEmpty: { borderColor: palette.line, borderWidth: borderWidth.thin },
  legendPlanned: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: spacing.xxs,
    borderColor: palette.accent,
    borderStyle: 'dashed',
    borderWidth: borderWidth.thin,
  },
  legendLabel: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    fontWeight: fontWeight.semibold,
  },
  detailCard: { gap: spacing.sm },
  detailRow: { gap: spacing.xxs / 2 },
  detailTitle: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.bold,
  },
  detailMeta: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  emptyText: {
    color: palette.muted,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  planList: {
    gap: spacing.xs,
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  planHeading: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.heavy,
  },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planCopy: { flex: 1, minWidth: 0 },
  pressed: { opacity: pressedOpacity },
});
