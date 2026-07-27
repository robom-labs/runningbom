// 홈 아래쪽의 "이번 주 러닝화 순위"입니다.
//
// 회장 지시: **"신발 순위도 메인 화면 아래쪽에 있고 얼마나 좋아."**
//
// 자리를 아래쪽으로 잡은 이유: 오늘 뛰러 나가려고 앱을 켠 사람을 방해하지 않으면서,
// 신발을 고민하는 사람은 스크롤하다 반드시 만나게 하기 위해서입니다.
//
// 지키는 것 둘
//   1. **모든 줄에 값이 있습니다.** 정가를 알면 정가, 모르면 가격대 범위입니다.
//   2. **산식을 숨기지 않습니다.** 제목을 누르면 무엇으로 매겼는지 그대로 열립니다.
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '../../app/design-system/components';
import {
  borderWidth,
  fontWeight,
  layout,
  lineHeight,
  palette,
  pressedOpacity,
  spacing,
  typeScale,
} from '../../app/design-system/theme';
import { shoeArtSpec } from './art';
import { ShoeArt } from './ShoeArt';
import { priceDisplay } from './price';
import { RANKING_DISCLOSURE, rankShoes, rankingCriteria } from './ranking';
import type { ShoeEntry } from './catalog';
import type { ShoeLevel } from './taxonomy';

export const RANKING_LIMIT = 5;

export type ShoeRankingCardProps = {
  shoes: ShoeEntry[];
  /** 지금 사용자 수준입니다. 있으면 그 수준에 맞는 신발이 위로 옵니다. */
  level?: ShoeLevel;
  onOpenShoe: (shoeId: string) => void;
  onOpenAll: () => void;
  now?: Date;
};

export function ShoeRankingCard({
  level,
  now,
  onOpenAll,
  onOpenShoe,
  shoes,
}: ShoeRankingCardProps) {
  const [openCriteria, setOpenCriteria] = useState(false);
  const at = now ?? new Date();
  const ranked = useMemo(
    () => rankShoes(shoes, { ...(level ? { level } : {}), limit: RANKING_LIMIT }, at),
    // 순위는 하루 안에서 바뀔 이유가 없습니다. 날짜만 열쇠로 씁니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shoes, level, at.toISOString().slice(0, 10)],
  );

  if (ranked.length === 0) return null;

  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityHint="어떻게 매긴 순위인지 볼 수 있어요"
        accessibilityRole="button"
        accessibilityState={{ expanded: openCriteria }}
        onPress={() => setOpenCriteria((value) => !value)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={styles.headerCopy}>
          <Text style={styles.title}>이번 주 러닝화 순위</Text>
          <Text style={styles.subtitle}>
            {level ? `${level} 기준으로 매겼어요` : '지금 기록으로 매겼어요'} · 무엇으로 매겼는지 보기
          </Text>
        </View>
        <Text style={styles.caret}>{openCriteria ? '−' : '+'}</Text>
      </Pressable>

      {openCriteria ? (
        <View style={styles.criteria}>
          {rankingCriteria.map((item) => (
            <View key={item.label} style={styles.criterionRow}>
              <Text style={styles.criterionWeight}>{item.weight}%</Text>
              <View style={styles.criterionCopy}>
                <Text style={styles.criterionLabel}>{item.label}</Text>
                <Text style={styles.criterionWhy}>{item.why}</Text>
              </View>
            </View>
          ))}
          <Text style={styles.disclosure}>{RANKING_DISCLOSURE}</Text>
        </View>
      ) : null}

      {ranked.map((item) => {
        const price = priceDisplay(item.shoe, at);
        return (
          <Pressable
            accessibilityLabel={`${item.rank}위 ${item.shoe.brand} ${item.shoe.model}, ${price.headline}`}
            accessibilityRole="button"
            key={item.shoe.id}
            onPress={() => onOpenShoe(item.shoe.id)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.rank}>{item.rank}</Text>
            <ShoeArt spec={shoeArtSpec(item.shoe)} width={64} />
            <View style={styles.rowCopy}>
              <Text numberOfLines={1} style={styles.model}>
                {item.shoe.model}
              </Text>
              <Text numberOfLines={1} style={styles.meta}>
                {`${item.shoe.brand} · ${item.shoe.subCategory}`}
              </Text>
              <Text style={[styles.price, !price.confirmed && styles.priceBand]}>
                {price.headline}
              </Text>
            </View>
          </Pressable>
        );
      })}

      <Button label="러닝화 전체 보기" onPress={onOpenAll} tone="secondary" />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: layout.touchTarget,
  },
  pressed: { opacity: pressedOpacity },
  headerCopy: { flex: 1, gap: 2 },
  title: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
  },
  subtitle: { color: palette.muted, fontSize: typeScale.caption, lineHeight: lineHeight.caption },
  caret: {
    color: palette.muted,
    fontSize: typeScale.titleSmall,
    fontWeight: fontWeight.bold,
    width: 18,
    textAlign: 'center',
  },
  criteria: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: 12,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  criterionRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  criterionWeight: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    fontWeight: fontWeight.bold,
    width: 36,
  },
  criterionCopy: { flex: 1, gap: 1 },
  criterionLabel: {
    color: palette.ink,
    fontSize: typeScale.caption,
    fontWeight: fontWeight.bold,
  },
  criterionWhy: { color: palette.inkSoft, fontSize: typeScale.micro, lineHeight: lineHeight.micro },
  disclosure: {
    color: palette.inkSoft,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    borderTopColor: palette.line,
    borderTopWidth: borderWidth.thin,
    paddingTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: layout.touchTarget,
    borderTopColor: palette.line,
    borderTopWidth: borderWidth.thin,
    paddingTop: spacing.xs,
  },
  rank: {
    color: palette.accentDark,
    fontSize: typeScale.titleSmall,
    fontWeight: fontWeight.heavy,
    width: 20,
    textAlign: 'center',
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 1 },
  model: { color: palette.ink, fontSize: typeScale.bodySmall, fontWeight: fontWeight.bold },
  meta: { color: palette.muted, fontSize: typeScale.micro },
  price: { color: palette.ink, fontSize: typeScale.bodySmall, fontWeight: fontWeight.heavy },
  priceBand: { color: palette.inkSoft, fontSize: typeScale.caption, fontWeight: fontWeight.bold },
});
