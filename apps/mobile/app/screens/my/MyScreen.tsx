// 기록·통계 화면입니다. 주간·월간 요약, 주간 목표, 배지, 활동 목록을 한곳에 모읍니다.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  Chip,
  Metric,
  ProgressBar,
  SectionHeader,
} from '../../design-system/components';
import { palette, radius, spacing, typeScale } from '../../design-system/theme';
import { activitySourceLabels } from '../../../domains/activities/types';
import {
  currentMonth,
  currentWeekStart,
  formatDistance,
  formatDuration,
  recentWeeklyAverage,
  totalsForMonth,
  totalsForWeek,
} from '../../../domains/activities/summary';
import {
  currentWeekProgress,
  goalMetricLabels,
  goalMetricUnits,
  recommendWeeklyGoal,
  type GoalMetric,
} from '../../../domains/badges/goals';
import {
  BADGE_RULE_VERSION,
  badgeCategoryLabels,
  badgeCategoryOrder,
  type BadgeCategory,
} from '../../../domains/badges/rules';
import { useAppState } from '../../state/AppStateProvider';
import { ManualActivityCard } from './ManualActivityCard';

const kindLabels: Record<string, string> = { run: '러닝', walk: '걷기', recovery: '회복' };
const metricChoices: GoalMetric[] = ['sessions', 'minutes', 'distance'];
const metricSteps: Record<GoalMetric, number> = { sessions: 1, minutes: 10, distance: 1 };

