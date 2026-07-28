// 러닝화 탐색 화면입니다.
//
// 골격(2026-07 개편): 필터를 나열하는 대신 "안내된 탐색" 3단계로 좁힙니다.
//   1단계 큰 갈래(데일리 트레이너 / 슈퍼 트레이너 / 레이싱화)
//   2단계 세부 갈래(입문 / 맥스 쿠션 / 안정화 / …)
//   3단계 목록
// 거리별("얼마나 뛰세요?")·실력별 진입은 1단계와 같은 층위의 1급 입구이고,
// 검색과 상세 필터는 "전체 보기" 안에 모아 둡니다.
import * as Linking from 'expo-linking';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Chip } from '../../app/design-system/components';
import { palette, radius, spacing, typeScale } from '../../app/design-system/theme';
import { useAppState } from '../../app/state/AppStateProvider';
import {
  allowsFullFilters,
  filtersForSource,
  shoeBrowseBack,
  shoeBrowseBackLabel,
  shoeBrowseHome,
  shoeListLead,
  shoeListTitle,
  type ShoeBrowseView,
  type ShoeListSource,
} from './browse';
import { findShoeEntry, shoeCatalog } from './catalog';
import {
  activeFilterCount,
  clearFilterDimension,
  emptyResultAdvice,
  filterShoes,
  resetShoeFilters,
  shoePlateFilterLabels,
  shoePlateFilters,
  shoeSorts,
  toggleValue,
  type ShoeFilterState,
} from './filters';
import { ShoeAdvisor } from './ShoeAdvisor';
import { ShoeBrowseHome, ShoeCategoryPicker } from './ShoeBrowse';
import { ShoeCard } from './ShoeCard';
import { ShoeCompare } from './ShoeCompare';
import { ShoeDetail } from './ShoeDetail';
import { COMPARE_MAX, COMPARE_MIN, resolveCompareShoes, toggleCompareId } from './compare';
import type { ShoePurchaseLink } from './purchaseLinks';
import {
  shoeBrands,
  shoeCategories,
  shoeDistances,
  shoeLevels,
  shoePriceBands,
  shoeSubCategories,
  type ShoeCategory,
  type ShoeSubCategory,
} from './taxonomy';

const PAGE_SIZE = 20;

