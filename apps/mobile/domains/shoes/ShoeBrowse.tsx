// 러닝화 "안내된 탐색"의 1~2단계 화면입니다.
// 1단계: 큰 갈래 3개(데일리 트레이너 / 슈퍼 트레이너 / 레이싱화) + 거리별·실력별 진입 + 전체 보기
// 2단계: 고른 갈래의 세부 갈래 목록
// 개수는 모두 카탈로그에서 실측한 값이고, 화면에 숫자를 적어 두지 않습니다.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, SectionHeader } from '../../app/design-system/components';
import { palette, radius, spacing, typeScale } from '../../app/design-system/theme';
import {
  countCategoryShoes,
  countDistanceShoes,
  countLevelShoes,
  countPriceBandShoes,
  countSubCategoryShoes,
  shoeCategoryGuide,
  shoeCategoryGuides,
  shoeDistanceEntries,
  shoeLevelEntries,
  shoeSubCategoryGuidesOf,
  type ShoeListSource,
} from './browse';
import { bandRangeLabel, priceFilterBands } from './price';
import type { ShoeEntry } from './catalog';
import type { ShoeCategory } from './taxonomy';

/** 갈래·거리·실력을 고르는 공통 행입니다. 라벨 · 한 줄 설명 · 개수만 보여 줍니다. */
function PickRow({
  label,
  lead,
  count,
  onPress,
}: {
  label: string;
  lead: string;
  count: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count}종`}
      accessibilityHint={lead}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowLead}>{lead}</Text>
      </View>
      <Text style={styles.rowCount}>{count}종</Text>
    </Pressable>
  );
}

export function ShoeBrowseHome({
  values,
  onOpenCategory,
  onOpenList,
  onOpenAdvisor,
}: {
  values: ShoeEntry[];
  onOpenCategory: (category: ShoeCategory) => void;
  onOpenList: (source: ShoeListSource) => void;
  onOpenAdvisor: () => void;
}) {
  return (
    <View style={styles.container}>
      <SectionHeader
        title="어떤 러닝화를 찾으세요?"
        subtitle="큰 갈래부터 고르면 금방 좁혀져요."
      />

      <View style={styles.categoryList}>
        {shoeCategoryGuides.map((guide) => {
          const count = countCategoryShoes(guide.category, values);
          const subs = shoeSubCategoryGuidesOf(guide.category);
          return (
            <Pressable
              key={guide.category}
              accessibilityRole="button"
              accessibilityLabel={`${guide.title}, ${count}종`}
              accessibilityHint={guide.forWhom}
              onPress={() => onOpenCategory(guide.category)}
              style={({ pressed }) => [styles.categoryCard, pressed && styles.pressed]}
            >
              <View style={styles.categoryTop}>
                <Text style={styles.categoryTitle}>{guide.title}</Text>
                <Text style={styles.categoryCount}>{count}종</Text>
              </View>
              <Text style={styles.categoryFor}>{guide.forWhom}</Text>
              <Text style={styles.categoryTerm}>{guide.termNote}</Text>
              <Text style={styles.categorySubs}>
                {subs.map((sub) => sub.title).join(' · ')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/*
        가격대는 갈래·거리·실력과 같은 층에 둡니다.
        신발을 고를 때 가장 먼저 부딪히는 벽이 가격이라, 상세 필터 안에 숨기면 안 됩니다.
      */}
      <Card style={styles.block}>
        <Text accessibilityRole="header" style={styles.blockTitle}>
          예산이 정해져 있다면
        </Text>
        <Text style={styles.note}>
          고른 가격대 안에서만 보여 드려요. 값은 카드마다 함께 나와요.
        </Text>
        <View style={styles.rowList}>
          {priceFilterBands.map((entry) => (
            <PickRow
              key={entry.band}
              label={entry.label}
              lead={bandRangeLabel(entry.band)}
              count={countPriceBandShoes(entry.band, values)}
              onPress={() => onOpenList({ type: 'price', band: entry.band })}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.block}>
        <Text accessibilityRole="header" style={styles.blockTitle}>
          얼마나 뛰세요?
        </Text>
        <Text style={styles.note}>자주 달리는 거리를 고르면 그 거리에 맞는 신발만 보여 드려요.</Text>
        <View style={styles.rowList}>
          {shoeDistanceEntries.map((entry) => (
            <PickRow
              key={entry.key}
              label={entry.label}
              lead={entry.lead}
              count={countDistanceShoes(entry.key, values)}
              onPress={() => onOpenList({ type: 'distance', key: entry.key })}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.block}>
        <Text accessibilityRole="header" style={styles.blockTitle}>
          지금 어느 정도 달리세요?
        </Text>
        <Text style={styles.note}>지금 상태에 맞는 신발부터 보여 드려요. 잘하고 못하고를 가르는 게 아니에요.</Text>
        <View style={styles.rowList}>
          {shoeLevelEntries.map((entry) => (
            <PickRow
              key={entry.level}
              label={entry.label}
              lead={entry.lead}
              count={countLevelShoes(entry.level, values)}
              onPress={() => onOpenList({ type: 'level', level: entry.level })}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.block}>
        <Text accessibilityRole="header" style={styles.blockTitle}>
          그냥 다 보고 싶다면
        </Text>
        <Text style={styles.note}>
          검색과 상세 필터(브랜드·가격대 등)는 전체 보기 안에 모아 두었어요.
        </Text>
        <Button
          label="러닝화 전체 보기"
          onPress={() => onOpenList({ type: 'all' })}
          tone="secondary"
        />
        <Button label="뭘 사야 할지 모르겠어요" onPress={onOpenAdvisor} tone="quiet" />
      </Card>
    </View>
  );
}

export function ShoeCategoryPicker({
  category,
  values,
  onBack,
  onOpenList,
}: {
  category: ShoeCategory;
  values: ShoeEntry[];
  onBack: () => void;
  onOpenList: (source: ShoeListSource) => void;
}) {
  const guide = shoeCategoryGuide(category);
  const total = countCategoryShoes(category, values);

  return (
    <View style={styles.container}>
      <Button label="처음으로" onPress={onBack} tone="quiet" />

      <Card style={styles.hero}>
        <Text accessibilityRole="header" style={styles.heroTitle}>
          {guide.title}
        </Text>
        <Text style={styles.heroFor}>{guide.forWhom}</Text>
        <Text style={styles.categoryTerm}>{guide.termNote}</Text>
        <Text style={styles.note}>여기 안에서 {total}종을 다시 나눠 두었어요.</Text>
      </Card>

      <SectionHeader title="어떤 성격을 찾으세요?" subtitle="세부 갈래를 고르면 목록이 나와요." />

      <View style={styles.rowList}>
        {shoeSubCategoryGuidesOf(category).map((sub) => (
          <PickRow
            key={sub.subCategory}
            label={sub.title}
            lead={sub.forWhom}
            count={countSubCategoryShoes(category, sub.subCategory, values)}
            onPress={() =>
              onOpenList({ type: 'sub', category, subCategory: sub.subCategory })
            }
          />
        ))}
      </View>

      <Button
        label={`${guide.title} ${total}종 한 번에 보기`}
        onPress={() => onOpenList({ type: 'category', category })}
        tone="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, paddingBottom: spacing.xxl },
  categoryList: { gap: spacing.sm },
  categoryCard: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xxs,
  },
  categoryTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  categoryTitle: { color: palette.ink, fontSize: typeScale.title, fontWeight: '900', flexShrink: 1 },
  categoryCount: { color: palette.accentStrong, fontSize: typeScale.bodySmall, fontWeight: '900' },
  categoryFor: { color: palette.inkSoft, fontSize: typeScale.bodySmall, lineHeight: 21 },
  categoryTerm: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 18 },
  categorySubs: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: 16,
    marginTop: spacing.xxs,
  },
  block: { gap: spacing.xs },
  blockTitle: { color: palette.ink, fontSize: typeScale.titleSmall, fontWeight: '900' },
  note: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 18 },
  rowList: { gap: spacing.xs },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderColor: palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: palette.surface,
  },
  pressed: { opacity: 0.72 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { color: palette.ink, fontSize: typeScale.bodySmall, fontWeight: '900' },
  rowLead: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 18 },
  rowCount: { color: palette.accentStrong, fontSize: typeScale.caption, fontWeight: '900' },
  hero: { gap: spacing.xs, backgroundColor: palette.surfaceWarm },
  heroTitle: { color: palette.ink, fontSize: typeScale.title, fontWeight: '900' },
  heroFor: { color: palette.inkSoft, fontSize: typeScale.bodySmall, lineHeight: 21 },
});
