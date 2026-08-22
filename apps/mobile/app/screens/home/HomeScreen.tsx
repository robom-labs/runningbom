// 러닝봄의 대회 중심 홈입니다. 접수 탐색과 내 일정만 첫 화면에 노출합니다.
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Banner, Button, Card, EmptyState, SectionHeader, Skeleton, screenStyles } from '../../design-system/components';
import { fontWeight, layout, lineHeight, palette, pressedOpacity, radius, spacing, typeScale } from '../../design-system/theme';
import { useAppState } from '../../state/AppStateProvider';
import { useRaceState } from '../../state/RaceStateProvider';
import { kstDayKey } from '../../../domains/activities/summary';
import { upcomingPlans } from '../../../domains/activities/plans';
import { groupRaces, raceGroupLinkStatus } from '../../../domains/races/aggregate';
import { goalRaceCountdown, goalRacePhaseLabels } from '../../../domains/races/goalRace';
import { useGoalRace } from '../../../domains/races/useGoalRace';
import { raceVisitChangeLabel } from '../../../domains/races/visitChanges';
import type { RouteKey } from '../../navigation/types';
import { dayCountLabel, greetingLine, registrationDeadlineLabel } from './model';

type Props = {
  onNavigate: (route: RouteKey) => void;
  onOpenRace: (raceId?: string) => void;
};

type UpcomingRow = {
  key: string;
  badge: string;
  title: string;
  meta: string;
  detail?: string;
  linkStatus?: string;
  accessibilityHint: string;
  onPress: () => void;
};

const UPCOMING_LIMIT = 4;

