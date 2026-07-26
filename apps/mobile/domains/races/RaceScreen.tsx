// 대회를 카드형으로 보여줍니다. 같은 대회의 여러 종목은 카드 하나에 칩으로 묶입니다.
import * as Linking from 'expo-linking';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button, Card, Chip } from '../../app/design-system/components';
import { palette, radius, spacing, typeScale } from '../../app/design-system/theme';
import { useAppState } from '../../app/state/AppStateProvider';
import { useRaceState } from '../../app/state/RaceStateProvider';
import {
  canScheduleRegistrationAlert,
  formatRaceDate,
  formatRegistrationTime,
  registrationFilters,
  regionsFor,
  type RegistrationFilter,
} from '../../src/races';
import type { DistanceFilter, Race, RegionFilter } from '../../src/types';
import {
  filterRaceGroups,
  findGroupByRaceId,
  formatDDay,
  groupRaces,
  racePeriodFilters,
  type RaceGroup,
  type RacePeriodFilter,
} from './aggregate';

type Props = {
  focusedRaceId?: string;
};

const distanceChoices: DistanceFilter[] = ['전체', 'Full', 'Half', '10K', '5K', 'Trail'];

const distanceLabels: Record<string, string> = {
  전체: '전체',
  Full: '풀코스',
  Half: '하프',
  '10K': '10K',
  '5K': '5K',
  Trail: '트레일',
};

function statusTone(status: string): 'positive' | 'warning' | 'neutral' {
  if (status === '접수 중') return 'positive';
  if (status === '접수 예정') return 'warning';
  return 'neutral';
}

