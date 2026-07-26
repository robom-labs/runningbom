// 기록·통계 화면입니다. 주간·월간 요약, 주간 목표, 배지, 활동 목록을 한곳에 모읍니다.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Metric,
  MiniBarChart,
  ProgressBar,
  SectionHeader,
  screenStyles,
  type BarDatum,
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
import { activitySourceLabels, type ActivityRecord } from '../../../domains/activities/types';
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
  activityKindFilterLabels,
  activityKindFilters,
  activityPeriodFilters,
  averagePaceMinutesPerKm,
  defaultActivityListFilter,
  filterActivities,
  formatPace,
  monthlyTrend,
  trendMetricLabels,
  type ActivityListFilter,
  type TrendMetric,
} from '../../../domains/activities/trend';
import {
  currentWeekProgress,
  goalMetricLabels,
  goalMetricUnits,
  recommendWeeklyGoal,
  type GoalMetric,
} from '../../../domains/badges/goals';
import {
  personalBestSummary,
  type PersonalBest,
  type PersonalRecord,
} from '../../../domains/activities/personalBests';
import {
  BADGE_RULE_VERSION,
  badgeCategoryLabels,
  badgeCategoryOrder,
  type BadgeCategory,
  type BadgeProgress,
} from '../../../domains/badges/rules';
import type { StatsFocus } from '../../navigation/types';
import { useAppState } from '../../state/AppStateProvider';
import { ManualActivityCard } from './ManualActivityCard';

const kindLabels: Record<string, string> = { run: '러닝', walk: '걷기', recovery: '회복' };
const metricChoices: GoalMetric[] = ['sessions', 'minutes', 'distance'];
const metricSteps: Record<GoalMetric, number> = { sessions: 1, minutes: 10, distance: 1 };

/** 배지 44종을 한 번에 그리지 않도록 카테고리별 기본 노출 개수를 둡니다. */
const collapsedBadgesPerCategory = 3;

type MyScreenProps = {
  onOpenCalendar: () => void;
  /** 드로어 하위 메뉴("주간 요약·배지·최고기록")에서 넘어온 구획입니다. */
  focus?: { section: StatsFocus; nonce: number };
};

