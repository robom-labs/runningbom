// 커뮤니티 맨 위에 두는 내 프로필 요약입니다.
// 닉네임 · 이번 주 요약 · 대표 배지를 한 줄씩 보여 주고, 누르면 프로필 화면으로 갑니다.
// 배지 계산은 domains/badges의 규칙을 그대로 읽기만 하고 여기서 새로 만들지 않습니다.
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Chip } from '../../design-system/components';
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
import {
  currentWeekStart,
  formatDistance,
  formatDuration,
  totalsForWeek,
} from '../../../domains/activities/summary';
import { highlightBadge, toBadgeView } from '../../../domains/badges/presentation';
import { useAppState } from '../../state/AppStateProvider';

type Props = {
  /** 있으면 카드 전체가 눌러서 프로필로 가는 버튼이 됩니다. */
  onOpenProfile?: () => void;
};

export function ProfileSummaryCard({ onOpenProfile }: Props) {
  const { activities, badgeProgress, preferences, streak } = useAppState();

  const weekLine = useMemo(() => {
    const totals = totalsForWeek(activities, currentWeekStart());
    if (totals.sessions === 0) return '이번 주 기록이 아직 없어요';
    const parts = [`${totals.sessions}번`, formatDuration(totals.minutes)];
    if (totals.distanceKm > 0) parts.push(formatDistance(totals.distanceKm));
    return `이번 주 ${parts.join(' · ')}`;
  }, [activities]);

  const featured = useMemo(() => {
    const views = badgeProgress.map((entry) => toBadgeView(entry));
    return highlightBadge(views, preferences.featuredBadgeId);
  }, [badgeProgress, preferences.featuredBadgeId]);

  const nickname = preferences.nickname.trim() || '러너';
  const label = `${nickname} 프로필. ${weekLine}.${featured ? ` 대표 배지 ${featured.badge.title}.` : ''}`;

  const body = (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{nickname.slice(0, 1)}</Text>
        </View>
        <View style={styles.headCopy}>
          <Text numberOfLines={1} style={styles.nickname}>
            {nickname}
          </Text>
          <Text style={styles.tier}>{streak.tier}</Text>
        </View>
        {onOpenProfile ? <Text style={styles.goText}>프로필 보기 ›</Text> : null}
      </View>

      <Text style={styles.week}>{weekLine}</Text>

      <View style={styles.badgeRow}>
        {featured ? (
          <Chip
            accessibilityLabel={`대표 배지 ${featured.badge.title}`}
            label={`대표 배지 · ${featured.badge.title}`}
            tone="accent"
          />
        ) : (
          <Text style={styles.badgeEmpty}>
            아직 받은 배지가 없어요. 러닝을 마치면 하나씩 열려요.
          </Text>
        )}
      </View>
    </View>
  );

  if (!onOpenProfile) {
    return <View accessibilityLabel={label}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityHint="내 프로필 화면으로 이동해요."
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onOpenProfile}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { minHeight: layout.touchTarget, borderRadius: radius.lg },
  pressed: { opacity: pressedOpacity },
  card: {
    gap: spacing.xs,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: borderWidth.thin,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentSoft,
  },
  avatarText: {
    color: palette.accentDark,
    fontSize: typeScale.title,
    lineHeight: lineHeight.title,
    fontWeight: fontWeight.heavy,
  },
  headCopy: { flex: 1, minWidth: 0 },
  nickname: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
  },
  tier: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.semibold,
  },
  goText: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.bold,
  },
  week: {
    color: palette.inkSoft,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.semibold,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  badgeEmpty: {
    flex: 1,
    minWidth: 0,
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
});