export function RaceScreen({ focusedRaceId }: Props) {
  const { width } = useWindowDimensions();
  const { preferences, updatePreferences } = useAppState();
  const {
    feed,
    notice,
    loading,
    scheduledRaceIds,
    busyRaceId,
    refresh,
    scheduleAlert,
    cancelAlert,
  } = useRaceState();
  const [region, setRegion] = useState<RegionFilter>('전체');
  const [distance, setDistance] = useState<DistanceFilter>('전체');
  const [registration, setRegistration] = useState<RegistrationFilter>('전체');
  const [period, setPeriod] = useState<RacePeriodFilter>('전체');
  const [query, setQuery] = useState('');
  const [showRegionFilters, setShowRegionFilters] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | undefined>();
  const [expandedGroupId, setExpandedGroupId] = useState<string | undefined>();
  const [visibleCount, setVisibleCount] = useState(20);

  const groups = useMemo(() => groupRaces(feed.races), [feed.races]);

  useEffect(() => {
    const focused = findGroupByRaceId(groups, focusedRaceId);
    if (!focused) return;
    setRegion('전체');
    setDistance('전체');
    setRegistration('전체');
    setPeriod('전체');
    setQuery('');
    setActiveGroupId(focused.id);
    setExpandedGroupId(undefined);
    setVisibleCount(20);
  }, [focusedRaceId, groups]);

  const availableRegions = useMemo(() => regionsFor(feed.races), [feed.races]);

  const visibleGroups = useMemo(() => {
    const values = filterRaceGroups(groups, { region, distance, registration, period, query });
    if (!activeGroupId) return values;
    return [...values].sort((left, right) => {
      if (left.id === activeGroupId) return -1;
      if (right.id === activeGroupId) return 1;
      return 0;
    });
  }, [activeGroupId, distance, groups, period, query, region, registration]);

  const renderedGroups = visibleGroups.slice(0, visibleCount);

  async function openExternalUrl(race: Race) {
    if (!race.officialUrl?.startsWith('https://')) return;
    try {
      if (!(await Linking.canOpenURL(race.officialUrl))) throw new Error('unsupported');
      await Linking.openURL(race.officialUrl);
    } catch {
      Alert.alert('공식 페이지를 열 수 없어요', '네트워크 연결을 확인한 뒤 다시 시도해 주세요.');
    }
  }

  function resetFilters() {
    setRegion('전체');
    setDistance('전체');
    setRegistration('전체');
    setPeriod('전체');
    setQuery('');
    setActiveGroupId(undefined);
    setExpandedGroupId(undefined);
    setShowRegionFilters(false);
    setVisibleCount(20);
  }

  function toggleInterest(group: RaceGroup) {
    const saved = group.raceIds.some((id) => preferences.interestedRaceIds.includes(id));
    const next = saved
      ? preferences.interestedRaceIds.filter((id) => !group.raceIds.includes(id))
      : [...preferences.interestedRaceIds, group.id];
    void updatePreferences({ interestedRaceIds: next });
  }

  const twoColumns = width >= 840;

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          accessibilityLabel="대회 검색"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={(value) => {
            setQuery(value);
            setActiveGroupId(undefined);
            setVisibleCount(20);
          }}
          placeholder="대회명, 지역 또는 장소"
          placeholderTextColor={palette.muted}
          returnKeyType="search"
          style={styles.search}
          value={query}
        />
        <Pressable
          accessibilityLabel="대회 데이터 새로고침"
          accessibilityRole="button"
          disabled={loading}
          onPress={() => void refresh()}
          style={({ pressed }) => [
            styles.refresh,
            loading && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.refreshText}>{loading ? '확인 중' : '새로고침'}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="지역 필터 열기"
          accessibilityRole="button"
          accessibilityState={{ expanded: showRegionFilters }}
          onPress={() => setShowRegionFilters((current) => !current)}
          style={({ pressed }) => [styles.regionToggle, pressed && styles.pressed]}
        >
          <Text style={styles.regionToggleText}>{region === '전체' ? '지역' : region}</Text>
        </Pressable>
      </View>

      <View style={styles.filters}>
        <View accessibilityLabel="거리 필터" style={styles.filterGrid}>
          {distanceChoices.map((choice) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: choice === distance }}
              key={choice}
              onPress={() => {
                setActiveGroupId(undefined);
                setDistance(choice);
                setVisibleCount(20);
              }}
              style={({ pressed }) => [
                styles.filterCell,
                choice === distance && styles.filterCellSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.filterCellLabel,
                  choice === distance && styles.filterCellLabelSelected,
                ]}
              >
                {distanceLabels[choice] ?? choice}
              </Text>
            </Pressable>
          ))}
        </View>
        <View accessibilityLabel="접수 상태 필터" style={styles.filterRow}>
          {registrationFilters.map((choice) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: choice === registration }}
              key={choice}
              onPress={() => {
                setActiveGroupId(undefined);
                setRegistration(choice);
                setVisibleCount(20);
              }}
              style={({ pressed }) => [
                styles.filterFlexCell,
                choice === registration && styles.filterAccentSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.filterCellLabel,
                  choice === registration && styles.filterCellLabelSelected,
                ]}
              >
                {choice}
              </Text>
            </Pressable>
          ))}
        </View>
        <View accessibilityLabel="시기 필터" style={styles.filterRow}>
          {racePeriodFilters.map((choice) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: choice === period }}
              key={choice}
              onPress={() => {
                setActiveGroupId(undefined);
                setPeriod(choice);
                setVisibleCount(20);
              }}
              style={({ pressed }) => [
                styles.filterFlexCell,
                choice === period && styles.filterCellSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.filterCellLabel, choice === period && styles.filterCellLabelSelected]}
              >
                {choice}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {showRegionFilters ? (
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>지역</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.choiceRow}
          >
            {availableRegions.map((choice) => (
              <Chip
                key={choice}
                label={choice}
                selected={choice === region}
                onPress={() => {
                  setActiveGroupId(undefined);
                  setRegion(choice);
                  setVisibleCount(20);
                }}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View accessibilityLiveRegion="polite" style={styles.notice}>
        <Text style={styles.noticeText}>{notice}</Text>
      </View>

      <View style={styles.resultHeader}>
        <Text style={styles.resultTitle}>대회 {visibleGroups.length}개</Text>
        <Text style={styles.revision}>데이터 {feed.revision}</Text>
      </View>

      <View style={[styles.list, twoColumns && styles.listWide]}>
        {renderedGroups.map((group) => {
          const primary = group.primary;
          const scheduled = group.raceIds.some((id) => Boolean(scheduledRaceIds[id]));
          const canSchedule = canScheduleRegistrationAlert(primary);
          const busy = busyRaceId !== null && group.raceIds.includes(busyRaceId);
          const focused = activeGroupId === group.id;
          const expanded = expandedGroupId === group.id;
          const interested = group.raceIds.some((id) =>
            preferences.interestedRaceIds.includes(id),
          );
          return (
            <Card
              key={group.key}
              style={[
                styles.raceCard,
                twoColumns && styles.raceCardWide,
                focused && styles.raceCardFocused,
              ]}
            >
              <View style={styles.raceTopline}>
                <View style={styles.dDay}>
                  <Text style={styles.dDayText}>{formatDDay(group.raceDate)}</Text>
                </View>
                <Chip label={group.status} tone={statusTone(group.status)} />
                <Chip
                  label={interested ? '관심 저장됨' : '관심'}
                  onPress={() => toggleInterest(group)}
                  selected={interested}
                  tone="accent"
                />
              </View>

              <Text style={styles.raceName}>{group.name}</Text>
              <Text style={styles.raceMeta}>
                {group.region} · {group.venue}
              </Text>
              <Text style={styles.raceMeta}>{formatRaceDate(primary)}</Text>

              <View accessibilityLabel="거리 종목" style={styles.distanceChips}>
                {group.distances.map((value) => (
                  <View key={value} style={styles.distanceChip}>
                    <Text style={styles.distanceChipText}>{distanceLabels[value] ?? value}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.registration}>
                <Text style={styles.registrationLabel}>접수 일정</Text>
                <Text style={styles.registrationValue}>{formatRegistrationTime(primary)}</Text>
              </View>
              {primary.note ? <Text style={styles.note}>{primary.note}</Text> : null}

              <View style={styles.actions}>
                <Button
                  disabled={busy || (!scheduled && !canSchedule)}
                  label={
                    busy
                      ? '처리 중'
                      : scheduled
                        ? '알림 취소'
                        : canSchedule
                          ? '접수 알림 예약'
                          : group.status === '접수 중'
                            ? '접수 진행 중'
                            : '시각 확인 후 예약'
                  }
                  onPress={() => void (scheduled ? cancelAlert(primary) : scheduleAlert(primary))}
                  style={styles.action}
                  tone={scheduled ? 'quiet' : 'primary'}
                />
                <Button
                  disabled={!primary.officialUrl?.startsWith('https://')}
                  label={primary.externalLinkKind === 'source' ? '정보 출처' : '접수·공식'}
                  onPress={() => void openExternalUrl(primary)}
                  style={styles.action}
                  tone="secondary"
                />
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() =>
                  setExpandedGroupId((current) => (current === group.id ? undefined : group.id))
                }
                style={({ pressed }) => [styles.detailToggle, pressed && styles.pressed]}
              >
                <Text style={styles.detailToggleText}>
                  {expanded ? '간단히 보기' : '자세히 보기'}
                </Text>
              </Pressable>
              {expanded ? (
                <View style={styles.details}>
                  <Text style={styles.detailLabel}>대회 장소</Text>
                  <Text style={styles.detailValue}>{group.venue}</Text>
                  {primary.organizer ? (
                    <Text style={styles.detailValue}>주최 {primary.organizer}</Text>
                  ) : null}
                  {primary.capacity ? (
                    <Text style={styles.detailValue}>
                      모집 규모 {primary.capacity.toLocaleString('ko-KR')}명
                    </Text>
                  ) : null}
                  {group.entries.length > 1 ? (
                    <>
                      <Text style={styles.detailLabel}>종목별 접수</Text>
                      {group.entries.map((entry) => (
                        <Text key={entry.id} style={styles.detailValue}>
                          {entry.distances.join(' · ')} · {formatRegistrationTime(entry)}
                        </Text>
                      ))}
                    </>
                  ) : null}
                  <Text style={styles.detailSource}>
                    데이터 확인 {primary.verifiedAt ?? '확인 시각 준비 중'} ·{' '}
                    {group.sourceNames.join(', ')}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.source}>출처 {group.sourceNames.join(', ')}</Text>
            </Card>
          );
        })}
      </View>

      {renderedGroups.length < visibleGroups.length ? (
        <Button
          label={`${Math.min(20, visibleGroups.length - renderedGroups.length)}개 더 보기`}
          onPress={() => setVisibleCount((current) => current + 20)}
          style={styles.moreButton}
          tone="secondary"
        />
      ) : null}

      {visibleGroups.length === 0 ? (
        <Card style={styles.empty}>
          <Text style={styles.emptyTitle}>조건에 맞는 대회가 없어요</Text>
          <Button label="전체 대회 보기" onPress={resetFilters} style={styles.emptyButton} />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xxl },
  searchRow: { flexDirection: 'row', gap: spacing.xs },
  search: {
    flex: 1,
    minHeight: 48,
    minWidth: 0,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
    color: palette.ink,
    fontSize: typeScale.body,
    paddingHorizontal: spacing.md,
  },
  refresh: {
    minHeight: 48,
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: spacing.sm,
  },
  refreshText: { color: palette.inkSoft, fontSize: typeScale.caption, fontWeight: '800' },
  regionToggle: {
    minHeight: 48,
    maxWidth: 116,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.sm,
  },
  regionToggleText: { color: palette.inkSoft, fontSize: typeScale.caption, fontWeight: '800' },
  filters: {
    gap: spacing.sm,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  filterRow: { flexDirection: 'row', gap: spacing.xs },
  filterCell: {
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
  },
  filterFlexCell: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
  },
  filterCellSelected: { backgroundColor: palette.ink, borderColor: palette.ink },
  filterAccentSelected: { backgroundColor: palette.accent, borderColor: palette.accent },
  filterCellLabel: { color: palette.inkSoft, fontSize: typeScale.caption, fontWeight: '900' },
  filterCellLabelSelected: { color: palette.white },
  filterGroup: { gap: spacing.xs, marginTop: spacing.sm },
  filterLabel: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    fontWeight: '800',
    paddingHorizontal: spacing.xs,
  },
  choiceRow: { gap: spacing.xs, paddingHorizontal: spacing.xxs },
  notice: {
    backgroundColor: palette.warningSoft,
    borderRadius: radius.md,
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  noticeText: {
    color: palette.warning,
    fontSize: typeScale.caption,
    lineHeight: 18,
    fontWeight: '600',
  },
  resultHeader: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultTitle: { color: palette.ink, fontSize: typeScale.titleSmall, fontWeight: '900' },
  revision: { color: palette.muted, fontSize: 11, fontWeight: '600' },
  list: { gap: spacing.sm },
  listWide: { flexDirection: 'row', flexWrap: 'wrap' },
  raceCard: { gap: spacing.xxs },
  raceCardWide: { flexGrow: 1, flexBasis: '48%' },
  raceCardFocused: { borderColor: palette.accent, borderWidth: 2 },
  raceTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dDay: {
    minHeight: 30,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: palette.navy,
    paddingHorizontal: spacing.sm,
  },
  dDayText: { color: palette.white, fontSize: typeScale.caption, fontWeight: '900' },
  raceName: {
    color: palette.ink,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: spacing.xs,
  },
  raceMeta: { color: palette.muted, fontSize: typeScale.bodySmall, lineHeight: 20 },
  distanceChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xxs,
    marginTop: spacing.xs,
  },
  distanceChip: {
    borderRadius: radius.pill,
    backgroundColor: palette.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  distanceChipText: { color: palette.accentDark, fontSize: typeScale.caption, fontWeight: '900' },
  registration: {
    backgroundColor: palette.surfaceWarm,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  registrationLabel: { color: palette.accentDark, fontSize: typeScale.caption, fontWeight: '900' },
  registrationValue: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  note: { color: palette.inkSoft, fontSize: typeScale.caption, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  action: { flex: 1 },
  detailToggle: {
    alignSelf: 'flex-start',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  detailToggleText: { color: palette.accentDark, fontSize: typeScale.caption, fontWeight: '900' },
  details: {
    gap: 4,
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  detailLabel: { color: palette.muted, fontSize: 11, fontWeight: '800' },
  detailValue: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: 19,
    fontWeight: '700',
  },
  detailSource: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: spacing.xs },
  source: { color: palette.muted, fontSize: 11, marginTop: 2 },
  moreButton: { marginTop: spacing.md },
  empty: { alignItems: 'center', marginTop: spacing.sm },
  emptyTitle: { color: palette.ink, fontSize: typeScale.body, fontWeight: '800' },
  emptyButton: { marginTop: spacing.md, minWidth: 160 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
