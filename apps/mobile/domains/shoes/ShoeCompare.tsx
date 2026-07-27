// 러닝화 2~3켤레를 나란히 비교하는 화면입니다. 제품 이미지 없이 텍스트·칩으로만 보여 줍니다.
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, EmptyState } from '../../app/design-system/components';
import { layout, palette, radius, spacing, typeScale } from '../../app/design-system/theme';
import type { ShoeEntry } from './catalog';
import { buildComparisonRows, compareHighlights, COMPARE_MAX, COMPARE_MIN } from './compare';
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
      <Button label="돌아가기" onPress={onBack} tone="quiet" />

      <Card style={styles.intro}>
        <Text accessibilityRole="header" style={styles.title}>
          나란히 비교하기
        </Text>
        <Text style={styles.note}>
          담은 러닝화 {shoes.length}켤레를 같은 기준으로 비교해요. 최대 3켤레까지 담을 수 있어요.
        </Text>
        <View
          accessibilityRole="list"
          accessibilityLabel={`비교함에 담긴 러닝화 ${shoes.length}켤레`}
          style={styles.chipWrap}
        >
          {shoes.map((shoe) => (
            <Chip
              key={shoe.id}
              label={`${shoe.model} 빼기`}
              accessibilityRole="button"
              accessibilityLabel={`${shoe.brand} ${shoe.model} 비교함에서 빼기`}
              selected
              onPress={() => onRemove(shoe.id)}
              tone="warning"
            />
          ))}
          {shoes.length > 0 ? (
            <Chip
              label="모두 비우기"
              accessibilityRole="button"
              accessibilityLabel="비교함 모두 비우기"
              onPress={onClear}
              tone="neutral"
            />
          ) : null}
        </View>
      </Card>

      {shoes.length === 0 ? (
        <EmptyState
          title="비교함이 비어 있어요"
          body={`목록이나 추천 결과에서 "비교함에 담기"를 누르면 여기에서 ${COMPARE_MIN}켤레부터 나란히 볼 수 있어요.`}
          actionLabel="목록에서 담으러 가기"
          onAction={onBack}
          hint={`한 번에 최대 ${COMPARE_MAX}켤레까지 담을 수 있어요.`}
        />
      ) : shoes.length < COMPARE_MIN ? (
        <Card style={styles.block}>
          <Text style={styles.note}>
            비교하려면 {COMPARE_MIN - shoes.length}켤레를 더 담아 주세요. 지금은 {shoes.length}켤레만
            담겨 있어요.
          </Text>
          <Button label="목록에서 더 담기" onPress={onBack} tone="secondary" />
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
                    <View
                      accessibilityLabel={`${shoe.brand} 브랜드 표시`}
                      style={[styles.badge, { backgroundColor: shoe.brandColor }]}
                    >
                      <Text style={styles.badgeText}>{shoeBrandInitials[shoe.brand]}</Text>
                    </View>
                    <Text accessibilityRole="header" style={styles.headModel}>
                      {shoe.model}
                    </Text>
                    <Text style={styles.headModelEn}>{shoe.modelEn}</Text>
                    <Chip
                      label="자세히"
                      accessibilityRole="button"
                      accessibilityLabel={`${shoe.brand} ${shoe.model} 자세히 보기`}
                      onPress={() => onOpenShoe(shoe.id)}
                      tone="accent"
                    />
                  </View>
                ))}
              </View>

              {rows.map((row) => (
                // 한 행을 하나의 접근성 노드로 읽어 "항목 - 신발별 값" 순서가 흐트러지지 않게 합니다.
                <View
                  key={row.label}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`${row.label}. ${row.values
                    .map((value, index) => `${shoes[index]?.model ?? ''} ${value}`)
                    .join(', ')}`}
                  style={styles.row}
                >
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
    // 행 자체도 48px 하한을 지켜 글자 확대 시 값이 서로 붙지 않게 합니다.
    minHeight: layout.touchTarget,
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