export function MyScreen({ onOpenCalendar }: { onOpenCalendar: () => void }) {
  const {
    activities,
    streak,
    badgeProgress,
    weeklyGoal,
    setWeeklyGoal,
    applyRecommendedGoal,
    completeActivity,
    preferences,
    updatePreferences,
    storageError,
  } = useAppState();
  const [openCategory, setOpenCategory] = useState<BadgeCategory | 'all'>('all');
  const [showAllActivities, setShowAllActivities] = useState(false);

  const weekTotals = useMemo(() => totalsForWeek(activities, currentWeekStart()), [activities]);
  const monthTotals = useMemo(() => totalsForMonth(activities, currentMonth()), [activities]);
  const average = useMemo(() => recentWeeklyAverage(activities), [activities]);
  const progress = useMemo(
    () => currentWeekProgress(activities, weeklyGoal),
    [activities, weeklyGoal],
  );
  const recommended = useMemo(() => recommendWeeklyGoal(activities), [activities]);

  const unlockedCount = badgeProgress.filter((entry) => entry.unlocked).length;
  const groupedBadges = useMemo(() => {
    const visible =
      openCategory === 'all'
        ? badgeProgress
        : badgeProgress.filter((entry) => entry.badge.category === openCategory);
    return badgeCategoryOrder
      .map((category) => ({
        category,
        entries: visible.filter((entry) => entry.badge.category === category),
      }))
      .filter((group) => group.entries.length > 0);
  }, [badgeProgress, openCategory]);

  const latestActivities = showAllActivities ? activities.slice(0, 40) : activities.slice(0, 5);

  function adjustTarget(direction: 1 | -1) {
    const step = metricSteps[weeklyGoal.metric] * direction;
    const next = Math.max(1, Math.round((weeklyGoal.target + step) * 10) / 10);
    void setWeeklyGoal({ metric: weeklyGoal.metric, target: next, auto: false });
  }

  function chooseMetric(metric: GoalMetric) {
    const suggestion = recommendWeeklyGoal(activities);
    void setWeeklyGoal({
      metric,
      target: suggestion.metric === metric ? suggestion.target : weeklyGoal.target,
      auto: false,
    });
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
      {storageError ? <Banner title="저장 상태 안내" body={storageError} tone="warning" /> : null}

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>이번 주</Text>
        <View style={styles.metrics}>
          <Metric label="횟수" value={`${weekTotals.sessions}회`} style={styles.metric} />
          <Metric label="시간" value={formatDuration(weekTotals.minutes)} style={styles.metric} />
          <Metric
            accent
            label="거리"
            value={formatDistance(weekTotals.distanceKm)}
            style={styles.metric}
          />
        </View>
        <Text style={styles.cardTitle}>이번 달</Text>
        <View style={styles.metrics}>
          <Metric label="횟수" value={`${monthTotals.sessions}회`} style={styles.metric} />
          <Metric label="시간" value={formatDuration(monthTotals.minutes)} style={styles.metric} />
          <Metric
            label="거리"
            value={formatDistance(monthTotals.distanceKm)}
            style={styles.metric}
          />
        </View>
        <Button label="캘린더에서 보기" onPress={onOpenCalendar} tone="secondary" />
      </Card>

      <SectionHeader
        title="이번 주 목표"
        subtitle="횟수·시간·거리 중에서 고르거나 최근 4주 평균으로 추천받을 수 있어요."
      />
      <Card style={styles.card}>
        <View accessibilityRole="tablist" style={styles.chipRow}>
          {metricChoices.map((metric) => (
            <Chip
              accessibilityRole="tab"
              key={metric}
              label={goalMetricLabels[metric]}
              onPress={() => chooseMetric(metric)}
              selected={weeklyGoal.metric === metric}
              tone="accent"
            />
          ))}
        </View>
        <ProgressBar
          label={progress.label}
          ratio={progress.ratio}
          tone={progress.met ? 'positive' : 'accent'}
        />
        <Text style={styles.cardMeta}>{progress.remainingLabel}</Text>
        <View style={styles.targetRow}>
          <Button label="−" onPress={() => adjustTarget(-1)} style={styles.stepButton} tone="quiet" />
          <Text style={styles.targetValue}>
            {weeklyGoal.target}
            {goalMetricUnits[weeklyGoal.metric]}
          </Text>
          <Button label="+" onPress={() => adjustTarget(1)} style={styles.stepButton} tone="quiet" />
          <Button
            label="자동 추천"
            onPress={() => void applyRecommendedGoal()}
            style={styles.recommendButton}
            tone="secondary"
          />
        </View>
        <Text style={styles.cardMeta}>
          {average.measuredWeeks > 0
            ? `최근 ${average.measuredWeeks}주 평균 ${average.sessions}회 · ${Math.round(average.minutes)}분 · ${formatDistance(average.distanceKm)}. 추천은 ${goalMetricLabels[recommended.metric]} ${recommended.target}${goalMetricUnits[recommended.metric]}이에요.`
            : '아직 평균을 낼 기록이 부족해요. 가볍게 시작할 수 있는 목표를 제안했어요.'}
        </Text>
        <Text style={styles.disclaimer}>
          목표는 기록을 이어가기 위한 참고 기준이며 건강 상태에 대한 판단이 아니에요.
        </Text>
      </Card>

      <SectionHeader title="스트릭" subtitle="새벽 4시를 하루 경계로 계산해요." />
      <View style={styles.metricsRow}>
        <Metric label="현재 스트릭" value={`${streak.current}일`} style={styles.metric} />
        <Metric label="최고 스트릭" value={`${streak.best}일`} style={styles.metric} />
        <Metric label="등급" value={streak.tier} style={styles.metric} />
      </View>

      <SectionHeader
        title={`배지 ${unlockedCount}/${badgeProgress.length}`}
        subtitle={`규칙 ${BADGE_RULE_VERSION} · 카테고리별 진행률을 볼 수 있어요.`}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <Chip
          label="전체"
          onPress={() => setOpenCategory('all')}
          selected={openCategory === 'all'}
          tone="accent"
        />
        {badgeCategoryOrder.map((category) => (
          <Chip
            key={category}
            label={badgeCategoryLabels[category]}
            onPress={() => setOpenCategory(category)}
            selected={openCategory === category}
            tone="accent"
          />
        ))}
      </ScrollView>
      {groupedBadges.map((group) => (
        <View key={group.category} style={styles.badgeGroup}>
          <Text style={styles.badgeGroupTitle}>{badgeCategoryLabels[group.category]}</Text>
          {group.entries.map((entry) => (
            <Pressable
              accessibilityHint={entry.unlocked ? '대표 배지로 설정해요' : undefined}
              accessibilityRole="button"
              disabled={!entry.unlocked}
              key={entry.badge.id}
              onPress={() => void updatePreferences({ featuredBadgeId: entry.badge.id })}
              style={({ pressed }) => [
                styles.badgeRow,
                !entry.unlocked && styles.badgeLocked,
                preferences.featuredBadgeId === entry.badge.id && styles.badgeFeatured,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.badgeCopy}>
                <Text style={styles.badgeTitle}>{entry.badge.title}</Text>
                <Text style={styles.badgeBody}>{entry.badge.description}</Text>
                {!entry.unlocked ? (
                  <ProgressBar
                    label={
                      entry.badge.authority === 'server'
                        ? '서버 연결 뒤에 확인할 수 있어요'
                        : `${Math.round(entry.value * 10) / 10} / ${entry.target}`
                    }
                    ratio={entry.ratio}
                  />
                ) : null}
              </View>
              <Chip
                label={
                  preferences.featuredBadgeId === entry.badge.id
                    ? '대표'
                    : entry.unlocked
                      ? '획득'
                      : '진행 중'
                }
                tone={entry.unlocked ? 'positive' : 'neutral'}
              />
            </Pressable>
          ))}
        </View>
      ))}

      <SectionHeader title="활동 목록" subtitle="이 기기에 저장된 기록이에요." />
      <ManualActivityCard
        onSave={async (input) => {
          await completeActivity({ ...input, source: 'SELF_LOGGED' });
        }}
      />
      <Card style={styles.listCard}>
        {latestActivities.length > 0 ? (
          latestActivities.map((activity) => (
            <View key={activity.id} style={styles.listRow}>
              <Text style={styles.rowTitle}>
                {kindLabels[activity.kind] ?? activity.kind} · {activity.durationMinutes}분
                {activity.distanceKm ? ` · ${formatDistance(activity.distanceKm)}` : ''}
              </Text>
              <Text style={styles.rowMeta}>
                {activitySourceLabels[activity.source]} · {activity.completedAt.slice(0, 10)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.rowMeta}>아직 완료한 활동이 없어요.</Text>
        )}
        {activities.length > 5 ? (
          <Button
            label={showAllActivities ? '최근 5건만 보기' : `전체 ${activities.length}건 보기`}
            onPress={() => setShowAllActivities((current) => !current)}
            tone="quiet"
          />
        ) : null}
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
  card: { gap: spacing.sm },
  cardTitle: { color: palette.ink, fontSize: typeScale.body, fontWeight: '900' },
  cardMeta: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 18 },
  disclaimer: { color: palette.muted, fontSize: 11, lineHeight: 16 },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  metric: { flex: 1, minWidth: 0 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepButton: { minWidth: 52 },
  targetValue: {
    minWidth: 64,
    textAlign: 'center',
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    fontWeight: '900',
  },
  recommendButton: { flex: 1 },
  badgeGroup: { gap: spacing.xs, paddingTop: spacing.sm },
  badgeGroupTitle: { color: palette.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  badgeLocked: { opacity: 0.72 },
  badgeFeatured: { borderColor: palette.accent, borderWidth: 1.5 },
  badgeCopy: { flex: 1, minWidth: 0, gap: 4 },
  badgeTitle: { color: palette.ink, fontSize: typeScale.bodySmall, fontWeight: '900' },
  badgeBody: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 17 },
  listCard: { gap: spacing.sm },
  listRow: {
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.xs,
  },
  rowTitle: { color: palette.ink, fontSize: typeScale.bodySmall, fontWeight: '800' },
  rowMeta: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 18, marginTop: 2 },
  pressed: { opacity: 0.72 },
});
