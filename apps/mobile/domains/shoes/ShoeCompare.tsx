// 러닝화 2~3켤레를 나란히 비교하는 화면입니다. 제품 이미지 없이 텍스트·칩으로만 보여 줍니다.
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip } from '../../app/design-system/components';
import { palette, radius, spacing, typeScale } from '../../app/design-system/theme';
import type { ShoeEntry } from './catalog';
import { buildComparisonRows, compareHighlights, COMPARE_MIN } from './compare';
import { shoeBrandInitials } from './taxonomy';

const COLUMN_WIDTH = 176;

export function ShoeCompare({
  shoes,
  onBack,
  onOpenShoe,
  onRemove,
  onClear,
}: {
  shoes: ShoeEntry[];
  onBack: () => void;
  onOpenShoe: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const rows = buildComparisonRows(shoes);
  const highlights = compareHighlights(shoes);

  return (
    <View style={styles.container}>
      <Button label="목록으로" onPress={onBack} tone="quiet" />

      <Card style={styles.intro}>
        <Text accessibilityRole="header" style={styles.title}>
          나란히 비교하기
        </Text>
        <Text style={styles.note}>
          담은 러닝화 {shoes.length}켤레를 같은 기준으로 비교해요. 최대 3켤레까지 담을 수 있어요.
        </Text>
        <View style={styles.chipWrap}>
          {shoes.map((shoe) => (
            <Chip
              key={shoe.id}
              label={`${shoe.model} 빼기`}
              onPress={() => onRemove(shoe.id)}
              tone="warning"
            />
          ))}
          {shoes.length > 0 ? <Chip label="모두 비우기" onPress={onClear} tone="neutral" /> : null}
        </View>
      </Card>

      {shoes.length < COMPARE_MIN ? (
        <Card style={styles.block}>
          <Text style={styles.note}>
            비교하려면 목록이나 추천 결과에서 러닝화를 {COMPARE_MIN}켤레 이상 담아 주세요.
          </Text>
        </Card>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator style={styles.table}>
            <View>
              <View style={styles.headRow}>
                <View style={styles.labelCell}>
                  <Text style={styles.labelText}>항목</Text>
                </View>
                {shoes.map((shoe) => (
                  <View key={shoe.id} style={styles.headCell}>
                    <View style={[styles.badge, { backgroundColor: shoe.brandColor }]}>
                      <Text style={styles.badgeText}>{shoeBrandInitials[shoe.brand]}</Text>
                    </View>
                    <Text style={styles.headModel}>{shoe.model}</Text>
                    <Text style={styles.headModelEn}>{shoe.modelEn}</Text>
                    <Chip label="자세히" onPress={() => onOpenShoe(shoe.id)} tone="accent" />
                  </View>
                ))}
              </View>

              {rows.map((row) => (
                <View key={row.label} style={styles.row}>
                  <View style={styles.labelCell}>
                    <Text style={styles.labelText}>{row.label}</Text>
                  </View>
                  {row.values.map((value, index) => (
                    <View key={`${row.label}-${shoes[index]?.id ?? index}`} style={styles.valueCell}>
                      <Text style={row.multiline ? styles.valueMultiline : styles.valueText}>
                        {row.multiline && value !== '—' ? `· ${value}` : value}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>

          <Card style={styles.block}>
            <Text style={styles.blockTitle}>무엇이 다른가요</Text>
            {highlights.map((highlight) => (
              <Text key={highlight} style={styles.note}>
                · {highlight}
              </Text>
            ))}
          </Card>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, paddingBottom: spacing.xxl },
  intro: { gap: spacing.sm, backgroundColor: palette.surfaceWarm },
  title: { color: palette.ink, fontSize: typeScale.title, fontWeight: '900' },
  block: { gap: spacing.xs },
  blockTitle: { color: palette.ink, fontSize: typeScale.titleSmall, fontWeight: '900' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  note: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 18 },
  table: {
    borderColor: palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: palette.surfaceWarm,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
  },
  labelCell: { width: 96, paddingHorizontal: spacing.sm },
  labelText: { color: palette.inkSoft, fontSize: typeScale.caption, fontWeight: '900' },
  headCell: { width: COLUMN_WIDTH, paddingHorizontal: spacing.sm, gap: spacing.xs },
  valueCell: { width: COLUMN_WIDTH, paddingHorizontal: spacing.sm },
  badge: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: palette.white, fontSize: typeScale.caption, fontWeight: '900' },
  headModel: { color: palette.ink, fontSize: typeScale.bodySmall, fontWeight: '900' },
  headModelEn: { color: palette.muted, fontSize: typeScale.caption },
  valueText: { color: palette.ink, fontSize: typeScale.caption, lineHeight: 18 },
  valueMultiline: { color: palette.inkSoft, fontSize: typeScale.caption, lineHeight: 18 },
});
