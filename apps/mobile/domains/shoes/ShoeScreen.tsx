// 러닝화를 검색·필터·정렬해 한곳에서 다 살펴보고 국내 구매 경로까지 잇는 탐색 화면입니다.
import * as Linking from 'expo-linking';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Chip } from '../../app/design-system/components';
import { palette, radius, spacing, typeScale } from '../../app/design-system/theme';
import { useAppState } from '../../app/state/AppStateProvider';
import { findShoeEntry, shoeCatalog } from './catalog';
import {
  activeFilterCount,
  filterShoes,
  resetShoeFilters,
  shoePlateFilterLabels,
  shoePlateFilters,
  shoeSorts,
  toggleValue,
  type ShoeFilterState,
} from './filters';
import { ShoeAdvisor } from './ShoeAdvisor';
import { ShoeCard } from './ShoeCard';
import { ShoeCompare } from './ShoeCompare';
import { ShoeDetail } from './ShoeDetail';
import { COMPARE_MAX, canCompare, resolveCompareShoes, toggleCompareId } from './compare';
import type { ShoePurchaseLink } from './purchaseLinks';
import {
  shoeBrands,
  shoeCategories,
  shoeDistances,
  shoeLevels,
  shoePriceBands,
  shoeSubCategories,
  type ShoeCategory,
} from './taxonomy';

const PAGE_SIZE = 20;

export function ShoeScreen({ focusedShoeId }: { focusedShoeId?: string }) {
  const { preferences, updatePreferences } = useAppState();
  const [filters, setFilters] = useState<ShoeFilterState>(() => resetShoeFilters());
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [detailId, setDetailId] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<'list' | 'advisor' | 'compare'>('list');
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
      // 카테고리를 바꾸면 이전 카테고리의 세부 칩은 의미가 없어 비웁니다.
      subCategories: [],
    }));
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
        onBack={() => setMode('list')}
        onOpenShoe={openShoe}
        onToggleCompare={toggleCompare}
      />
    );
  }

  if (mode === 'compare') {
    return (
      <ShoeCompare
        shoes={resolveCompareShoes(compareIds)}
        onBack={() => setMode('list')}
        onOpenShoe={openShoe}
        onRemove={toggleCompare}
        onClear={() => setCompareIds([])}
      />
    );
  }

  const availableSubCategories = filters.category
    ? shoeSubCategories[filters.category]
    : shoeCategories.flatMap((category) => shoeSubCategories[category]);
  const filterCount = activeFilterCount(filters);
  const shown = results.slice(0, visibleCount);

  return (
    <View style={styles.container}>
      <Card style={styles.entryCard}>
        <Text style={styles.entryTitle}>뭘 사야 할지 모르겠다면</Text>
        <Text style={styles.note}>
          네 가지 질문에 답하면 카탈로그 {shoeCatalog.length}종에서 조건에 맞는 러닝화를 골라 줘요.
        </Text>
        <Button label="내게 맞는 러닝화 찾기" onPress={() => setMode('advisor')} tone="primary" />
        <View style={styles.summaryActions}>
          <Button
            label={`비교함 열기 (${compareIds.length}/${COMPARE_MAX})`}
            onPress={() => setMode('compare')}
            tone="secondary"
            disabled={!canCompare(compareIds)}
          />
          <Button
            label="비교함 비우기"
            onPress={() => setCompareIds([])}
            tone="quiet"
            disabled={compareIds.length === 0}
          />
        </View>
      </Card>

      <TextInput
        accessibilityLabel="러닝화 검색"
        onChangeText={(query) => patch({ query })}
        placeholder="브랜드·모델 검색 (예: 페가수스, Vaporfly)"
        placeholderTextColor={palette.muted}
        style={styles.search}
        value={filters.query}
      />

      <View accessibilityRole="tablist" style={styles.chipWrap}>
        <Chip
          label="전체"
          selected={!filters.category}
          onPress={() => selectCategory(undefined)}
          tone="accent"
          accessibilityRole="tab"
        />
        {shoeCategories.map((category) => (
          <Chip
            key={category}
            label={category}
            selected={filters.category === category}
            onPress={() => selectCategory(category)}
            tone="accent"
            accessibilityRole="tab"
          />
        ))}
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summary}>
          {results.length}개 / 전체 {shoeCatalog.length}개
        </Text>
        <View style={styles.summaryActions}>
          <Button
            label={showFilters ? '필터 접기' : `필터 열기${filterCount > 0 ? ` (${filterCount})` : ''}`}
            onPress={() => setShowFilters((value) => !value)}
            tone="secondary"
          />
          <Button
            label="초기화"
            onPress={() => setFilters(resetShoeFilters())}
            tone="quiet"
            disabled={filterCount === 0}
          />
        </View>
      </View>

      {showFilters ? (
        <Card style={styles.filterCard}>
          <FilterGroup title="세부 카테고리">
            {availableSubCategories.map((sub) => (
              <Chip
                key={sub}
                label={sub}
                selected={filters.subCategories.includes(sub)}
                onPress={() => patch({ subCategories: toggleValue(filters.subCategories, sub) })}
              />
            ))}
          </FilterGroup>
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
          <FilterGroup title="실력">
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
          <FilterGroup title="플레이트">
            {shoePlateFilters.map((plate) => (
              <Chip
                key={plate}
                label={shoePlateFilterLabels[plate]}
                selected={filters.plates.includes(plate)}
                onPress={() => patch({ plates: toggleValue(filters.plates, plate) })}
              />
            ))}
          </FilterGroup>
          <FilterGroup title="정렬">
            {shoeSorts.map((sort) => (
              <Chip
                key={sort}
                label={sort}
                selected={filters.sort === sort}
                onPress={() => patch({ sort })}
                tone="accent"
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
            onPress={() => setDetailId(shoe.id)}
            onToggleCompare={() => toggleCompare(shoe.id)}
          />
        ))}

        {results.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>조건에 맞는 러닝화가 없어요.</Text>
            <Text style={styles.note}>
              필터를 하나씩 풀거나 검색어를 지워 보세요. 브랜드 이름은 한글과 영문 모두 찾을 수 있어요.
            </Text>
            <Button label="필터 초기화" onPress={() => setFilters(resetShoeFilters())} tone="secondary" />
          </Card>
        ) : null}

        {results.length > shown.length ? (
          <Button
            label={`더 보기 (${results.length - shown.length}개 남음)`}
            onPress={() => setVisibleCount((value) => value + PAGE_SIZE)}
            tone="secondary"
          />
        ) : null}
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
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  summary: { color: palette.inkSoft, fontSize: typeScale.bodySmall, fontWeight: '800' },
  summaryActions: { flexDirection: 'row', gap: spacing.xs },
  filterCard: { gap: spacing.md, backgroundColor: palette.surfaceWarm },
  entryCard: { gap: spacing.sm, backgroundColor: palette.surfaceWarm },
  entryTitle: { color: palette.ink, fontSize: typeScale.titleSmall, fontWeight: '900' },
  filterGroup: { gap: spacing.xs },
  filterTitle: { color: palette.ink, fontSize: typeScale.bodySmall, fontWeight: '900' },
  note: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 18 },
  list: { gap: spacing.md },
  emptyCard: { backgroundColor: palette.surfaceWarm, gap: spacing.sm },
  emptyTitle: { color: palette.ink, fontSize: typeScale.body, fontWeight: '900' },
});
