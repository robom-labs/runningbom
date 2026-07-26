// 오늘의 러닝 한 장과 이번 주 목표를 먼저 보여주는 러닝봄 홈입니다.
// 가장 자주 하는 행동(러닝 시작)이 첫 화면 상단에서 한 번에 닿도록 배치합니다.
import { memo, useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  ProgressBar,
  SectionHeader,
  Skeleton,
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
import { useRaceState } from '../../state/RaceStateProvider';
import { formatDDay, groupRaces } from '../../../domains/races/aggregate';
import { goalRaceCountdown, goalRacePhaseLabels } from '../../../domains/races/goalRace';
import { useGoalRace } from '../../../domains/races/useGoalRace';
import { currentWeekProgress, goalMetricLabels } from '../../../domains/badges/goals';
import { formatDistance, kstDayKey } from '../../../domains/activities/summary';
import { suggestTodayRun } from '../../../domains/activities/trend';
import { activitySourceLabels, type ActivityRecord } from '../../../domains/activities/types';
import { upcomingPlans } from '../../../domains/activities/plans';
import { shoeCatalog } from '../../../domains/shoes/catalog';
import type { RouteKey } from '../../navigation/types';

type Props = {
  onNavigate: (route: RouteKey) => void;
  onOpenRace: (raceId?: string) => void;
  onOpenShoe: (shoeId?: string) => void;
};

const kindLabels: Record<string, string> = { run: '러닝', walk: '걷기', recovery: '회복' };

export function HomeScreen({ onNavigate, onOpenRace, onOpenShoe }: Props) {
  const { preferences, streak, storageError, activities, weeklyGoal, plans, badges } = useAppState();
  const { feed, loading } = useRaceState();
  const { goalRace } = useGoalRace();

  const progress = useMemo(
    () => currentWeekProgress(activities, weeklyGoal),
    [activities, weeklyGoal],
  );

  const suggestion = useMemo(
    () => suggestTodayRun(activities, preferences.coachMinutes),
    [activities, preferences.coachMinutes],
  );

  const goalCountdown = useMemo(
    () => (goalRace ? goalRaceCountdown(goalRace.raceDate) : undefined),
    [goalRace],
  );

  const nextRaces = useMemo(
    () =>
      groupRaces(feed.races)
        .filter((group) => group.status === '접수 중' || group.status === '접수 예정')
        .slice(0, 3),
    [feed.races],
  );

  const nextPlans = useMemo(() => upcomingPlans(plans, kstDayKey(new Date()), 2), [plans]);
  const recentActivities = useMemo(() => activities.slice(0, 3), [activities]);
  const recentBadges = useMemo(() => badges.slice(0, 3), [badges]);
  const featuredShoes = useMemo(() => shoeCatalog.slice(0, 4), []);
  const hasActivity = activities.length > 0;

  const openStart = useCallback(() => onNavigate('start'), [onNavigate]);
  const openCalendar = useCallback(() => onNavigate('calendar'), [onNavigate]);
  const openStats = useCallback(() => onNavigate('stats'), [onNavigate]);

  return (
    <ScrollView
      contentContainerStyle={screenStyles.content}
      showsVerticalScrollIndicator={false}
      style={screenStyles.root}
    >
      {storageError ? <Banner title="저장 상태 안내" body={storageError} tone="warning" /> : null}

      <Card style={styles.todayCard} tone="navy" accessibilityLabel="오늘의 러닝 추천">
        <Text style={styles.eyebrow}>TODAY RUN</Text>
        <Text style={styles.todayTitle}>{suggestion.title}</Text>
        <Text style={styles.todayPlan}>
          {suggestion.minutes}분 · {preferences.coachType}
        </Text>
        <View style={styles.todayActions}>
          <Button
            accessibilityHint="음성 코치와 함께 오늘의 러닝을 시작해요"
            label="러닝 시작"
            onPress={openStart}
            size="lg"
            style={styles.primaryAction}
            testID="home-start-run"
            tone="secondary"
          />
          <Button
            label="캘린더"
            onPress={openCalendar}
            style={styles.secondaryAction}
            tone="quiet"
          />
        </View>
        <Text style={styles.todayDescription}>{suggestion.body}</Text>
        <Text style={styles.todayNote}>
          세부 시간과 유형은 러닝 시작 화면에서 바꿀 수 있어요. 몸 상태가 우선이에요.
        </Text>
      </Card>

      {goalRace && goalCountdown ? (
        <Pressable
          accessibilityHint="목표 대회 상세를 열어요"
          accessibilityLabel={`목표 대회 ${goalRace.name} ${goalCountdown.dDayLabel}`}
          accessibilityRole="button"
          onPress={() => onOpenRace(goalRace.raceId)}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Card style={styles.goalRaceCard} tone="warm">
            <View style={styles.goalRaceTop}>
              <View style={styles.goalRaceDDay}>
                <Text style={styles.goalRaceDDayText}>{goalCountdown.dDayLabel}</Text>
              </View>
              <Chip label={goalRacePhaseLabels[goalCountdown.phase]} tone="accent" />
            </View>
            <Text style={styles.goalRaceName}>{goalRace.name}</Text>
            <Text style={styles.goalRaceMeta}>
              {goalRace.raceDate} · {goalRace.region} · {goalCountdown.remainingLabel}
            </Text>
          </Card>
        </Pressable>
      ) : null}

      <Card style={styles.goalCard}>
        <View style={styles.goalHeader}>
          <View style={styles.goalCopy}>
            <Text style={styles.goalTitle}>
              이번 주 목표 · {goalMetricLabels[weeklyGoal.metric]}
            </Text>
            <Text style={styles.goalMeta}>{progress.remainingLabel}</Text>
          </View>
          <Chip
            label={progress.met ? '달성' : '진행 중'}
            tone={progress.met ? 'positive' : 'accent'}
          />
        </View>
        <ProgressBar
          label={progress.label}
          ratio={progress.ratio}
          tone={progress.met ? 'positive' : 'accent'}
        />
        <View style={styles.goalFooter}>
          <Text style={styles.goalFooterText}>
            {streak.current > 0 ? `연속 ${streak.current}일 · ${streak.tier}` : streak.tier}
          </Text>
          <Button label="기록·통계" onPress={openStats} tone="quiet" />
        </View>
      </Card>

      {nextPlans.length > 0 ? (
        <Card style={styles.planCard}>
          <Text style={styles.sectionMini}>예정된 러닝</Text>
          {nextPlans.map((plan) => (
            <Pressable
              accessibilityHint="캘린더에서 자세히 봐요"
              accessibilityLabel={`${plan.date} ${plan.title}`}
              accessibilityRole="button"
              key={plan.id}
              onPress={openCalendar}
              style={({ pressed }) => [styles.planRow, pressed && styles.pressed]}
            >
              <Text style={styles.planTitle}>{plan.title}</Text>
              <Text style={styles.planMeta}>{plan.date}</Text>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <SectionHeader
        title="최근 활동"
        subtitle="이 기기에 저장된 기록이에요."
        {...(hasActivity ? { action: <Button label="전체" onPress={openStats} tone="quiet" /> } : {})}
      />
      {hasActivity ? (
        <Card style={styles.recentCard}>
          {recentActivities.map((activity) => (
            <ActivityRow activity={activity} key={activity.id} />
          ))}
        </Card>
      ) : (
        <EmptyState
          title="아직 저장된 기록이 없어요"
          body="러닝 시작을 누르면 음성 코치가 함께 달리고, 끝난 뒤 이 기기에 자동으로 기록이 남아요. 이미 달린 기록은 캘린더에서 직접 적을 수도 있어요."
          actionLabel="러닝 시작"
          onAction={openStart}
          secondaryActionLabel="기록 직접 입력"
          onSecondaryAction={openCalendar}
          hint="로그인 없이 쓸 수 있고, 기록은 기기 밖으로 자동 전송되지 않아요."
        />
      )}

      {recentBadges.length > 0 ? (
        <>
          <SectionHeader
            title="새로 얻은 배지"
            subtitle="가장 최근에 열린 배지예요."
            action={<Button label="전체" onPress={openStats} tone="quiet" />}
            compact
          />
          <View style={styles.badgeRow}>
            {recentBadges.map((badge) => (
              <Chip key={badge.id} label={badge.title} tone="positive" />
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader
        title="다가오는 대회"
        subtitle={`검증 데이터 ${feed.revision}`}
        action={<Button label="전체" onPress={() => onOpenRace(undefined)} tone="quiet" />}
      />
      {loading && nextRaces.length === 0 ? (
        <Card accessibilityLabel="대회 정보를 불러오는 중이에요" style={styles.loadingCard}>
          <Skeleton height={18} width="72%" />
          <Skeleton height={12} width="54%" />
          <Skeleton height={12} width="46%" />
        </Card>
      ) : nextRaces.length > 0 ? (
        <View style={styles.compactList}>
          {nextRaces.map((group) => (
            <Pressable
              key={group.key}
              accessibilityHint="대회 상세와 접수 알림을 열어요"
              accessibilityLabel={`${group.name} ${formatDDay(group.raceDate)} ${group.status}`}
              accessibilityRole="button"
              onPress={() => onOpenRace(group.id)}
              style={({ pressed }) => [styles.compactItem, pressed && styles.pressed]}
            >
              <View style={styles.compactCopy}>
                <Text style={styles.compactTitle}>{group.name}</Text>
                <Text style={styles.compactMeta}>
                  {formatDDay(group.raceDate)} · {group.region} · {group.distances.join(' · ')}
                </Text>
              </View>
              <Chip
                label={group.status}
                tone={group.status === '접수 중' ? 'positive' : 'warning'}
              />
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          title="지금 접수 중인 대회가 없어요"
          body="접수 예정 대회가 확인되면 여기에 먼저 올려 드려요. 대회 화면에서는 지역·거리별로 전체 일정을 볼 수 있어요."
          actionLabel="대회 전체 보기"
          onAction={() => onOpenRace(undefined)}
          tone="muted"
        />
      )}

      <SectionHeader
        title="커뮤니티"
        subtitle="러닝 질문에 답하는 Q&A를 로그인 없이 읽을 수 있어요."
        action={<Button label="보기" onPress={() => onNavigate('community')} tone="quiet" />}
      />
      <EmptyState
        title="러닝 Q&A로 먼저 도움받기"
        body="무릎 통증, 러닝화 교체 시기, 인터벌 시작 시점처럼 자주 묻는 질문의 답을 앱 안에 담았어요. 글쓰기·좋아요는 운영 서버가 연결되기 전까지 열리지 않고, 가짜 사용자나 자동 게시물은 만들지 않습니다."
        actionLabel="Q&A 읽기"
        onAction={() => onNavigate('community')}
      />

      <SectionHeader
        title="러닝화 찾기"
        subtitle={`러닝화 ${shoeCatalog.length}종의 목적과 국내 구매 경로를 비교해요.`}
        action={<Button label="전체" onPress={() => onOpenShoe(undefined)} tone="quiet" />}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.shoeRow}
      >
        {featuredShoes.map((shoe) => (
          <Pressable
            key={shoe.id}
            accessibilityHint="러닝화 상세를 열어요"
            accessibilityLabel={`${shoe.brand} ${shoe.model}`}
            accessibilityRole="button"
            onPress={() => onOpenShoe(shoe.id)}
            style={({ pressed }) => [styles.shoeCard, pressed && styles.pressed]}
          >
            <Text style={styles.shoeBrand}>{shoe.brand}</Text>
            <Text style={styles.shoeModel}>{shoe.model}</Text>
            <Text numberOfLines={3} style={styles.shoeMeta}>
              {shoe.pick}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </ScrollView>
  );
}

// 목록 행은 별도 컴포넌트로 memo 해 두어 홈이 다시 그려져도 행마다 다시 계산하지 않습니다.
const ActivityRow = memo(function ActivityRow({ activity }: { activity: ActivityRecord }) {
  return (
    <View style={styles.recentRow}>
      <Text style={styles.recentTitle}>
        {kindLabels[activity.kind] ?? activity.kind} · {activity.durationMinutes}분
        {activity.distanceKm ? ` · ${formatDistance(activity.distanceKm)}` : ''}
      </Text>
      <Text style={styles.recentMeta}>
        {activitySourceLabels[activity.source]} · {activity.completedAt.slice(0, 10)}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  todayCard: { padding: spacing.xl },
  eyebrow: {
    color: palette.onNavyAccent,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.heavy,
    letterSpacing: 1.4,
  },
  todayTitle: {
    color: palette.onNavy,
    fontSize: typeScale.display,
    lineHeight: lineHeight.display,
    fontWeight: fontWeight.heavy,
    letterSpacing: -1,
    marginTop: spacing.md,
  },
  todayPlan: {
    color: palette.onNavy,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.bold,
    marginTop: spacing.xxs,
  },
  todayDescription: {
    color: palette.onNavySoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    marginTop: spacing.md,
  },
  todayNote: {
    color: palette.onNavyMuted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    marginTop: spacing.xs,
  },
  todayActions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.lg },
  primaryAction: { flex: 2 },
  secondaryAction: { flex: 1 },
  loadingCard: { gap: spacing.sm },
  goalRaceCard: { gap: spacing.xxs },
  goalRaceTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  goalRaceDDay: {
    minHeight: 30,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: palette.accentStrong,
    paddingHorizontal: spacing.sm,
  },
  goalRaceDDayText: {
    color: palette.white,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.heavy,
  },
  goalRaceName: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
    marginTop: spacing.xs,
  },
  goalRaceMeta: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  recentCard: { gap: spacing.sm },
  recentRow: { gap: spacing.xxs / 2 },
  recentTitle: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.bold,
  },
  recentMeta: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  goalCard: { gap: spacing.sm },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  goalCopy: { flex: 1, minWidth: 0 },
  goalTitle: {
    color: palette.ink,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.heavy,
  },
  goalMeta: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    marginTop: spacing.xxs / 2,
  },
  goalFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  goalFooterText: {
    flex: 1,
    minWidth: 0,
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.bold,
  },
  planCard: { gap: spacing.xs },
  sectionMini: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    fontWeight: fontWeight.heavy,
    letterSpacing: 0.6,
  },
  planRow: { minHeight: layout.touchTarget, justifyContent: 'center' },
  planTitle: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.bold,
  },
  planMeta: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    marginTop: spacing.xxs / 2,
  },
  compactList: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: StyleSheet.hairlineWidth,
  },
  compactItem: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compactCopy: { flex: 1, minWidth: 0 },
  compactTitle: {
    color: palette.ink,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.bold,
  },
  compactMeta: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    marginTop: spacing.xxs,
  },
  shoeRow: { gap: spacing.sm, paddingVertical: spacing.xxs },
  shoeCard: {
    width: 210,
    minHeight: 132,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: borderWidth.thin,
    padding: spacing.md,
  },
  shoeBrand: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.bold,
  },
  shoeModel: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
    marginTop: spacing.xxs,
  },
  shoeMeta: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    marginTop: spacing.sm,
  },
  pressed: { opacity: pressedOpacity },
});