export function MyScreen({ onOpenCalendar, focus }: MyScreenProps) {
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
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('distance');
  const [listFilter, setListFilter] = useState<ActivityListFilter>(defaultActivityListFilter);

  // 하위 메뉴에서 고른 구획으로 스크롤합니다. 구획 위치는 onLayout으로만 기록합니다.
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<StatsFocus, number>>({ week: 0, badges: 0, records: 0 });
  const rememberOffset = useCallback(
    (section: StatsFocus) => (event: LayoutChangeEvent) => {
      sectionOffsets.current[section] = event.nativeEvent.layout.y;
    },
    [],
  );

  useEffect(() => {
    if (!focus) return;
    if (focus.section === 'badges') setShowAllBadges(true);
    const offset = sectionOffsets.current[focus.section];
    scrollRef.current?.scrollTo({ y: Math.max(0, offset - 8), animated: true });
  }, [focus]);

  const weekTotals = useMemo(() => totalsForWeek(activities, currentWeekStart()), [activities]);
  const monthTotals = useMemo(() => totalsForMonth(activities, currentMonth()), [activities]);

  const trend = useMemo(
    () => monthlyTrend(activities, trendMetric, 6),
    [activities, trendMetric],
  );
  const trendBars = useMemo<BarDatum[]>(
    () =>
      trend.map((point) => ({
        key: point.month,
        label: point.label,
        ratio: point.ratio,
        valueLabel:
          trendMetric === 'distance'
            ? `${Math.round(point.value * 10) / 10}`
            : `${Math.round(point.value)}`,
        highlight: point.isCurrent,
      })),
    [trend, trendMetric],
  );

  const weekPace = useMemo(
    () =>
      averagePaceMinutesPerKm(
        filterActivities(activities, { kind: '전체', period: '최근 7일' }),
      ),
    [activities],
  );
  const monthPace = useMemo(
    () =>
      averagePaceMinutesPerKm(
        filterActivities(activities, { kind: '전체', period: '이번 달' }),
      ),
    [activities],
  );

  const filteredActivities = useMemo(
    () => filterActivities(activities, listFilter),
    [activities, listFilter],
  );
  const average = useMemo(() => recentWeeklyAverage(activities), [activities]);
  const progress = useMemo(
    () => currentWeekProgress(activities, weeklyGoal),
    [activities, weeklyGoal],
  );
  const recommended = useMemo(
    () => recommendWeeklyGoal(activities, Date.now(), preferences.experienceLevel),
    [activities, preferences.experienceLevel],
  );
  const bestSummary = useMemo(() => personalBestSummary(activities), [activities]);

  const unlockedCount = badgeProgress.filter((entry) => entry.unlocked).length;
  const categoryProgress = useMemo(
    () =>
      badgeCategoryOrder
        .map((category) => {
          const entries = badgeProgress.filter((entry) => entry.badge.category === category);
          const unlocked = entries.filter((entry) => entry.unlocked).length;
          return {
            category,
            unlocked,
            total: entries.length,
            ratio: entries.length > 0 ? unlocked / entries.length : 0,
          };
        })
        .filter((entry) => entry.total > 0),
    [badgeProgress],
  );
  // 전체 보기에서는 카테고리마다 앞의 몇 개만 그려 첫 렌더 비용을 줄입니다("배지 전체 보기"로 펼침).
  const groupedBadges = useMemo(() => {
    const visible =
      openCategory === 'all'
        ? badgeProgress
        : badgeProgress.filter((entry) => entry.badge.category === openCategory);
    const limit = openCategory === 'all' && !showAllBadges ? collapsedBadgesPerCategory : undefined;
    return badgeCategoryOrder
      .map((category) => {
        const entries = visible.filter((entry) => entry.badge.category === category);
        return {
          category,
          entries: limit ? entries.slice(0, limit) : entries,
          hidden: limit ? Math.max(0, entries.length - limit) : 0,
        };
      })
      .filter((group) => group.entries.length > 0);
  }, [badgeProgress, openCategory, showAllBadges]);

  const hiddenBadgeCount = useMemo(
    () => groupedBadges.reduce((total, group) => total + group.hidden, 0),
    [groupedBadges],
  );

  const latestActivities = useMemo(
    () => (showAllActivities ? filteredActivities.slice(0, 40) : filteredActivities.slice(0, 5)),
    [filteredActivities, showAllActivities],
  );

  const featureBadge = useCallback(
    (badgeId: string) => {
      void updatePreferences({ featuredBadgeId: badgeId });
    },
    [updatePreferences],
  );

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
      contentContainerStyle={screenStyles.content}
      keyboardShouldPersistTaps="handled"
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      style={screenStyles.root}
    >
      {storageError ? <Banner title="저장 상태 안내" body={storageError} tone="warning" /> : null}

      {activities.length === 0 ? (
        <EmptyState
          title="아직 통계로 보여 드릴 기록이 없어요"
          body="러닝을 한 번 마치거나 아래 기록 추가에서 이미 달린 기록을 적으면 주간·월간 요약과 배지 진행이 바로 채워져요."
          actionLabel="캘린더에서 기록 적기"
          onAction={onOpenCalendar}
          hint="기록은 이 기기에 저장되고, 목표는 참고 기준일 뿐 건강 판단이 아니에요."
        />
      ) : null}

      <View onLayout={rememberOffset('week')}>
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
          <View style={styles.metrics}>
            <Metric label="이번 주 운동일" value={`${weekTotals.activeDays}일`} style={styles.metric} />
            <Metric label="이번 주 평균 페이스" value={formatPace(weekPace)} style={styles.metric} />
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
          <View style={styles.metrics}>
            <Metric label="이번 달 운동일" value={`${monthTotals.activeDays}일`} style={styles.metric} />
            <Metric label="이번 달 평균 페이스" value={formatPace(monthPace)} style={styles.metric} />
          </View>
          <Text style={styles.cardMeta}>
            평균 페이스는 거리와 시간이 모두 저장된 기록만으로 계산해요. 거리 기록이 없으면 "기록
            부족"으로 표시합니다.
          </Text>
          <Button label="캘린더에서 보기" onPress={onOpenCalendar} tone="secondary" />
        </Card>
      </View>

      <SectionHeader title="월별 추이" subtitle="최근 6개월 흐름이에요. 이번 달은 진한 막대예요." />
      <Card style={styles.card}>
        <View accessibilityRole="tablist" style={styles.chipRow}>
          {(Object.keys(trendMetricLabels) as TrendMetric[]).map((metric) => (
            <Chip
              accessibilityRole="tab"
              key={metric}
              label={trendMetricLabels[metric]}
              onPress={() => setTrendMetric(metric)}
              selected={trendMetric === metric}
              tone="accent"
            />
          ))}
        </View>
        <MiniBarChart
          accessibilityLabel={`최근 6개월 ${trendMetricLabels[trendMetric]} 추이`}
          data={trendBars}
        />
        <Text style={styles.cardMeta}>
          단위는 {trendMetric === 'sessions' ? '회' : trendMetric === 'minutes' ? '분' : 'km'}
          이고, 기록이 없는 달은 0으로 표시해요.
        </Text>
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

      <View onLayout={rememberOffset('records')} style={styles.section}>
        <SectionHeader
          title="내 최고 기록"
          subtitle="구간 계측이 아니라, 저장된 활동의 평균 페이스로 환산한 추정값이에요."
        />
        {bestSummary.hasAny ? (
          <Card style={styles.card}>
            {bestSummary.bests.length > 0 ? (
              bestSummary.bests.map((best) => <PersonalBestRow best={best} key={best.key} />)
            ) : (
              <Text style={styles.cardMeta}>
                5K·10K·하프·풀로 환산할 만한 거리 기록이 아직 없어요. 거리와 시간을 함께 남기면
                구간 추정 기록이 채워져요.
              </Text>
            )}
            {bestSummary.records.length > 0 ? (
              <View style={styles.metrics}>
                {bestSummary.records.map((record) => (
                  <PersonalRecordTile key={record.key} record={record} />
                ))}
              </View>
            ) : null}
            <Text style={styles.disclaimer}>
              구간별 랩 기록이 아니라 활동 하나의 평균 페이스를 목표 거리로 환산한 값이라, 실제
              대회 기록과는 다를 수 있어요. 공인 기록이 아니에요.
            </Text>
          </Card>
        ) : (
          <EmptyState
            title="아직 기록이 없어요"
            body="러닝을 한 번 마치거나 이미 달린 기록을 적으면 5K·10K·하프·풀 추정 기록과 최장 거리·시간이 여기에 쌓여요."
            actionLabel="캘린더에서 기록 적기"
            onAction={onOpenCalendar}
            hint="거리와 시간을 함께 적어야 구간 기록을 환산할 수 있어요."
            tone="muted"
          />
        )}
      </View>

      <View onLayout={rememberOffset('badges')} style={styles.section}>
        <SectionHeader
          title={`배지 ${unlockedCount}/${badgeProgress.length}`}
          subtitle={`규칙 ${BADGE_RULE_VERSION} · 카테고리별 진행률을 볼 수 있어요.`}
        />
      </View>
      <View accessibilityLabel="카테고리별 배지 진행률" style={styles.badgeGrid}>
        {categoryProgress.map((entry) => (
          <Pressable
            accessibilityHint="이 카테고리의 배지만 봐요"
            accessibilityLabel={`${badgeCategoryLabels[entry.category]} ${entry.unlocked}/${entry.total} 획득`}
            accessibilityRole="button"
            accessibilityState={{ selected: openCategory === entry.category }}
            key={entry.category}
            onPress={() =>
              setOpenCategory((current) => (current === entry.category ? 'all' : entry.category))
            }
            style={({ pressed }) => [
              styles.badgeTile,
              openCategory === entry.category && styles.badgeTileSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.badgeTileTitle}>{badgeCategoryLabels[entry.category]}</Text>
            <Text style={styles.badgeTileCount}>
              {entry.unlocked}/{entry.total}
            </Text>
            <ProgressBar ratio={entry.ratio} tone={entry.ratio >= 1 ? 'positive' : 'accent'} />
          </Pressable>
        ))}
      </View>

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
            <BadgeRow
              entry={entry}
              featured={preferences.featuredBadgeId === entry.badge.id}
              key={entry.badge.id}
              onFeature={featureBadge}
            />
          ))}
        </View>
      ))}
      {hiddenBadgeCount > 0 ? (
        <Button
          label={`배지 ${hiddenBadgeCount}개 더 보기`}
          onPress={() => setShowAllBadges(true)}
          tone="quiet"
        />
      ) : null}
      {showAllBadges && openCategory === 'all' ? (
        <Button label="배지 접기" onPress={() => setShowAllBadges(false)} tone="quiet" />
      ) : null}

      <SectionHeader title="활동 목록" subtitle="이 기기에 저장된 기록이에요." />
      <ManualActivityCard
        onSave={async (input) => {
          await completeActivity({ ...input, source: 'SELF_LOGGED' });
        }}
      />
      <View style={styles.filterBlock}>
        <View accessibilityLabel="유형 필터" style={styles.chipRow}>
          {activityKindFilters.map((kind) => (
            <Chip
              key={kind}
              label={activityKindFilterLabels[kind]}
              onPress={() => {
                setListFilter((current) => ({ ...current, kind }));
                setShowAllActivities(false);
              }}
              selected={listFilter.kind === kind}
            />
          ))}
        </View>
        <View accessibilityLabel="기간 필터" style={styles.chipRow}>
          {activityPeriodFilters.map((period) => (
            <Chip
              key={period}
              label={period}
              onPress={() => {
                setListFilter((current) => ({ ...current, period }));
                setShowAllActivities(false);
              }}
              selected={listFilter.period === period}
              tone="accent"
            />
          ))}
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.cardMeta}>
          조건에 맞는 기록 {filteredActivities.length}건 · 전체 {activities.length}건
        </Text>
      </View>
      {latestActivities.length > 0 ? (
        <Card style={styles.listCard}>
          {latestActivities.map((activity) => (
            <ActivityRow activity={activity} key={activity.id} />
          ))}
          {activities.length > 5 ? (
            <Button
              label={showAllActivities ? '최근 5건만 보기' : `전체 ${activities.length}건 보기`}
              onPress={() => setShowAllActivities((current) => !current)}
              tone="quiet"
            />
          ) : null}
        </Card>
      ) : activities.length > 0 ? (
        <EmptyState
          title="이 조건에 맞는 기록이 없어요"
          body="유형이나 기간 필터를 바꾸면 저장된 다른 기록을 볼 수 있어요."
          actionLabel="필터 초기화"
          onAction={() => {
            setListFilter(defaultActivityListFilter);
            setShowAllActivities(false);
          }}
          tone="muted"
        />
      ) : (
        <EmptyState
          title="아직 완료한 활동이 없어요"
          body="위의 기록 추가에서 오늘 달린 시간을 적거나, 홈에서 러닝을 시작하면 여기에 쌓여요."
          actionLabel="캘린더 열기"
          onAction={onOpenCalendar}
          tone="muted"
        />
      )}
    </ScrollView>
  );
}

