// 오늘의 러닝 한 장과 작은 진행 정보만 우선 보여주는 러닝봄 홈입니다.
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Chip, SectionHeader, Wordmark } from '../../design-system/components';
import { palette, radius, spacing, typeScale } from '../../design-system/theme';
import { useAppState } from '../../state/AppStateProvider';
import { useRaceState } from '../../state/RaceStateProvider';
import { registrationStatusLabel } from '../../../src/races';
import { shoes } from '../../../domains/shoes/catalog';
import type { ExploreSection } from '../../navigation/types';

type Props = {
  onStart: () => void;
  onExplore: (
    section: ExploreSection,
    options?: { raceId?: string; shoeId?: string },
  ) => void;
  onCommunity: () => void;
  onProgress: () => void;
};

export function HomeScreen({ onStart, onExplore, onCommunity, onProgress }: Props) {
  const { preferences, streak, storageError } = useAppState();
  const { feed } = useRaceState();
  const upcomingRaces = useMemo(
    () =>
      feed.races
        .filter((race) => {
          const status = registrationStatusLabel(race);
          return status === '접수 중' || status === '접수 예정';
        })
        .slice(0, 3),
    [feed.races],
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Wordmark />
          <Text style={styles.tagline}>출발선에 서는 날</Text>
        </View>

        {storageError ? (
          <View accessibilityLiveRegion="polite" style={styles.notice}>
            <Text style={styles.noticeText}>{storageError}</Text>
          </View>
        ) : null}

        <Card style={styles.todayCard} accessibilityLabel="오늘의 러닝 추천">
          <Text style={styles.eyebrow}>TODAY RUN</Text>
          <Text style={styles.todayTitle}>오늘의 러닝</Text>
          <Text style={styles.todayPlan}>
            {preferences.coachMinutes}분 · {preferences.coachType}
          </Text>
          <Text style={styles.todayDescription}>
            지난 선택을 기억했어요. 세부 시간과 유형은 시작 화면에서 바꿀 수 있어요.
          </Text>
          <View style={styles.todayActions}>
            <Button label="변경" onPress={onStart} tone="secondary" style={styles.action} />
            <Button label="시작" onPress={onStart} style={styles.action} />
          </View>
        </Card>

        <Pressable
          accessibilityRole="button"
          onPress={onProgress}
          style={({ pressed }) => [styles.progressRow, pressed && styles.pressed]}
        >
          <View style={styles.progressCopy}>
            <Text style={styles.progressTitle}>
              {streak.current > 0 ? `연속 ${streak.current}일` : '오늘부터 시작'}
            </Text>
            <Text style={styles.progressSubtitle}>이번 주 러닝 {Math.min(streak.weeklyRunDays, 3)}/3회</Text>
          </View>
          <Text style={styles.progressLink}>자세히</Text>
        </Pressable>

        <SectionHeader
          title="커뮤니티 하이라이트"
          subtitle="로그인하지 않아도 공개 글을 읽을 수 있어요."
          action={<Button label="보기" onPress={onCommunity} tone="quiet" />}
        />
        <Card style={styles.emptyCommunity}>
          <Text style={styles.emptyTitle}>공개 피드를 준비 중이에요</Text>
          <Text style={styles.emptyBody}>
            가짜 사용자나 자동 게시물은 만들지 않아요. 연결된 운영 데이터만 표시합니다.
          </Text>
        </Card>

        <SectionHeader
          title="다가오는 대회"
          subtitle={`검증 데이터 ${feed.revision}`}
          action={<Button label="전체" onPress={() => onExplore('대회')} tone="quiet" />}
        />
        <View style={styles.compactList}>
          {upcomingRaces.map((race) => (
            <Pressable
              key={race.id}
              accessibilityRole="button"
              onPress={() => onExplore('대회', { raceId: race.id })}
              style={({ pressed }) => [styles.compactItem, pressed && styles.pressed]}
            >
              <View style={styles.compactCopy}>
                <Text style={styles.compactTitle}>{race.name}</Text>
                <Text style={styles.compactMeta}>
                  {race.region} · {race.distances.join(' · ')}
                </Text>
              </View>
              <Chip
                label={registrationStatusLabel(race)}
                tone={registrationStatusLabel(race) === '접수 중' ? 'positive' : 'warning'}
              />
            </Pressable>
          ))}
        </View>

        <SectionHeader
          title="신제품 러닝화"
          subtitle="공식 사실과 러닝봄 편집 설명을 구분했어요."
          action={<Button label="전체" onPress={() => onExplore('러닝화')} tone="quiet" />}
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
              onPress={() => onExplore('러닝화', { shoeId: shoe.id })}
              style={({ pressed }) => [styles.shoeCard, pressed && styles.pressed]}
            >
              <Text style={styles.shoeBrand}>{shoe.brand}</Text>
              <Text style={styles.shoeModel}>{shoe.model}</Text>
              <Text style={styles.shoeMeta}>{shoe.koreaStatus}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <SectionHeader title="크루 다음 일정" />
        <Card>
          <Text style={styles.emptyTitle}>가입한 크루 일정이 없어요</Text>
          <Text style={styles.emptyBody}>
            크루 연결은 선택 기능이며, 러닝·대회 탐색은 로그인 없이 모두 사용할 수 있어요.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  content: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: 112,
  },
  hero: { paddingTop: spacing.sm, paddingBottom: spacing.lg },
  tagline: {
    color: palette.muted,
    fontSize: typeScale.body,
    marginTop: spacing.xs,
  },
  notice: {
    backgroundColor: palette.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  noticeText: { color: palette.warning, fontSize: typeScale.bodySmall, lineHeight: 20 },
  todayCard: { backgroundColor: palette.navy, borderColor: palette.navy, padding: spacing.xl },
  eyebrow: {
    color: '#FFB596',
    fontSize: typeScale.caption,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
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
  progressRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
  },
  progressCopy: { flex: 1, minWidth: 0 },
  progressTitle: { color: palette.ink, fontSize: typeScale.body, fontWeight: '900' },
  progressSubtitle: { color: palette.muted, fontSize: typeScale.bodySmall, marginTop: 2 },
  progressLink: { color: palette.accentDark, fontSize: typeScale.bodySmall, fontWeight: '800' },
  emptyCommunity: { backgroundColor: palette.surfaceWarm },
  emptyTitle: { color: palette.ink, fontSize: typeScale.body, fontWeight: '900' },
  emptyBody: { color: palette.muted, fontSize: typeScale.bodySmall, lineHeight: 20, marginTop: spacing.xs },
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
  shoeMeta: { color: palette.inkSoft, fontSize: typeScale.caption, lineHeight: 17, marginTop: spacing.md },
  pressed: { opacity: 0.72 },
});
