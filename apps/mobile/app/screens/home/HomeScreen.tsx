// 러닝봄 홈입니다. 오늘 → 이번 주 → 다가오는 것 → 최근 기록 → 발견 순서로 한 화면에 맥락을 담습니다.
//
// 화면 규칙
// - 맨 위는 숫자 나열이 아니라 "오늘 뭘 하면 되는지" 한 문장입니다(model.ts의 todayHeadline).
// - 숫자에는 반드시 비교나 의미를 붙입니다(weekInsight.meaning, 최근 기록의 note).
// - 달리기 시작 버튼은 스크롤 없이 보이는 첫 카드 안에 크게 둡니다.
// - 카드마다 사용자가 할 행동은 하나입니다.
// - 기록 수(0 / 1~4 / 5+)에 따라 보여 줄 카드를 바꿔 빈 화면을 만들지 않습니다.
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
import { groupRaces } from '../../../domains/races/aggregate';
import { goalRaceCountdown, goalRacePhaseLabels } from '../../../domains/races/goalRace';
import { useGoalRace } from '../../../domains/races/useGoalRace';
import { goalMetricLabels } from '../../../domains/badges/goals';
import { kstDayKey } from '../../../domains/activities/summary';
import { upcomingPlans } from '../../../domains/activities/plans';
import { shoeCatalog } from '../../../domains/shoes/catalog';
import { ShoeRankingCard } from '../../../domains/shoes/ShoeRankingCard';
import { knowledgeCards } from '../community/knowledge';
import { usePrograms } from '../../../domains/programs/usePrograms';
import { TodayCard } from '../programs/TodayCard';
import type { RouteKey } from '../../navigation/types';
import {
  dayCountLabel,
  greetingLine,
  homeStage,
  isPlainKorean,
  pickForToday,
  planForToday,
  recentActivityCards,
  registrationDeadlineLabel,
  startActionLabel,
  todayHeadline,
  weekDayMarks,
  weekInsight,
  weekMovementCaption,
  type HomeDayMark,
  type HomeRecentActivity,
} from './model';

type Props = {
  onNavigate: (route: RouteKey) => void;
  onOpenRace: (raceId?: string) => void;
  onOpenShoe: (shoeId?: string) => void;
  /**
   * 오늘 카드에서 바로 시작을 눌렀을 때입니다.
   * 훈련 탭으로 넘어가면서 그 회차·훈련을 곧바로 켭니다.
   * 없으면 훈련 탭으로 넘기기만 합니다.
   */
  onStartTraining?: (intent: { kind: 'plan' | 'workout'; workoutId?: string }) => void;
};

/** '다가오는 것' 한 줄입니다. 목표 대회·내 일정·접수 마감을 같은 모양으로 세웁니다. */
type UpcomingRow = {
  key: string;
  badge: string;
  title: string;
  meta: string;
  accessibilityHint: string;
  onPress: () => void;
};

const UPCOMING_LIMIT = 4;

