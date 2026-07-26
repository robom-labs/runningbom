// 오늘의 러닝 한 장과 이번 주 목표를 먼저 보여주는 러닝봄 홈입니다.
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  Chip,
  ProgressBar,
  SectionHeader,
} from '../../design-system/components';
import { palette, radius, spacing, typeScale } from '../../design-system/theme';
import { useAppState } from '../../state/AppStateProvider';
import { useRaceState } from '../../state/RaceStateProvider';
import { formatDDay, groupRaces } from '../../../domains/races/aggregate';
import { currentWeekProgress, goalMetricLabels } from '../../../domains/badges/goals';
import { kstDayKey } from '../../../domains/activities/summary';
import { upcomingPlans } from '../../../domains/activities/plans';
import { shoes } from '../../../domains/shoes/catalog';
import type { RouteKey } from '../../navigation/types';

type Props = {
  onNavigate: (route: RouteKey) => void;
  onOpenRace: (raceId?: string) => void;
  onOpenShoe: (shoeId?: string) => void;
};

export function HomeScreen({ onNavigate, onOpenRace, onOpenShoe }: Props) {
  const { preferences, streak, storageError, activities, weeklyGoal, plans } = useAppState();
  const { feed } = useRaceState();

  const progress = useMemo(
    () => currentWeekProgress(activities, weeklyGoal),
    [activities, weeklyGoal],
  );

  const nextRaces = useMemo(
    () =>
      groupRaces(feed.races)
        .filter((group) => group.status === '접수 중' || group.status === '접수 예정')
        .slice(0, 3),
    [feed.races],
  );

  const nextPlans = useMemo(() => upcomingPlans(plans, kstDayKey(new Date()), 2), [plans]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
      {storageError ? <Banner title="저장 상태 안내" body={storageError} tone="warning" /> : null}

      <Card style={styles.todayCard} accessibilityLabel="오늘의 러닝 추천">
        <Text style={styles.eyebrow}>TODAY RUN</Text>
        <Text style={styles.todayTitle}>오늘의 러닝</Text>
        <Text style={styles.todayPlan}>
          {preferences.coachMinutes}분 · {preferences.coachType}
        </Text>
        <Text style={styles.todayDescription}>
          지난 선택을 기억했어요. 세부 시간과 유형은 러닝 시작 화면에서 바꿀 수 있어요.
        </Text>
        <View style={styles.todayActions}>
          <Button
            label="캘린더"
            onPress={() => onNavigate('calendar')}
            style={styles.action}
            tone="secondary"
          />
          <Button label="러닝 시작" onPress={() => onNavigate('start')} style={styles.action} />
        </View>
      </Card>

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
          <Button label="기록·통계" onPress={() => onNavigate('stats')} tone="quiet" />
        </View>
      </Card>

      {nextPlans.length > 0 ? (
        <Card style={styles.planCard}>
          <Text style={styles.sectionMini}>예정된 러닝</Text>
          {nextPlans.map((plan) => (
            <Pressable
              accessibilityRole="button"
              key={plan.id}
              onPress={() => onNavigate('calendar')}
              style={({ pressed }) => [styles.planRow, pressed && styles.pressed]}
            >
              <Text style={styles.planTitle}>{plan.title}</Text>
              <Text style={styles.planMeta}>{plan.date}</Text>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <SectionHeader
        title="다가오는 대회"
        subtitle={`검증 데이터 ${feed.revision}`}
        action={<Button label="전체" onPress={() => onOpenRace(undefined)} tone="quiet" />}
      />
      <View style={styles.compactList}>
        {nextRaces.map((group) => (
          <Pressable
            key={group.key}
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
            <Chip label={group.status} tone={group.status === '접수 중' ? 'positive' : 'warning'} />
          </Pressable>
        ))}
      </View>

      <SectionHeader
        title="커뮤니티"
        subtitle="로그인하지 않아도 공개 글을 읽을 수 있어요."
        action={<Button label="보기" onPress={() => onNavigate('community')} tone="quiet" />}
      />
      <Card style={styles.emptyCommunity}>
        <Text style={styles.emptyTitle}>지금은 읽기 전용이에요</Text>
        <Text style={styles.emptyBody}>
          운영 서버 쓰기가 연결되기 전까지 글쓰기·좋아요는 열리지 않아요. 가짜 사용자나 자동
          게시물은 만들지 않습니다.
        </Text>
      </Card>

      <SectionHeader
        title="러닝화 찾기"
        subtitle="러닝 목적과 국내 구매 경로를 비교해요."
        action={<Button label="전체" onPress={() => onOpenShoe(undefined)} tone="quiet" />}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.shoeRow}
      >
        {shoes.slice(0, 4).map((shoe) => (
          <Pressable
            key={shoe.id}
            accessibilityRole="button"
            onPress={() => onOpenShoe(shoe.id)}
            style={({ pressed }) => [styles.shoeCard, pressed && styles.pressed]}
          >
            <Text style={styles.shoeBrand}>{shoe.brand}</Text>
            <Text style={styles.shoeModel}>{shoe.model}</Text>
            <Text style={styles.shoeMeta}>{shoe.koreaStatus}</Text>
          </Pressable>
        ))}
      </ScrollView>
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
  todayCard: { backgroundColor: palette.navy, borderColor: palette.navy, padding: spacing.xl },
  eyebrow: { color: '#FFB596', fontSize: typeScale.caption, fontWeight: '900', letterSpacing: 1.4 },
  todayTitle: {
    color: palette.white,
    fontSize: typeScale.display,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: spacing.lg,
  },
  todayPlan: {
    color: palette.white,
    fontSize: typeScale.titleSmall,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  todayDescription: {
    color: '#CCD5E3',
    fontSize: typeScale.bodySmall,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  todayActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  action: { flex: 1 },
  goalCard: { gap: spacing.sm },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  goalCopy: { flex: 1, minWidth: 0 },
  goalTitle: { color: palette.ink, fontSize: typeScale.body, fontWeight: '900' },
  goalMeta: { color: palette.muted, fontSize: typeScale.caption, marginTop: 2 },
  goalFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  goalFooterText: {
    flex: 1,
    minWidth: 0,
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    fontWeight: '800',
  },
  planCard: { gap: spacing.xs },
  sectionMini: { color: palette.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  planRow: { minHeight: 44, justifyContent: 'center' },
  planTitle: { color: palette.ink, fontSize: typeScale.bodySmall, fontWeight: '800' },
  planMeta: { color: palette.muted, fontSize: typeScale.caption, marginTop: 2 },
  emptyCommunity: { backgroundColor: palette.surfaceWarm },
  emptyTitle: { color: palette.ink, fontSize: typeScale.body, fontWeight: '900' },
  emptyBody: {
    color: palette.muted,
    fontSize: typeScale.bodySmall,
    lineHeight: 20,
    marginTop: spacing.xs,
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
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compactCopy: { flex: 1, minWidth: 0 },
  compactTitle: { color: palette.ink, fontSize: typeScale.body, fontWeight: '800' },
  compactMeta: { color: palette.muted, fontSize: typeScale.caption, marginTop: 4 },
  shoeRow: { gap: spacing.sm },
  shoeCard: {
    width: 210,
    minHeight: 132,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  shoeBrand: { color: palette.muted, fontSize: typeScale.caption, fontWeight: '800' },
  shoeModel: { color: palette.ink, fontSize: typeScale.titleSmall, fontWeight: '900', marginTop: 4 },
  shoeMeta: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: 17,
    marginTop: spacing.md,
  },
  pressed: { opacity: 0.72 },
});