export function ShoeScreen({
  focusedShoeId,
  /** 부모 라우터가 특정 단계로 바로 들여보내고 싶을 때만 씁니다. 없으면 첫 화면입니다. */
  initialView,
}: {
  focusedShoeId?: string;
  initialView?: ShoeBrowseView;
}) {
  const { preferences, updatePreferences } = useAppState();
  // 다른 화면에서 러닝화 하나를 콕 집어 보낸 경우(focusedShoeId), 상세를 닫았을 때 첫 화면이 아니라
  // 그 신발이 맨 앞에 고정된 전체 목록으로 돌아오도록 시작 단계를 전체 보기로 둡니다.
  const startView: ShoeBrowseView =
    initialView ?? (focusedShoeId ? { kind: 'list', source: { type: 'all' } } : shoeBrowseHome);
  const [view, setView] = useState<ShoeBrowseView>(() => startView);
  const [filters, setFilters] = useState<ShoeFilterState>(() =>
    startView.kind === 'list' ? filtersForSource(startView.source) : resetShoeFilters(),
  );
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [detailId, setDetailId] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<'browse' | 'advisor' | 'compare'>('browse');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const results = useMemo(
    () => filterShoes(filters, shoeCatalog, { pinnedId: focusedShoeId }),
    [filters, focusedShoeId],
  );
  const detailShoe = detailId ? findShoeEntry(detailId) : undefined;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters]);

  useEffect(() => {
    if (!focusedShoeId) return;
    setDetailId(focusedShoeId);
  }, [focusedShoeId]);

  function patch(next: Partial<ShoeFilterState>) {
    setFilters((current) => ({ ...current, ...next }));
  }

  function selectCategory(category: ShoeCategory | undefined) {
    setFilters((current) => ({
      ...current,
      category,
      // 갈래를 바꾸면 이전 갈래의 세부 칩은 의미가 없어 비웁니다.
      subCategories: [],
    }));
  }

  function openList(source: ShoeListSource) {
    // 진입 조건을 그대로 필터로 옮깁니다. 정렬만 사용자가 고른 값을 이어 씁니다.
    setFilters(filtersForSource(source, filters.sort));
    setShowFilters(false);
    setView({ kind: 'list', source });
  }

  function goBack() {
    const target = shoeBrowseBack(view);
    if (target.kind === 'list') setFilters(filtersForSource(target.source, filters.sort));
    else setFilters(resetShoeFilters());
    setShowFilters(false);
    setView(target);
  }

  function toggleSaved(id: string) {
    const next = preferences.interestedShoeIds.includes(id)
      ? preferences.interestedShoeIds.filter((value) => value !== id)
      : [...preferences.interestedShoeIds, id];
    void updatePreferences({ interestedShoeIds: next });
  }

  function toggleCurrent(id: string) {
    void updatePreferences({
      currentShoeId: preferences.currentShoeId === id ? undefined : id,
    });
  }

  function toggleCompare(id: string) {
    setCompareIds((current) => toggleCompareId(current, id));
  }

  function openShoe(id: string) {
    setDetailId(id);
  }

  async function openPurchase(destination: ShoePurchaseLink) {
    try {
      if (!destination.url.startsWith('https://') || !(await Linking.canOpenURL(destination.url))) {
        throw new Error('unsupported');
      }
      await Linking.openURL(destination.url);
    } catch {
      Alert.alert('구매 경로를 열 수 없어요', '네트워크 연결을 확인한 뒤 다시 시도해 주세요.');
    }
  }

  if (detailShoe) {
    return (
      <ShoeDetail
        shoe={detailShoe}
        saved={preferences.interestedShoeIds.includes(detailShoe.id)}
        current={preferences.currentShoeId === detailShoe.id}
        compareSelected={compareIds.includes(detailShoe.id)}
        onBack={() => setDetailId(undefined)}
        onToggleSaved={() => toggleSaved(detailShoe.id)}
        onToggleCurrent={() => toggleCurrent(detailShoe.id)}
        onOpenPurchase={(destination) => void openPurchase(destination)}
        onOpenShoe={openShoe}
        onToggleCompare={() => toggleCompare(detailShoe.id)}
      />
    );
  }

  if (mode === 'advisor') {
    return (
      <ShoeAdvisor
        savedIds={preferences.interestedShoeIds}
        compareIds={compareIds}
        onBack={() => setMode('browse')}
        onOpenShoe={openShoe}
        onToggleCompare={toggleCompare}
      />
    );
  }

  if (mode === 'compare') {
    return (
      <ShoeCompare
        shoes={resolveCompareShoes(compareIds)}
        onBack={() => setMode('browse')}
        onOpenShoe={openShoe}
        onRemove={toggleCompare}
        onClear={() => setCompareIds([])}
      />
    );
  }

  const compareBar = (
    <CompareBar
      count={compareIds.length}
      onOpen={() => setMode('compare')}
      onClear={() => setCompareIds([])}
    />
  );

  if (view.kind === 'home') {
    return (
      <View style={styles.container}>
        {compareBar}
        <ShoeBrowseHome
          values={shoeCatalog}
          onOpenCategory={(category) => setView({ kind: 'category', category })}
          onOpenList={openList}
          onOpenAdvisor={() => setMode('advisor')}
        />
      </View>
    );
  }

  if (view.kind === 'category') {
    return (
      <View style={styles.container}>
        {compareBar}
        <ShoeCategoryPicker
          category={view.category}
          values={shoeCatalog}
          onBack={goBack}
          onOpenList={openList}
        />
      </View>
    );
  }

  const source = view.source;
  const fullFilters = allowsFullFilters(source);
  const availableSubCategories: readonly ShoeSubCategory[] = filters.category
    ? shoeSubCategories[filters.category]
    : [];
  const filterCount = activeFilterCount(filters);
  const shown = results.slice(0, visibleCount);
  const advice = results.length === 0 ? emptyResultAdvice(filters) : undefined;

  return (
    <View style={styles.container}>
      <Button label={shoeBrowseBackLabel(view)} onPress={goBack} tone="quiet" />
      {compareBar}

      <Card style={styles.listHero}>
        <Text accessibilityRole="header" style={styles.listTitle}>
          {shoeListTitle(source)}
        </Text>
        <Text style={styles.lead}>{shoeListLead(source)}</Text>
        <Text style={styles.summary}>
          {results.length > 0 ? `${results.length}켤레` : ''}
        </Text>
      </Card>

      {fullFilters ? (
        <TextInput
          accessibilityLabel="러닝화 검색"
          onChangeText={(query) => patch({ query })}
          placeholder="브랜드·모델 검색 (예: 페가수스, Vaporfly)"
          placeholderTextColor={palette.muted}
          style={styles.search}
          value={filters.query}
        />
      ) : null}

      <View style={styles.sortRow}>
        <Text style={styles.sortTitle}>정렬</Text>
        <View style={styles.chipWrap}>
          {shoeSorts.map((sort) => (
            <Chip
              key={sort}
              label={sort}
              selected={filters.sort === sort}
              onPress={() => patch({ sort })}
              tone="accent"
            />
          ))}
        </View>
      </View>

      {fullFilters ? (
        <View style={styles.summaryRow}>
          <Button
            label={showFilters ? '필터 접기' : `필터 열기${filterCount > 0 ? ` (${filterCount})` : ''}`}
            onPress={() => setShowFilters((value) => !value)}
            tone="secondary"
          />
          <Button
            label="필터 초기화"
            onPress={() => setFilters(resetShoeFilters())}
            tone="quiet"
            disabled={filterCount === 0}
          />
        </View>
      ) : null}

      {fullFilters && showFilters ? (
        <Card style={styles.filterCard}>
          <FilterGroup title="갈래">
            <Chip
              label="전체"
              selected={!filters.category}
              onPress={() => selectCategory(undefined)}
              tone="accent"
            />
            {shoeCategories.map((category) => (
              <Chip
                key={category}
                label={category}
                selected={filters.category === category}
                onPress={() => selectCategory(category)}
                tone="accent"
              />
            ))}
          </FilterGroup>
          {availableSubCategories.length > 0 ? (
            <FilterGroup title="세부 갈래">
              {availableSubCategories.map((sub) => (
                <Chip
                  key={sub}
                  label={sub}
                  selected={filters.subCategories.includes(sub)}
                  onPress={() => patch({ subCategories: toggleValue(filters.subCategories, sub) })}
                />
              ))}
            </FilterGroup>
          ) : null}
          <FilterGroup title="브랜드">
            {shoeBrands.map((brand) => (
              <Chip
                key={brand}
                label={brand}
                selected={filters.brands.includes(brand)}
                onPress={() => patch({ brands: toggleValue(filters.brands, brand) })}
              />
            ))}
          </FilterGroup>
          <FilterGroup title="가격대">
            {shoePriceBands.map((band) => (
              <Chip
                key={band}
                label={band}
                selected={filters.priceBands.includes(band)}
                onPress={() => patch({ priceBands: toggleValue(filters.priceBands, band) })}
              />
            ))}
          </FilterGroup>
          <FilterGroup title="지금 어느 정도 달리세요?">
            {shoeLevels.map((level) => (
              <Chip
                key={level}
                label={level}
                selected={filters.levels.includes(level)}
                onPress={() => patch({ levels: toggleValue(filters.levels, level) })}
              />
            ))}
          </FilterGroup>
          <FilterGroup title="거리">
            {shoeDistances.map((distance) => (
              <Chip
                key={distance}
                label={distance}
                selected={filters.distances.includes(distance)}
                onPress={() => patch({ distances: toggleValue(filters.distances, distance) })}
              />
            ))}
          </FilterGroup>
          <FilterGroup title="플레이트(밑창 속에 넣는 단단한 판)">
            {shoePlateFilters.map((plate) => (
              <Chip
                key={plate}
                label={shoePlateFilterLabels[plate]}
                selected={filters.plates.includes(plate)}
                onPress={() => patch({ plates: toggleValue(filters.plates, plate) })}
              />
            ))}
          </FilterGroup>
          <Text style={styles.note}>
            가격은 정확한 판매가 대신 밴드 구간으로만 안내해요. 분류는 2026-05 기준 러닝화 분류 차트를
            옮긴 편집 데이터이고, 항목별 검증 상태는 상세에서 확인할 수 있어요.
          </Text>
        </Card>
      ) : null}

      <View style={styles.list}>
        {shown.map((shoe) => (
          <ShoeCard
            key={shoe.id}
            shoe={shoe}
            focused={focusedShoeId === shoe.id}
            saved={preferences.interestedShoeIds.includes(shoe.id)}
            compareSelected={compareIds.includes(shoe.id)}
            showSubCategory={source.type !== 'sub'}
            onPress={() => setDetailId(shoe.id)}
            onToggleCompare={() => toggleCompare(shoe.id)}
          />
        ))}

        {results.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>조건에 맞는 러닝화가 없어요.</Text>
            {advice ? (
              <>
                <Text style={styles.note}>
                  {`${advice.label} 조건이 너무 좁아요. 이것만 풀면 ${advice.count}종이 나와요.`}
                </Text>
                <Button
                  label={`${advice.label} 조건 풀기`}
                  onPress={() => setFilters(clearFilterDimension(filters, advice.dimension))}
                  tone="secondary"
                />
              </>
            ) : (
              <Text style={styles.note}>
                걸어 둔 조건이 서로 겹치지 않아요. 하나만 풀어서는 결과가 생기지 않아 전체를
                초기화해야 해요.
              </Text>
            )}
            <Button
              label="필터 초기화"
              onPress={() => setFilters(filtersForSource(source, filters.sort))}
              tone="quiet"
            />
          </Card>
        ) : null}

        {results.length > shown.length ? (
          <Button
            label="더 보기"
            onPress={() => setVisibleCount((value) => value + PAGE_SIZE)}
            tone="secondary"
          />
        ) : null}
      </View>
    </View>
  );
}