// 목록·배지 행은 memo 해 두어 필터나 목표를 바꿔도 바뀐 행만 다시 그립니다.
const ActivityRow = memo(function ActivityRow({ activity }: { activity: ActivityRecord }) {
  return (
    <View style={styles.listRow}>
      <Text style={styles.rowTitle}>
        {kindLabels[activity.kind] ?? activity.kind} · {activity.durationMinutes}분
        {activity.distanceKm ? ` · ${formatDistance(activity.distanceKm)}` : ''}
      </Text>
      <Text style={styles.rowMeta}>
        {activitySourceLabels[activity.source]} · {activity.completedAt.slice(0, 10)}
      </Text>
    </View>
  );
});

// 추정 기록임을 제목·설명·범위 안내 세 곳에서 모두 드러냅니다.
const PersonalBestRow = memo(function PersonalBestRow({ best }: { best: PersonalBest }) {
  const suffix = best.exact ? '' : ' (추정)';
  return (
    <View
      accessibilityLabel={`${best.label} ${best.timeLabel}${suffix}. ${best.accuracyLabel}`}
      style={styles.listRow}
    >
      <Text style={styles.rowTitle}>
        {best.label} {best.timeLabel}
        {suffix} · {formatPace(best.paceMinutesPerKm)}
      </Text>
      <Text style={styles.rowMeta}>{best.accuracyLabel}</Text>
      <Text style={styles.rowMeta}>
        {best.completedAt.slice(0, 10)} · {best.rangeLabel}
      </Text>
    </View>
  );
});

