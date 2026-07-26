// 기존 대회 검색, 필터, 공식 링크, 접수 알림 기능을 vNext 탐색 화면으로 보존합니다.
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
  filterByRegistrationStatus,
  filterRaces,
  formatRaceDate,
  formatRegistrationTime,
  registrationFilters,
  registrationStatusLabel,
  regionsFor,
  type RegistrationFilter,
} from '../../src/races';
import type { DistanceFilter, Race, RegionFilter } from '../../src/types';

type Props = {
  focusedRaceId?: string;
};

type ChoiceRowProps<T extends string> = {
  label: string;
  choices: readonly T[];
  selected: T;
  onSelect: (choice: T) => void;
};

const distanceRows: ReadonlyArray<ReadonlyArray<DistanceFilter>> = [
  ['전체', 'Full', 'Half'],
  ['10K', '5K', 'Trail'],
];

const distanceLabels: Record<string, string> = {
  전체: '전체',
  Full: '풀코스',
  Half: '하프',
  '10K': '10K',
  '5K': '5K',
  Trail: '트레일',
};

function ChoiceRow<T extends string>({ label, choices, selected, onSelect }: ChoiceRowProps<T>) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.choiceRow}
      >
        {choices.map((choice) => (
          <Chip
            key={choice}
            label={choice}
            selected={choice === selected}
            onPress={() => onSelect(choice)}
          />
        ))}
      </ScrollView>
    </View>
  );
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
  const [registrationFilter, setRegistrationFilter] = useState<RegistrationFilter>('전체');
  const [query, setQuery] = useState('');
  const [showRegionFilters, setShowRegionFilters] = useState(false);
  const [activeRaceId, setActiveRaceId] = useState<string | undefined>(focusedRaceId);
  const [expandedRaceId, setExpandedRaceId] = useState<string | undefined>();
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    if (!focusedRaceId || !feed.races.some((race) => race.id === focusedRaceId)) return;
    setRegion('전체');
    setDistance('전체');
    setRegistrationFilter('전체');
    setQuery('');
    setActiveRaceId(focusedRaceId);
    setExpandedRaceId(undefined);
    setVisibleCount(20);
  }, [feed.races, focusedRaceId]);

  const availableRegions = useMemo(() => regionsFor(feed.races), [feed.races]);
  const visibleRaces = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR');
    const values = filterByRegistrationStatus(
      registrationFilter,
      filterRaces(region, distance, feed.races).filter((race) => {
        if (!normalizedQuery) return true;
        return `${race.name} ${race.region} ${race.venue} ${race.distances.join(' ')}`
          .toLocaleLowerCase('ko-KR')
          .includes(normalizedQuery);
      }),
    );
    if (!activeRaceId) return values;
    return [...values].sort((left, right) => {
      if (left.id === activeRaceId) return -1;
      if (right.id === activeRaceId) return 1;
      return 0;
    });
  }, [activeRaceId, distance, feed.races, query, region, registrationFilter]);
  const renderedRaces = visibleRaces.slice(0, visibleCount);

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
    setRegistrationFilter('전체');
    setQuery('');
    setActiveRaceId(undefined);
    setExpandedRaceId(undefined);
    setShowRegionFilters(false);
    setVisibleCount(20);
  }

  function toggleInterest(raceId: string) {
    const next = preferences.interestedRaceIds.includes(raceId)
      ? preferences.interestedRaceIds.filter((id) => id !== raceId)
      : [...preferences.interestedRaceIds, raceId];
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
          onChangeText={setQuery}
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
        <View accessibilityLabel="거리 필터" style={styles.distanceFilterGrid}>
          {distanceRows.flat().map((choice) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: choice === distance }}
              key={choice}
              onPress={() => {
                setActiveRaceId(undefined);
                setDistance(choice);
                setVisibleCount(20);
              }}
              style={({ pressed }) => [
                styles.distanceFilter,
                choice === distance && styles.distanceFilterSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.distanceFilterLabel, choice === distance && styles.distanceFilterLabelSelected]}>
                {distanceLabels[choice]}
              </Text>
            </Pressable>
          ))}
        </View>
        <View accessibilityLabel="접수 상태 필터" style={styles.registrationFilterRow}>
          {registrationFilters.map((choice) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: choice === registrationFilter }}
              key={choice}
              onPress={() => {
                setActiveRaceId(undefined);
                setRegistrationFilter(choice);
                setVisibleCount(20);
              }}
              style={({ pressed }) => [
                styles.registrationFilter,
                choice === registrationFilter && styles.registrationFilterSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.registrationFilterLabel, choice === registrationFilter && styles.registrationFilterLabelSelected]}>
                {choice}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {showRegionFilters ? (
        <ChoiceRow
          label="지역"
          choices={availableRegions}
          selected={region}
          onSelect={(choice) => {
            setActiveRaceId(undefined);
            setRegion(choice);
            setVisibleCount(20);
          }}
        />
      ) : null}

      <View accessibilityLiveRegion="polite" style={styles.notice}>
        <Text style={styles.noticeText}>{notice}</Text>
      </View>

      <View style={styles.resultHeader}>
        <Text style={styles.resultTitle}>대회 {new Set(visibleRaces.map((race) => race.id)).size}개</Text>
        <Text style={styles.revision}>데이터 {feed.revision}</Text>
      </View>

      <View style={[styles.list, twoColumns && styles.listWide]}>
        {renderedRaces.map((race) => {
          const status = registrationStatusLabel(race);
          const scheduled = Boolean(scheduledRaceIds[race.id]);
          const canSchedule = canScheduleRegistrationAlert(race);
          const busy = busyRaceId === race.id;
          const focused = activeRaceId === race.id;
          const expanded = expandedRaceId === race.id;
          const interested = preferences.interestedRaceIds.includes(race.id);
          return (
            <Card
              key={race.id}
              style={[
                styles.raceCard,
                twoColumns && styles.raceCardWide,
                focused && styles.raceCardFocused,
              ]}
            >
              <View style={styles.raceTopline}>
                <View style={styles.toplineChips}>
                  <Chip
                    label={status}
                    tone={status === '접수 중' ? 'positive' : status === '접수 예정' ? 'warning' : 'neutral'}
                  />
                  <Chip
                    label={interested ? '관심 저장됨' : '관심'}
                    selected={interested}
                    onPress={() => toggleInterest(race.id)}
                    tone="accent"
                  />
                </View>
                <Text style={styles.distance}>{race.distances.join(' · ')}</Text>
              </View>
              <Text style={styles.raceName}>{race.name}</Text>
              <Text style={styles.raceMeta}>
                {race.region} · {race.venue}
              </Text>
              <Text style={styles.raceMeta}>{formatRaceDate(race)}</Text>
              <View style={styles.registration}>
                <Text style={styles.registrationLabel}>접수 일정</Text>
                <Text style={styles.registrationValue}>{formatRegistrationTime(race)}</Text>
              </View>
              {race.note ? <Text style={styles.note}>{race.note}</Text> : null}
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
                          : status === '접수 중'
                            ? '접수 진행 중'
                            : '시각 확인 후 예약'
                  }
                  onPress={() => void (scheduled ? cancelAlert(race) : scheduleAlert(race))}
                  tone={scheduled ? 'quiet' : 'primary'}
                  style={styles.action}
                />
                <Button
                  disabled={!race.officialUrl?.startsWith('https://')}
                  label={race.externalLinkKind === 'source' ? '정보 출처' : '공식 페이지'}
                  onPress={() => void openExternalUrl(race)}
                  tone="secondary"
                  style={styles.action}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => setExpandedRaceId((current) => (current === race.id ? undefined : race.id))}
                style={({ pressed }) => [styles.detailToggle, pressed && styles.pressed]}
              >
                <Text style={styles.detailToggleText}>{expanded ? '간단히 보기' : '자세히 보기'}</Text>
              </Pressable>
              {expanded ? (
                <View style={styles.details}>
                  <Text style={styles.detailLabel}>대회 장소</Text>
                  <Text style={styles.detailValue}>{race.venue}</Text>
                  {race.organizer ? <Text style={styles.detailValue}>주최 {race.organizer}</Text> : null}
                  {race.capacity ? <Text style={styles.detailValue}>모집 규모 {race.capacity.toLocaleString('ko-KR')}명</Text> : null}
                  <Text style={styles.detailSource}>데이터 확인 {race.verifiedAt ?? '확인 시각 준비 중'} · {race.sourceName}</Text>
                </View>
              ) : null}
              <Text style={styles.source}>출처 {race.sourceName}</Text>
            </Card>
          );
        })}
      </View>

      {renderedRaces.length < visibleRaces.length ? (
        <Button
          label={`${Math.min(20, visibleRaces.length - renderedRaces.length)}개 더 보기`}
          onPress={() => setVisibleCount((current) => current + 20)}
          tone="secondary"
          style={styles.moreButton}
        />
      ) : null}

      {visibleRaces.length === 0 ? (
        <Card style={styles.empty}>
          <Text style={styles.emptyTitle}>조건에 맞는 대회가 없어요</Text>
          <Button label="전체 대회 보기" onPress={resetFilters} style={styles.emptyButton} />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.xxl,
  },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
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
  regionToggleText: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    fontWeight: '800',
  },
  refreshText: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    fontWeight: '800',
  },
  filters: {
    gap: spacing.sm,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  distanceFilterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  distanceFilter: {
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
  distanceFilterSelected: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  distanceFilterLabel: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    fontWeight: '900',
  },
  distanceFilterLabelSelected: {
    color: palette.white,
  },
  registrationFilterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  registrationFilter: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
  },
  registrationFilterSelected: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  registrationFilterLabel: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    fontWeight: '900',
  },
  registrationFilterLabelSelected: {
    color: palette.white,
  },
  filterGroup: {
    gap: spacing.xs,
  },
  filterLabel: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    fontWeight: '800',
    paddingHorizontal: spacing.md,
  },
  choiceRow: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
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
  resultTitle: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    fontWeight: '900',
  },
  revision: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  list: {
    gap: spacing.sm,
  },
  listWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  raceCard: {
    gap: spacing.xs,
  },
  raceCardWide: {
    flexGrow: 1,
    flexBasis: '48%',
  },
  raceCardFocused: {
    borderColor: palette.accent,
    borderWidth: 2,
  },
  raceTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  toplineChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    flex: 1,
    minWidth: 0,
  },
  distance: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    fontWeight: '800',
  },
  raceName: {
    color: palette.ink,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: spacing.xs,
  },
  raceMeta: {
    color: palette.muted,
    fontSize: typeScale.bodySmall,
    lineHeight: 20,
  },
  registration: {
    backgroundColor: palette.surfaceWarm,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  registrationLabel: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    fontWeight: '900',
  },
  registrationValue: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  note: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  detailToggle: {
    alignSelf: 'flex-start',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  detailToggleText: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    fontWeight: '900',
  },
  details: {
    gap: 4,
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  detailLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  detailValue: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: 19,
    fontWeight: '700',
  },
  detailSource: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  action: {
    flex: 1,
  },
  source: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 2,
  },
  moreButton: {
    marginTop: spacing.md,
  },
  empty: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: typeScale.body,
    fontWeight: '800',
  },
  emptyButton: {
    marginTop: spacing.md,
    minWidth: 160,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.72,
  },
});