export function HomeScreen({ onNavigate, onOpenRace }: Props) {
  const { preferences, storageError, plans } = useAppState();
  const { feed, loading, visitChanges, dismissVisitChanges } = useRaceState();
  const [showAllVisitChanges, setShowAllVisitChanges] = useState(false);
  const { goalRace } = useGoalRace();
  const now = useMemo(() => Date.now(), []);
  const openAllRaces = useCallback(() => onOpenRace(undefined), [onOpenRace]);
  const openCalendar = useCallback(() => onNavigate('calendar'), [onNavigate]);
  const raceGroups = useMemo(
    () => groupRaces(feed.races, now),
    [feed.races, now],
  );
  const openRaceGroups = useMemo(
    () => raceGroups.filter((group) => group.status === '접수 중'),
    [raceGroups],
  );
  const allVisitChangeRows = useMemo(() => {
    const groupByRaceId = new Map(raceGroups.flatMap((group) => group.raceIds.map((id) => [id, group])));
    return visitChanges.flatMap((change) => {
      const group = groupByRaceId.get(change.raceId);
      if (!group) return [];
      return [{
        key: `${change.kind}-${group.id}`,
        badge: raceVisitChangeLabel(change.kind),
        title: group.name,
        meta: `${group.status} · ${group.region} · ${group.raceDate}`,
        detail: change.detail,
        linkStatus: raceGroupLinkStatus(group),
        accessibilityHint: '새로 확인할 대회 상세를 열어요',
        onPress: () => onOpenRace(group.id),
      } satisfies UpcomingRow];
    });
  }, [onOpenRace, raceGroups, visitChanges]);
  const visitChangeRows = useMemo(
    () => allVisitChangeRows.slice(0, showAllVisitChanges ? allVisitChangeRows.length : 3),
    [allVisitChangeRows, showAllVisitChanges],
  );

  const upcoming = useMemo<UpcomingRow[]>(() => {
    const rows: UpcomingRow[] = [];
    if (goalRace) {
      const countdown = goalRaceCountdown(goalRace.raceDate, now);
      rows.push({
        key: `goal-${goalRace.raceId}`,
        badge: dayCountLabel(goalRace.raceDate, now),
        title: goalRace.name,
        meta: `내 목표 대회 · ${goalRace.region} · ${goalRacePhaseLabels[countdown.phase]}`,
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
        accessibilityHint: '내 일정에서 자세히 봐요',
        onPress: openCalendar,
      });
    }
    const closingSoon = openRaceGroups
      .map((group) => ({ group, deadline: registrationDeadlineLabel(group.primary.registrationClosesAt, now) }))
      .filter((entry) => entry.deadline !== undefined);
    const candidates = closingSoon.length > 0
      ? closingSoon
      : openRaceGroups.slice(0, 2).map((group) => ({ group, deadline: undefined }));
    for (const { group, deadline } of candidates) {
      if (goalRace && group.raceIds.includes(goalRace.raceId)) continue;
      rows.push({
        key: `race-${group.id}`,
        badge: dayCountLabel(group.raceDate, now),
        title: group.name,
        meta: `${deadline ?? group.status} · ${group.region} · ${group.distances.join(' · ')}`,
        linkStatus: raceGroupLinkStatus(group),
        accessibilityHint: '대회 상세와 접수 알림을 열어요',
        onPress: () => onOpenRace(group.id),
      });
    }
    return rows.slice(0, UPCOMING_LIMIT);
  }, [goalRace, now, onOpenRace, openCalendar, openRaceGroups, plans]);

  return (
    <ScrollView contentContainerStyle={screenStyles.content} showsVerticalScrollIndicator={false} style={screenStyles.root}>
      {storageError ? <Banner title="저장 상태 안내" body={storageError} tone="warning" /> : null}
      <Card accessibilityLabel="접수 중 대회 찾기" style={styles.hero} tone="navy">
        <Text style={styles.heroEyebrow}>{greetingLine(preferences.nickname, now)} · 대회 일정과 접수 알림</Text>
        <Text style={styles.heroHeadline}>지금 접수 중인{`\n`}대회를 찾아보세요</Text>
        <Button accessibilityHint="접수 중인 대회를 지역과 거리로 찾아봐요" label={loading ? '대회 일정 불러오는 중' : '접수 중 대회 보기'} onPress={openAllRaces} size="lg" style={styles.heroAction} testID="home-open-races" tone="secondary" />
        <Text style={styles.heroNote}>출처와 마지막 확인 시각을 보고, 최종 접수 조건은 외부 페이지에서 확인하세요.</Text>
      </Card>

      {visitChangeRows.length > 0 ? (
        <>
          <SectionHeader
            title="지난번 이후 새로 확인한 대회"
            subtitle="새 대회, 접수 시작, 링크와 일정 변경만 먼저 모았어요."
            action={allVisitChangeRows.length > 3 ? <Button label={showAllVisitChanges ? '접기' : `전체 ${allVisitChangeRows.length}건 보기`} onPress={() => setShowAllVisitChanges((current) => !current)} tone="quiet" /> : undefined}
          />
          <View style={styles.rowList}>
            {visitChangeRows.map((row, index) => (
              <Pressable accessibilityHint={row.accessibilityHint} accessibilityLabel={`${row.badge} ${row.title}. ${row.meta}`} accessibilityRole="button" key={row.key} onPress={row.onPress} style={({ pressed }) => [styles.row, index < visitChangeRows.length - 1 && styles.rowDivider, pressed && styles.pressed]}>
                <View style={styles.rowBadge}><Text style={styles.rowBadgeText}>{row.badge}</Text></View>
                <View style={styles.rowCopy}>
                  <Text numberOfLines={1} style={styles.rowTitle}>{row.title}</Text>
                  <Text numberOfLines={1} style={styles.rowMeta}>{row.meta}</Text>
                  {row.detail ? <Text numberOfLines={1} style={styles.rowDetail}>{row.detail}</Text> : null}
                  {row.linkStatus ? <Text style={styles.rowLinkStatus}>{row.linkStatus}</Text> : null}
                </View>
              </Pressable>
            ))}
          </View>
          {showAllVisitChanges ? <Button label="이 변경을 확인했어요" onPress={() => void dismissVisitChanges()} style={styles.visitChangesAction} tone="quiet" /> : null}
        </>
      ) : null}

      <SectionHeader title="내 대회와 일정" subtitle="목표 대회, 내가 적어 둔 일정, 접수 마감이 가까운 대회예요." action={<Button label="내 일정" onPress={openCalendar} tone="quiet" />} />
      {loading && upcoming.length === 0 ? (
        <Card accessibilityLabel="대회 정보를 불러오는 중이에요" style={styles.loadingCard}>
          <Skeleton height={typeScale.titleSmall} width="72%" />
          <Skeleton height={typeScale.caption} width="54%" />
          <Skeleton height={typeScale.caption} width="46%" />
        </Card>
      ) : upcoming.length > 0 ? (
        <View style={styles.rowList}>
          {upcoming.map((row, index) => (
            <Pressable accessibilityHint={row.accessibilityHint} accessibilityLabel={`${row.badge} ${row.title}. ${row.meta}`} accessibilityRole="button" key={row.key} onPress={row.onPress} style={({ pressed }) => [styles.row, index < upcoming.length - 1 && styles.rowDivider, pressed && styles.pressed]}>
              <View style={styles.rowBadge}><Text style={styles.rowBadgeText}>{row.badge}</Text></View>
              <View style={styles.rowCopy}>
                <Text numberOfLines={1} style={styles.rowTitle}>{row.title}</Text>
                <Text numberOfLines={1} style={styles.rowMeta}>{row.meta}</Text>
                {row.linkStatus ? <Text style={styles.rowLinkStatus}>{row.linkStatus}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState title="아직 다가오는 대회가 없어요" body="지역과 거리로 대회를 찾아 목표로 저장하면 접수와 대회 일정을 한곳에서 볼 수 있어요." actionLabel="대회 둘러보기" onAction={openAllRaces} secondaryActionLabel="내 일정 적기" onSecondaryAction={openCalendar} tone="muted" />
      )}

      <SectionHeader title="이용 안내" subtitle="접수 전에는 언제나 공식 페이지를 한 번 더 확인하세요." />
      <Card style={styles.guidanceCard}>
        <Text style={styles.guidanceTitle}>대회 정보는 확인 시각과 출처를 함께 보여드려요.</Text>
        <Text style={styles.guidanceBody}>관심 대회로 저장하면 접수·대회·결과 알림을 관리할 수 있고, 실제 신청은 검증된 외부 페이지에서 진행합니다.</Text>
        <Button label="대회와 알림 확인" onPress={openAllRaces} tone="quiet" />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { padding: spacing.xl, gap: spacing.sm },
  heroEyebrow: { color: palette.onNavyAccent, fontSize: typeScale.caption, lineHeight: lineHeight.caption, fontWeight: fontWeight.bold },
  heroHeadline: { color: palette.onNavy, fontSize: typeScale.headline, lineHeight: lineHeight.headline, fontWeight: fontWeight.heavy, letterSpacing: -0.6 },
  heroAction: { marginTop: spacing.xs },
  heroNote: { color: palette.onNavyMuted, fontSize: typeScale.caption, lineHeight: lineHeight.caption },
  loadingCard: { gap: spacing.sm },
  rowList: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: palette.surface, borderColor: palette.line, borderWidth: StyleSheet.hairlineWidth },
  row: { minHeight: layout.touchTarget + spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rowDivider: { borderBottomColor: palette.line, borderBottomWidth: StyleSheet.hairlineWidth },
  rowBadge: { minWidth: layout.touchTarget + spacing.xs, alignItems: 'center', paddingHorizontal: spacing.xs, paddingVertical: spacing.xs, borderRadius: radius.md, backgroundColor: palette.surfaceMuted },
  rowBadgeText: { color: palette.accentStrong, fontSize: typeScale.caption, lineHeight: lineHeight.caption, fontWeight: fontWeight.heavy },
  rowCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  rowTitle: { color: palette.ink, fontSize: typeScale.body, lineHeight: lineHeight.body, fontWeight: fontWeight.heavy },
  rowMeta: { color: palette.muted, fontSize: typeScale.caption, lineHeight: lineHeight.caption },
  rowDetail: { color: palette.inkSoft, fontSize: typeScale.caption, lineHeight: lineHeight.caption },
  rowLinkStatus: { color: palette.accentStrong, fontSize: typeScale.caption, lineHeight: lineHeight.caption, fontWeight: fontWeight.bold },
  visitChangesAction: { alignSelf: 'flex-start', marginTop: spacing.sm },
  guidanceCard: { gap: spacing.sm },
  guidanceTitle: { color: palette.ink, fontSize: typeScale.body, lineHeight: lineHeight.body, fontWeight: fontWeight.heavy },
  guidanceBody: { color: palette.inkSoft, fontSize: typeScale.bodySmall, lineHeight: lineHeight.bodySmall },
  pressed: { opacity: pressedOpacity },
});