const PersonalRecordTile = memo(function PersonalRecordTile({
  record,
}: {
  record: PersonalRecord;
}) {
  return (
    <View
      accessibilityLabel={`${record.label} ${record.valueLabel}. ${record.detail}`}
      style={styles.recordTile}
    >
      <Metric label={record.label} value={record.valueLabel} />
      <Text style={styles.rowMeta}>{record.detail}</Text>
    </View>
  );
});

type BadgeRowProps = {
  entry: BadgeProgress;
  featured: boolean;
  onFeature: (badgeId: string) => void;
};

const BadgeRow = memo(function BadgeRow({ entry, featured, onFeature }: BadgeRowProps) {
  const status = featured ? '대표' : entry.unlocked ? '획득' : '진행 중';
  return (
    <Pressable
      accessibilityHint={entry.unlocked ? '대표 배지로 설정해요' : undefined}
      accessibilityLabel={`${entry.badge.title} ${status}. ${entry.badge.description}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: !entry.unlocked, selected: featured }}
      disabled={!entry.unlocked}
      onPress={() => onFeature(entry.badge.id)}
      style={({ pressed }) => [
        styles.badgeRow,
        !entry.unlocked && styles.badgeLocked,
        featured && styles.badgeFeatured,
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
      <Chip label={status} tone={entry.unlocked ? 'positive' : 'neutral'} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  section: { gap: spacing.sm },
  cardTitle: {
    color: palette.ink,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.heavy,
  },
  cardMeta: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  disclaimer: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
  },
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
  recordTile: { flex: 1, minWidth: 0, gap: spacing.xxs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  filterBlock: { gap: spacing.xs },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepButton: { minWidth: layout.touchTarget },
  targetValue: {
    minWidth: 64,
    textAlign: 'center',
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
  },
  recommendButton: { flex: 1 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  badgeTile: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 104,
    minHeight: 88,
    justifyContent: 'center',
    gap: spacing.xxs,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  badgeTileSelected: { borderColor: palette.accentStrong, borderWidth: borderWidth.emphasis },
  badgeTileTitle: {
    color: palette.inkSoft,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    fontWeight: fontWeight.heavy,
  },
  badgeTileCount: {
    color: palette.ink,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.heavy,
  },
  badgeGroup: { gap: spacing.xs, paddingTop: spacing.sm },
  badgeGroupTitle: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    fontWeight: fontWeight.heavy,
    letterSpacing: 0.6,
  },
  badgeRow: {
    minHeight: layout.touchTarget,
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
  badgeFeatured: { borderColor: palette.accentStrong, borderWidth: borderWidth.emphasis },
  badgeCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  badgeTitle: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.heavy,
  },
  badgeBody: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  listCard: { gap: spacing.sm },
  listRow: {
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.xs,
  },
  rowTitle: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.bold,
  },
  rowMeta: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    marginTop: spacing.xxs / 2,
  },
  pressed: { opacity: pressedOpacity },
});
