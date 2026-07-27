// 목록에서 러닝화 한 켤레를 "간결하게" 요약하는 카드입니다.
//
// 밀도 규칙(2026-07 개편)
// - 한 화면에 여러 켤레가 들어오도록 카드에서 정보를 덜어 냈습니다.
//   남긴 것: 브랜드 컬러바 · 브랜드 · 모델명 · 핵심 한 줄 · 가격대 · 용도 칩 1~2개 · 비교 담기.
//   뺀 것: 이니셜 배지, 영문 모델명, 실력·거리 칩 나열, 플레이트 칩, 장점 2줄.
// - 뺀 정보는 없애는 게 아니라 상세 화면(ShoeDetail)에서 그대로 봅니다.
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Chip } from '../../app/design-system/components';
import { palette, radius, spacing, typeScale } from '../../app/design-system/theme';
import { shoeArtSpec } from './art';
import { ShoeArt } from './ShoeArt';
import { priceDisplay } from './price';
import type { ShoeEntry } from './catalog';

export function ShoeCard({
  shoe,
  focused = false,
  saved = false,
  compareSelected = false,
  /** 세부 갈래로 이미 좁혀 본 목록에서는 갈래 칩이 중복이라 끕니다. */
  showSubCategory = true,
  onPress,
  onToggleCompare,
}: {
  shoe: ShoeEntry;
  focused?: boolean;
  saved?: boolean;
  compareSelected?: boolean;
  showSubCategory?: boolean;
  onPress: () => void;
  onToggleCompare?: () => void;
}) {
  // 용도 칩은 최대 2개까지만. 나머지는 상세에서 봅니다.
  const purposes = shoe.purposeTags.slice(0, showSubCategory ? 1 : 2);
  const art = useMemo(() => shoeArtSpec(shoe), [shoe]);
  // 가격은 **모든 카드에 반드시** 나옵니다. 정가를 모르면 가격대 범위가 대신 옵니다.
  // 값이 없으면 살지 말지 판단이 안 되고, 그러면 이 목록을 볼 이유가 없습니다.
  const price = useMemo(() => priceDisplay(shoe, new Date()), [shoe]);

  return (
    <View style={[styles.card, focused && styles.cardFocused]}>
      <View style={[styles.accent, { backgroundColor: shoe.brandColor }]} />
      <View style={styles.body}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${shoe.brand} ${shoe.model}, ${price.headline} 자세히 보기`}
          accessibilityHint="장점, 주의점, 가격, 국내 구매 경로를 볼 수 있어요."
          onPress={onPress}
          style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        >
          <View style={styles.headRow}>
            <ShoeArt spec={art} width={84} />
            <View style={styles.headCopy}>
              <View style={styles.titleRow}>
                <Text numberOfLines={1} style={styles.brand}>
                  {shoe.brand}
                </Text>
                {saved ? <Text style={styles.savedMark}>관심</Text> : null}
              </View>
              <Text numberOfLines={1} style={styles.model}>
                {shoe.model}
              </Text>
              <Text style={[styles.price, !price.confirmed && styles.priceBand]}>
                {price.headline}
              </Text>
              <Text numberOfLines={1} style={styles.priceDetail}>
                {price.basis ?? price.detail}
              </Text>
            </View>
          </View>
          <Text numberOfLines={2} style={styles.pick}>
            {shoe.pick}
          </Text>
        </Pressable>

        <View style={styles.metaRow}>
          {showSubCategory ? <Chip label={shoe.subCategory} tone="accent" /> : null}
          {purposes.map((purpose) => (
            <Chip key={purpose} label={purpose} />
          ))}
          {onToggleCompare ? (
            <Chip
              label={compareSelected ? '담김' : '비교 담기'}
              accessibilityLabel={
                compareSelected
                  ? `${shoe.brand} ${shoe.model} 비교함에서 빼기`
                  : `${shoe.brand} ${shoe.model} 비교함에 담기`
              }
              selected={compareSelected}
              onPress={onToggleCompare}
              tone={compareSelected ? 'positive' : 'accent'}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  cardFocused: { borderColor: palette.accent, borderWidth: 2 },
  pressed: { opacity: 0.72 },
  accent: { width: 5 },
  body: { flex: 1, minWidth: 0, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  // 카드 전체가 아니라 글 영역만 상세로 가는 버튼이라 비교 칩과 터치가 겹치지 않습니다.
  main: { minHeight: 48, justifyContent: 'center', gap: spacing.xxs },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headCopy: { flex: 1, minWidth: 0, gap: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  // 가격은 모델명 다음으로 큽니다. 가격 때문에 고민하는 사람이 대부분입니다.
  price: { color: palette.ink, fontSize: typeScale.titleSmall, fontWeight: '900' },
  // 확인된 정가가 아니라 가격대 범위일 때는 조금 눌러 씁니다(다른 값임이 보여야 합니다).
  priceBand: { color: palette.inkSoft, fontSize: typeScale.bodySmall, fontWeight: '800' },
  priceDetail: { color: palette.muted, fontSize: typeScale.micro },
  brand: { color: palette.muted, fontSize: typeScale.caption, fontWeight: '800', flexShrink: 1 },
  savedMark: { color: palette.positive, fontSize: typeScale.micro, fontWeight: '900' },
  model: { color: palette.ink, fontSize: typeScale.body, fontWeight: '900' },
  pick: { color: palette.inkSoft, fontSize: typeScale.caption, lineHeight: 18 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xxs },
});