/** 비교함에 담긴 개수를 어느 단계에서든 눈에 띄게 남겨 둡니다. */
function CompareBar({
  count,
  onOpen,
  onClear,
}: {
  count: number;
  onOpen: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <View
      accessibilityLabel={`비교함에 ${count}켤레 담김`}
      accessibilityRole="summary"
      style={styles.compareBar}
    >
      <Text style={styles.compareText}>
        비교함 {count}/{COMPARE_MAX}
      </Text>
      <View style={styles.compareActions}>
        <Button
          label={count >= COMPARE_MIN ? '비교하기' : `${COMPARE_MIN}켤레부터`}
          onPress={onOpen}
          tone="primary"
          disabled={count < COMPARE_MIN}
        />
        <Button label="비우기" onPress={onClear} tone="quiet" />
      </View>
    </View>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterTitle}>{title}</Text>
      <View style={styles.chipWrap}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xxl, gap: spacing.md },
  search: {
    minHeight: 48,
    borderRadius: radius.md,
    borderColor: palette.line,
    borderWidth: 1,
    backgroundColor: palette.surface,
    color: palette.ink,
    paddingHorizontal: spacing.md,
    fontSize: typeScale.body,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  summary: { color: palette.inkSoft, fontSize: typeScale.bodySmall, fontWeight: '800' },
  sortRow: { gap: spacing.xxs },
  sortTitle: { color: palette.ink, fontSize: typeScale.caption, fontWeight: '900' },
  filterCard: { gap: spacing.md, backgroundColor: palette.surfaceWarm },
  listHero: { gap: spacing.xs, backgroundColor: palette.surfaceWarm },
  listTitle: { color: palette.ink, fontSize: typeScale.title, fontWeight: '900' },
  lead: { color: palette.inkSoft, fontSize: typeScale.bodySmall, lineHeight: 21 },
  filterGroup: { gap: spacing.xs },
  filterTitle: { color: palette.ink, fontSize: typeScale.bodySmall, fontWeight: '900' },
  note: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 18 },
  list: { gap: spacing.xs },
  emptyCard: { backgroundColor: palette.surfaceWarm, gap: spacing.sm },
  emptyTitle: { color: palette.ink, fontSize: typeScale.body, fontWeight: '900' },
  compareBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    backgroundColor: palette.navy,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  compareText: { color: palette.onNavy, fontSize: typeScale.bodySmall, fontWeight: '900' },
  compareActions: { flexDirection: 'row', gap: spacing.xs },
});
