// 배지 전용 화면입니다. 기록·통계 화면에 섞여 있던 배지를 여기로 모았습니다.
// 라우팅은 부모가 합니다. 이 화면은 onBack만 받아서 되돌아갈 길을 열어 둡니다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  EmptyState,
  ProgressBar,
  SectionHeader,
  screenStyles,
} from '../../design-system/components';
import { BadgeEmblem } from '../../design-system/emblem';
import {
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
import {
  badgeCategoryLabels,
  badgeCategoryOrder,
  badgeTierLabels,
  badgeTierNotes,
  type BadgeCategory,
} from '../../../domains/badges/rules';
import {
  badgeSections,
  badgeTally,
  earnedDates,
  mostRecentEarned,
  nearestBadge,
  newlyEarnedBadges,
  toBadgeView,
  type BadgeView,
} from '../../../domains/badges/presentation';
import { BadgeAward } from './BadgeAward';
import { BadgeCard } from './BadgeCard';
import { BadgeDetail } from './BadgeDetail';

export type BadgesScreenProps = {
  /** 부모가 이전 화면으로 돌려보낼 때 씁니다. 없으면 돌아가기 버튼을 감춥니다. */
  onBack?: () => void;
};

export function BadgesScreen({ onBack }: BadgesScreenProps) {
  const { badgeProgress, activities, preferences, updatePreferences, ready } = useAppState();
  const [openCategory, setOpenCategory] = useState<BadgeCategory | 'all'>('all');
  const [detailId, setDetailId] = useState<string>();
  const [awardQueue, setAwardQueue] = useState<BadgeView[]>([]);
  const seenIdsRef = useRef<string[] | undefined>(undefined);

  const dates = useMemo(() => earnedDates(activities), [activities]);

  const views = useMemo(
    () => badgeProgress.map((entry) => toBadgeView(entry, dates[entry.badge.id])),
    [badgeProgress, dates],
  );

  const tally = useMemo(() => badgeTally(views), [views]);
  const highlight = useMemo(() => mostRecentEarned(views, dates), [dates, views]);
  const nearest = useMemo(() => nearestBadge(views), [views]);

  const sections = useMemo(() => {
    const scoped =
      openCategory === 'all' ? views : views.filter((view) => view.badge.category === openCategory);
    return badgeSections(scoped);
  }, [openCategory, views]);

  // 화면에 처음 들어온 순간의 배지를 "이미 본 것"으로 두고,
  // 그 뒤에 새로 열린 배지만 축하 카드로 띄웁니다.
  useEffect(() => {
    if (!ready) return;
    const earnedIds = views.filter((view) => view.state === 'earned').map((view) => view.badge.id);
    if (!seenIdsRef.current) {
      seenIdsRef.current = earnedIds;
      return;
    }
    const fresh = newlyEarnedBadges(seenIdsRef.current, views);
    if (fresh.length === 0) return;
    seenIdsRef.current = earnedIds;
    setAwardQueue((queue) => [...queue, ...fresh]);
  }, [ready, views]);

  const detailView = useMemo(
    () => views.find((view) => view.badge.id === detailId),
    [detailId, views],
  );

  const openDetail = useCallback((badgeId: string) => setDetailId(badgeId), []);
  const closeDetail = useCallback(() => setDetailId(undefined), []);
  const dismissAward = useCallback(() => setAwardQueue((queue) => queue.slice(1)), []);
  const featureBadge = useCallback(
    (badgeId: string) => {
      void updatePreferences({ featuredBadgeId: badgeId });
    },
    [updatePreferences],
  );

  return (
    <View style={screenStyles.root}>
      <ScrollView contentContainerStyle={screenStyles.content}>
        {onBack ? (
          <View style={styles.backRow}>
            <Button
              accessibilityHint="이전 화면으로 돌아가요"
              label="돌아가기"
              onPress={onBack}
              tone="quiet"
            />
          </View>
        ) : null}

        <SectionHeader
          title="배지"
          subtitle={`${tally.earned}개를 받았어요 · 전체 ${tally.total}개`}
        />
        <ProgressBar
          label={`${tally.earned} / ${tally.total}`}
          ratio={tally.ratio}
          tone={tally.ratio >= 1 ? 'positive' : 'accent'}
        />

        {highlight ? (
          <Pressable
            accessibilityHint="배지 자세히 보기"
            accessibilityLabel={`가장 최근에 받은 배지 ${highlight.badge.title}`}
            accessibilityRole="button"
            onPress={() => openDetail(highlight.badge.id)}
            style={({ pressed }) => [pressed && { opacity: pressedOpacity }]}
          >
            <Card elevated style={styles.highlight} tone="warm">
              <Text style={styles.eyebrow}>가장 최근에 받은 배지</Text>
              <BadgeEmblem
                category={highlight.badge.category}
                size={128}
                state="earned"
                tier={highlight.badge.tier}
              />
              <Text accessibilityRole="header" style={styles.highlightTitle}>
                {highlight.badge.title}
              </Text>
              <Text style={styles.highlightBody}>{highlight.badge.description}</Text>
              <View style={styles.chips}>
                <Chip label={badgeTierLabels[highlight.badge.tier]} tone="positive" />
                <Chip label={badgeCategoryLabels[highlight.badge.category]} />
              </View>
              {highlight.earnedLabel ? (
                <Text style={styles.highlightMeta}>받은 날 · {highlight.earnedLabel}</Text>
              ) : (
                <Text style={styles.highlightMeta}>{badgeTierNotes[highlight.badge.tier]}</Text>
              )}
            </Card>
          </Pressable>
        ) : (
          <EmptyState
            body={
              nearest
                ? `"${nearest.badge.title}"까지 ${nearest.hintLabel.replace(' 받아요', ' 받아요.')}`
                : '오늘 한 번만 움직여도 첫 배지가 열려요.'
            }
            hint={nearest ? nearest.badge.description : undefined}
            title="첫 배지까지 이만큼 남았어요"
          />
        )}

        <ScrollView
          contentContainerStyle={styles.chipRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <Chip
            accessibilityRole="tab"
            label="전체"
            onPress={() => setOpenCategory('all')}
            selected={openCategory === 'all'}
            tone="accent"
          />
          {badgeCategoryOrder.map((category) => (
            <Chip
              accessibilityRole="tab"
              key={category}
              label={badgeCategoryLabels[category]}
              onPress={() => setOpenCategory(category)}
              selected={openCategory === category}
              tone="accent"
            />
          ))}
        </ScrollView>

        {sections.map((section) => (
          <View key={section.category} style={styles.section}>
            <SectionHeader
              compact
              title={section.label}
              subtitle={`${section.earned} / ${section.total} 받음`}
            />
            <View style={styles.grid}>
              {section.views.map((view) => (
                <BadgeCard
                  featured={preferences.featuredBadgeId === view.badge.id}
                  key={view.badge.id}
                  onPress={openDetail}
                  view={view}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <BadgeDetail
        featured={preferences.featuredBadgeId === detailView?.badge.id}
        onClose={closeDetail}
        onFeature={featureBadge}
        view={detailView}
      />
      <BadgeAward
        onDismiss={dismissAward}
        remaining={Math.max(0, awardQueue.length - 1)}
        view={awardQueue.at(0)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backRow: { alignItems: 'flex-start' },
  section: { gap: spacing.xs, paddingTop: spacing.sm },
  highlight: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xl },
  eyebrow: {
    color: palette.accentDark,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    fontWeight: fontWeight.heavy,
    letterSpacing: 1,
  },
  highlightTitle: {
    marginTop: spacing.xs,
    textAlign: 'center',
    color: palette.ink,
    fontSize: typeScale.title,
    lineHeight: lineHeight.title,
    fontWeight: fontWeight.heavy,
  },
  highlightBody: {
    textAlign: 'center',
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  highlightMeta: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  chipRow: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.xxs },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    maxWidth: layout.wideMaxWidth,
  },
});
