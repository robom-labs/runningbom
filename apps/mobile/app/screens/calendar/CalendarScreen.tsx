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
import { Banner, Button, Card, Metric, SectionHeader } from '../../design-system/components';
import { palette, radius, spacing, typeScale } from '../../design-system/theme';
import { useAppState } from '../../state/AppStateProvider';
import { ManualActivityCard } from '../my/ManualActivityCard';
import { calendarLegend, intensityColors, MonthGrid } from './MonthGrid';
import { PlanForm } from './PlanForm';

const kindLabels: Record<string, string> = { run: '러닝', walk: '걷기', recovery: '회복' };

// 외부 서비스 연동은 공식 파트너 승인과 OAuth 자격증명이 있어야 열 수 있습니다.
const integrations = [
  {
    id: 'samsung-health',
    name: '삼성 헬스',
    requirement: 'Samsung Health Data SDK 파트너 승인과 앱 등록이 필요해요.',
  },
  {
    id: 'garmin',
    name: 'Garmin Connect',
    requirement: 'Garmin Connect Developer Program 승인과 OAuth 키 발급이 필요해요.',
  },
  {
    id: 'nike-run-club',
    name: 'Nike Run Club',
    requirement: '공개 API가 없어 Nike의 별도 데이터 제휴 승인이 필요해요.',
  },
];

function monthTitle(value: Date): string {
  return `${value.getFullYear()}년 ${value.getMonth() + 1}월`;
}

function monthKeyOf(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

export function CalendarScreen() {
  const { activities, plans, addPlan, removePlan, completeActivity } = useAppState();
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

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
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

      <SectionHeader title="외부 기록 연동" subtitle="연결되지 않은 것은 연결되지 않았다고 적어요." />
      <Card style={styles.integrationCard}>
        <Banner
          title="연동 준비 중"
          body="삼성 헬스·Garmin·Nike Run Club 자동 가져오기는 아직 연결되지 않았어요. 지금은 러닝봄 코치 기록과 직접 입력만 저장됩니다."
          tone="warning"
        />
        {integrations.map((item) => (
          <View key={item.id} style={styles.integrationRow}>
            <View style={styles.integrationCopy}>
              <Text style={styles.detailTitle}>{item.name}</Text>
              <Text style={styles.detailMeta}>{item.requirement}</Text>
            </View>
            <View style={styles.integrationBadge}>
              <Text style={styles.integrationBadgeText}>준비 중</Text>
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  content: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  summaryCard: { gap: spacing.sm },
  summaryTitle: { color: palette.ink, fontSize: typeScale.body, fontWeight: '900' },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  metric: { flex: 1, minWidth: 0 },
  calendarCard: { gap: spacing.sm },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { color: palette.ink, fontSize: typeScale.titleSmall, fontWeight: '900' },
  monthButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  monthButtonText: { color: palette.ink, fontSize: 24, fontWeight: '700' },
  todayButton: { alignSelf: 'flex-start', minWidth: 110 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendDotEmpty: { borderColor: palette.line, borderWidth: 1 },
  legendPlanned: {
    width: 12,
    height: 12,
    borderRadius: 4,
    borderColor: palette.accent,
    borderStyle: 'dashed',
    borderWidth: 1,
  },
  legendLabel: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  detailCard: { gap: spacing.sm },
  detailRow: { gap: 2 },
  detailTitle: { color: palette.ink, fontSize: typeScale.bodySmall, fontWeight: '800' },
  detailMeta: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 18 },
  emptyText: { color: palette.muted, fontSize: typeScale.bodySmall },
  planList: {
    gap: spacing.xs,
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  planHeading: { color: palette.accentDark, fontSize: typeScale.caption, fontWeight: '900' },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planCopy: { flex: 1, minWidth: 0 },
  integrationCard: { gap: spacing.sm },
  integrationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  integrationCopy: { flex: 1, minWidth: 0 },
  integrationBadge: {
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  integrationBadgeText: { color: palette.inkSoft, fontSize: 11, fontWeight: '900' },
  pressed: { opacity: 0.7 },
});
