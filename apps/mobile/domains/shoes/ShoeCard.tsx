// 목록에서 러닝화 한 켤레를 요약해 보여 주는 카드입니다.
// 제품 이미지를 쓰지 않고 브랜드 컬러와 이니셜 기반 액센트로 시각 구분을 만듭니다.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Chip } from '../../app/design-system/components';
import { palette, radius, spacing, typeScale } from '../../app/design-system/theme';
import type { ShoeEntry } from './catalog';
import { shoeBrandInitials, shoePlateLabels } from './taxonomy';

export function ShoeCard({
  shoe,
  focused = false,
  saved = false,
  compareSelected = false,
  onPress,
  onToggleCompare,
}: {
  shoe: ShoeEntry;
  focused?: boolean;
  saved?: boolean;
  compareSelected?: boolean;
  onPress: () => void;
  onToggleCompare?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${shoe.brand} ${shoe.model} 자세히 보기`}
      accessibilityHint="장점, 주의점, 국내 구매 경로를 볼 수 있어요."
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        focused && styles.cardFocused,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.accent, { backgroundColor: shoe.brandColor }]} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <View
            accessibilityLabel={`${shoe.brand} 브랜드 표시`}
            style={[styles.badge, { backgroundColor: shoe.brandColor }]}
          >
            <Text style={styles.badgeText}>{shoeBrandInitials[shoe.brand]}</Text>
          </View>
          <View style={styles.copy}>
            <Text style={styles.brand}>{shoe.brand}</Text>
            <Text style={styles.model}>{shoe.model}</Text>
            <Text style={styles.modelEn}>{shoe.modelEn}</Text>
          </View>
          {saved ? <Chip label="관심" tone="positive" /> : null}
        </View>

        <View style={styles.chipWrap}>
          <Chip label={`${shoe.category} · ${shoe.subCategory}`} tone="accent" />
          <Chip
            label={shoePlateLabels[shoe.plate]}
            tone={shoe.plate === 'none' ? 'neutral' : 'warning'}
          />
          <Chip label={shoe.priceBand} />
        </View>

        <View style={styles.chipWrap}>
          {shoe.levels.map((level) => (
            <Chip key={level} label={level} />
          ))}
          {shoe.distances.slice(0, 3).map((distance) => (
            <Chip key={distance} label={distance} />
          ))}
        </View>

        <Text style={styles.pick}>{shoe.pick}</Text>
        <View style={styles.bullets}>
          {shoe.strengths.slice(0, 2).map((strength) => (
            <Text key={strength} style={styles.bullet}>
              · {strength}
            </Text>
          ))}
        </View>

        {onToggleCompare ? (
          <View style={styles.chipWrap}>
            <Chip
              label={compareSelected ? '비교함에 담김' : '비교함에 담기'}
              selected={compareSelected}
              onPress={onToggleCompare}
              tone="accent"
            />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    minHeight: 48,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  cardFocused: { borderColor: palette.accent, borderWidth: 2 },
  pressed: { opacity: 0.72 },
  accent: { width: 6 },
  body: { flex: 1, minWidth: 0, padding: spacing.lg, gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: palette.white, fontSize: typeScale.bodySmall, fontWeight: '900' },
  copy: { flex: 1, minWidth: 0 },
  brand: { color: palette.muted, fontSize: typeScale.caption, fontWeight: '800' },
  model: { color: palette.ink, fontSize: typeScale.titleSmall, fontWeight: '900', marginTop: 2 },
  modelEn: { color: palette.muted, fontSize: typeScale.caption, marginTop: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pick: { color: palette.ink, fontSize: typeScale.bodySmall, lineHeight: 21, fontWeight: '700' },
  bullets: { gap: 2 },
  bullet: { color: palette.inkSoft, fontSize: typeScale.caption, lineHeight: 18 },
});