export function HomeScreen({ onNavigate, onOpenRace, onOpenShoe, onStartTraining }: Props) {
  const { preferences, streak, storageError, activities, weeklyGoal, plans } = useAppState();
  const { progress } = usePrograms();
  const { feed, loading } = useRaceState();
  const { goalRace } = useGoalRace();

  // 한 번 그린 홈 안에서는 같은 '오늘'을 씁니다(문장과 요일 칸이 서로 어긋나지 않게).
  const now = useMemo(() => Date.now(), []);

  const openStart = useCallback(() => onNavigate('start'), [onNavigate]);
  const openCalendar = useCallback(() => onNavigate('calendar'), [onNavigate]);
  const openStats = useCallback(() => onNavigate('stats'), [onNavigate]);
  const openCommunity = useCallback(() => onNavigate('community'), [onNavigate]);
  const openAllRaces = useCallback(() => onOpenRace(undefined), [onOpenRace]);

  const stage = useMemo(() => homeStage(activities), [activities]);
  const todayPlan = useMemo(() => planForToday(plans, now), [now, plans]);

  const headline = useMemo(
    () =>
      todayHeadline({
        activities,
        weeklyGoal,
        plans,
        coachMinutes: preferences.coachMinutes,
        ...(goalRace ? { goalRace: { name: goalRace.name, raceDate: goalRace.raceDate } } : {}),
        now,
      }),
    [activities, goalRace, now, plans, preferences.coachMinutes, weeklyGoal],
  );

  const week = useMemo(() => weekInsight(activities, weeklyGoal, now), [activities, now, weeklyGoal]);
  const dayMarks = useMemo(() => weekDayMarks(activities, now), [activities, now]);
  const dayCaption = useMemo(
    () => weekMovementCaption(dayMarks, streak.current),
    [dayMarks, streak.current],
  );
  const movedDays = useMemo(() => dayMarks.filter((mark) => mark.moved).length, [dayMarks]);
  const recent = useMemo(() => recentActivityCards(activities, 2), [activities]);

  const upcoming = useMemo<UpcomingRow[]>(() => {
    const rows: UpcomingRow[] = [];

    if (goalRace) {
      const countdown = goalRaceCountdown(goalRace.raceDate, now);
      rows.push({
        key: `goal-${goalRace.raceId}`,
        badge: dayCountLabel(goalRace.raceDate, now),
        title: goalRace.name,
        meta: `목표 대회 · ${goalRace.region} · ${goalRacePhaseLabels[countdown.phase]}`,
        accessibilityHint: '목표 대회 상세를 열어요',
        onPress: () => onOpenRace(goalRace.raceId),
      });
    }

    for (const plan of upcomingPlans(plans, kstDayKey(new Date(now)), 2)) {
      rows.push({
        key: `plan-${plan.id}`,
        badge: dayCountLabel(plan.date, now),
        title: plan.title,
        meta: `내가 적어 둔 일정 · ${plan.date}`,
        accessibilityHint: '캘린더에서 자세히 봐요',
        onPress: openCalendar,
      });
    }

    const openGroups = groupRaces(feed.races, now).filter((group) => group.status === '접수 중');
    const closingSoon = openGroups
      .map((group) => ({
        group,
        deadline: registrationDeadlineLabel(group.primary.registrationClosesAt, now),
      }))
      .filter((entry) => entry.deadline !== undefined);
    const raceCandidates =
      closingSoon.length > 0
        ? closingSoon
        : openGroups.slice(0, 2).map((group) => ({ group, deadline: undefined }));

    for (const { group, deadline } of raceCandidates) {
      if (goalRace && group.raceIds.includes(goalRace.raceId)) continue;
      rows.push({
        key: `race-${group.id}`,
        badge: dayCountLabel(group.raceDate, now),
        title: group.name,
        meta: `${deadline ?? group.status} · ${group.region} · ${group.distances.join(' · ')}`,
        accessibilityHint: '대회 상세와 접수 알림을 열어요',
        onPress: () => onOpenRace(group.id),
      });
    }

    return rows.slice(0, UPCOMING_LIMIT);
  }, [feed.races, goalRace, now, onOpenRace, openCalendar, plans]);

  // 발견 자리는 앱 안의 기존 목록에서 그날 하나씩만 고릅니다(없는 항목을 지어내지 않습니다).
  // 러닝화는 하나만 뽑던 것을 순위 다섯 줄(ShoeRankingCard)로 바꿨습니다. 가격이 같이 보입니다.
  const knowledge = useMemo(
    () =>
      pickForToday(
        knowledgeCards.filter(
          (card) => isPlainKorean(card.question) && isPlainKorean(card.answer[0] ?? ''),
        ),
        now,
      ),
    [now],
  );

  return (
    <ScrollView
      contentContainerStyle={screenStyles.content}
      showsVerticalScrollIndicator={false}
      style={screenStyles.root}
    >
      {storageError ? <Banner title="저장 상태 안내" body={storageError} tone="warning" /> : null}

      {/* ① 인사 + 오늘 한 문장 + ② 큰 시작 버튼: 스크롤 없이 여기까지 보입니다. */}
      <Card
        accessibilityLabel={`오늘 안내. ${headline.text}`}
        style={styles.hero}
        tone="navy"
      >
        <Text style={styles.heroEyebrow}>{greetingLine(preferences.nickname, now)}</Text>
        <Text style={styles.heroHeadline}>{headline.text}</Text>
        <Button
          accessibilityHint="음성 코치와 함께 오늘의 러닝을 시작해요"
          label={startActionLabel(todayPlan)}
          onPress={openStart}
          size="lg"
          style={styles.heroAction}
          testID="home-start-run"
          tone="secondary"
        />
        <Text style={styles.heroNote}>
          시간과 유형은 시작 화면에서 바꿀 수 있어요. 몸 상태가 우선이에요.
        </Text>
      </Card>

      {/*
        오늘 하나만 고른 제안입니다. 위 카드가 "그냥 뛰기"라면 이건 "오늘 뭘 하면 좋은지"입니다.
        최근 기록을 보고 정해지므로, 많이 뛴 다음 날에는 쉬라고 말합니다.
      */}
      <TodayCard
        activities={activities}
        hasPlanSessionLeft={Boolean(progress.current)}
        onStartPlanSession={() => {
          onStartTraining?.({ kind: 'plan' });
          onNavigate('programs');
        }}
        onStartWorkout={(template) => {
          onStartTraining?.({ kind: 'workout', workoutId: template.id });
          onNavigate('programs');
        }}
      />

      {/* ③+④ 이번 주 진행과 요일 7칸. 기록이 0건이면 숫자 카드 대신 첫 러닝 안내를 둡니다. */}
      {stage === 'new' ? (
        <EmptyState
          title="첫 러닝을 시작해볼까요?"
          body="처음에는 20~30분 안에서 걷기와 달리기를 섞는 것으로 충분해요. 음성 코치가 언제 걷고 언제 뛸지 알려 주고, 끝나면 이 기기에 기록이 남아요."
          actionLabel="짧게 첫 러닝 시작"
          onAction={openStart}
          secondaryActionLabel="캘린더에 첫 계획 적어 두기"
          onSecondaryAction={openCalendar}
          hint="로그인 없이 쓸 수 있고, 기록은 기기 밖으로 자동 전송되지 않아요."
        />
      ) : (
        <Card style={styles.stackCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              이번 주 목표 · {goalMetricLabels[weeklyGoal.metric]}
            </Text>
            <Chip label={week.met ? '달성' : '진행 중'} tone={week.met ? 'positive' : 'accent'} />
          </View>
          <ProgressBar
            label={week.valueLabel}
            ratio={week.ratio}
            tone={week.met ? 'positive' : 'accent'}
          />
          <Text style={styles.cardBody}>{week.meaning}</Text>
          <View
            accessibilityLabel={`이번 주 움직인 날 ${movedDays}일`}
            style={styles.dayStrip}
          >
            {dayMarks.map((mark) => (
              <DayCell key={mark.key} mark={mark} />
            ))}
          </View>
          <Text style={styles.cardCaption}>{dayCaption}</Text>
          <Button label="기록·통계 보기" onPress={openStats} tone="quiet" />
        </Card>
      )}

      {/* ⑤ 다가오는 것 */}
      <SectionHeader
        title="다가오는 것"
        subtitle="목표 대회, 내가 적어 둔 일정, 접수 마감이 가까운 대회예요."
        action={<Button label="대회 전체" onPress={openAllRaces} tone="quiet" />}
      />
      {loading && upcoming.length === 0 ? (
        <Card accessibilityLabel="대회 정보를 불러오는 중이에요" style={styles.loadingCard}>
          <Skeleton height={typeScale.titleSmall} width="72%" />
          <Skeleton height={typeScale.caption} width="54%" />
          <Skeleton height={typeScale.caption} width="46%" />
        </Card>
      ) : upcoming.length > 0 ? (
        <View style={styles.rowList}>
          {upcoming.map((row, index) => (
            <Pressable
              accessibilityHint={row.accessibilityHint}
              accessibilityLabel={`${row.badge} ${row.title}. ${row.meta}`}
              accessibilityRole="button"
              key={row.key}
              onPress={row.onPress}
              style={({ pressed }) => [
                styles.row,
                index < upcoming.length - 1 && styles.rowDivider,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.rowBadge}>
                <Text style={styles.rowBadgeText}>{row.badge}</Text>
              </View>
              <View style={styles.rowCopy}>
                <Text numberOfLines={1} style={styles.rowTitle}>
                  {row.title}
                </Text>
                <Text numberOfLines={1} style={styles.rowMeta}>
                  {row.meta}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          title="아직 다가오는 일정이 없어요"
          body="목표로 삼을 대회를 정하거나 캘린더에 러닝 일정을 적어 두면 여기에서 남은 날을 세어 드려요."
          actionLabel="대회 둘러보기"
          onAction={openAllRaces}
          secondaryActionLabel="캘린더에 일정 적기"
          onSecondaryAction={openCalendar}
          tone="muted"
        />
      )}

      {/* ⑥ 최근 기록 */}
      {recent.length > 0 ? (
        <>
          <SectionHeader
            title="최근 기록"
            subtitle="이 기기에 저장된 기록이에요."
            action={<Button label="전체" onPress={openStats} tone="quiet" />}
          />
          <Card style={styles.stackCard}>
            {recent.map((item, index) => (
              <RecentRow item={item} key={item.id} showDivider={index > 0} />
            ))}
          </Card>
        </>
      ) : null}

      {/*
        ⑦ 러닝화 순위 — 화면 아래쪽입니다.
        오늘 뛰러 나가려고 켠 사람을 방해하지 않으면서, 신발을 고민하는 사람은 반드시 만납니다.
        모든 줄에 값이 있습니다(정가를 알면 정가, 모르면 가격대 범위).
      */}
      <ShoeRankingCard
        onOpenAll={() => onOpenShoe(undefined)}
        onOpenShoe={(shoeId) => onOpenShoe(shoeId)}
        shoes={shoeCatalog}
      />

      {/* ⑧ 발견 */}
      <SectionHeader title="발견" subtitle="오늘 볼 만한 것 하나예요." />
      {knowledge ? (
        <Card style={styles.discoverCard}>
          <View style={styles.discoverCopy}>
            <Text style={styles.cardEyebrow}>러닝 Q&A</Text>
            <Text numberOfLines={2} style={styles.cardTitle}>
              {knowledge.question}
            </Text>
            <Text numberOfLines={2} style={styles.cardBody}>
              {knowledge.answer[0] ?? ''}
            </Text>
          </View>
          <Button label="답 읽어보기" onPress={openCommunity} tone="quiet" />
        </Card>
      ) : null}
    </ScrollView>
  );
}

// 요일 칸과 최근 기록 행은 memo 해 두어 홈이 다시 그려져도 행마다 다시 계산하지 않습니다.
const DayCell = memo(function DayCell({ mark }: { mark: HomeDayMark }) {
  return (
    <View
      accessibilityLabel={`${mark.label}요일 ${mark.moved ? '움직임' : '기록 없음'}`}
      style={[
        styles.dayCell,
        mark.moved && styles.dayCellMoved,
        mark.isToday && !mark.moved && styles.dayCellToday,
      ]}
    >
      <Text
        style={[
          styles.dayLabel,
          mark.isFuture && !mark.moved && styles.dayLabelFuture,
          mark.moved && styles.dayLabelMoved,
        ]}
      >
        {mark.label}
      </Text>
    </View>
  );
});

const RecentRow = memo(function RecentRow({
  item,
  showDivider,
}: {
  item: HomeRecentActivity;
  showDivider: boolean;
}) {
  return (
    <View style={[styles.recentRow, showDivider && styles.recentRowDivider]}>
      <Text style={styles.rowTitle}>{item.title}</Text>
      <Text style={styles.rowMeta}>{item.meta}</Text>
      <Text style={styles.rowNote}>{item.note}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  // ── 오늘(히어로) ─────────────────────────────────────────────────────────
  hero: { padding: spacing.xl, gap: spacing.sm },
  heroEyebrow: {
    color: palette.onNavyAccent,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.bold,
  },
  heroHeadline: {
    color: palette.onNavy,
    fontSize: typeScale.headline,
    lineHeight: lineHeight.headline,
    fontWeight: fontWeight.heavy,
    letterSpacing: -0.6,
  },
  heroAction: { marginTop: spacing.xs },
  heroNote: {
    color: palette.onNavyMuted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },

  // ── 카드 공통 ────────────────────────────────────────────────────────────
  // 섹션 카드는 모두 같은 간격 규칙을 씁니다(제목 → 내용 → 행동).
  stackCard: { gap: spacing.sm },
  loadingCard: { gap: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardEyebrow: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    fontWeight: fontWeight.heavy,
    letterSpacing: 0.6,
  },
  cardTitle: {
    flex: 1,
    minWidth: 0,
    color: palette.ink,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.heavy,
  },
  cardBody: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  cardCaption: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },

  // ── 이번 주 요일 7칸 ─────────────────────────────────────────────────────
  dayStrip: { flexDirection: 'row', gap: spacing.xxs },
  dayCell: {
    flex: 1,
    minWidth: 0,
    // 누르는 칸이 아니라 표시용이라 48px 대신 한 칸이 정사각형에 가깝게 보이는 높이를 씁니다.
    minHeight: layout.touchTarget - spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: palette.surfaceMuted,
    backgroundColor: palette.surfaceMuted,
  },
  dayCellMoved: { borderColor: palette.accentStrong, backgroundColor: palette.accentStrong },
  dayCellToday: { borderColor: palette.accentStrong, borderWidth: borderWidth.emphasis },
  dayLabel: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.bold,
  },
  dayLabelFuture: { color: palette.muted },
  dayLabelMoved: { color: palette.white },

  // ── 목록 행(다가오는 것) ─────────────────────────────────────────────────
  rowList: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    minHeight: layout.touchTarget + spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // 꼬리표 폭을 고정해 제목의 왼쪽 시작점을 모든 행에서 맞춥니다.
  rowBadge: {
    minWidth: layout.touchTarget + spacing.md,
    minHeight: layout.touchTarget - spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: palette.accentSoft,
    paddingHorizontal: spacing.xs,
  },
  rowBadgeText: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.heavy,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
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
  },

  // ── 최근 기록 ────────────────────────────────────────────────────────────
  recentRow: { gap: spacing.xxs },
  recentRowDivider: {
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  rowNote: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.bold,
  },

  // ── 발견 ─────────────────────────────────────────────────────────────────
  // 두 카드의 최소 높이를 같게 잡아 나란히 봤을 때 들쭉날쭉하지 않게 합니다.
  discoverCard: { minHeight: layout.touchTarget * 4, gap: spacing.sm },
  discoverCopy: { flex: 1, gap: spacing.xxs },

  pressed: { opacity: pressedOpacity },
});
