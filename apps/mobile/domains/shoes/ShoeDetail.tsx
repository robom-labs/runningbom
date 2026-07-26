// 러닝화 한 켤레의 상세 화면입니다. 장점·주의점·추천 상황과 국내 구매 경로를 제공합니다.
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip } from '../../app/design-system/components';
import { palette, radius, spacing, typeScale } from '../../app/design-system/theme';
import { SHOE_DATA_VERSION, type ShoeEntry } from './catalog';
import { entryPurchaseLinks, type ShoePurchaseLink } from './purchaseLinks';
import {
  shoeBrandInitials,
  shoePlateLabels,
  shoePriceBandLabels,
  shoeVerificationLabels,
} from './taxonomy';

export function ShoeDetail({
  shoe,
  saved,
  current,
  onBack,
  onToggleSaved,
  onToggleCurrent,
  onOpenPurchase,
}: {
  shoe: ShoeEntry;
  saved: boolean;
  current: boolean;
  onBack: () => void;
  onToggleSaved: () => void;
  onToggleCurrent: () => void;
  onOpenPurchase: (destination: ShoePurchaseLink) => void;
}) {
  const links = entryPurchaseLinks(shoe);

  return (
    <View style={styles.container}>
      <Button label="목록으로" onPress={onBack} tone="quiet" />

      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <View
            accessibilityLabel={`${shoe.brand} 브랜드 표시`}
            style={[styles.badge, { backgroundColor: shoe.brandColor }]}
          >
            <Text style={styles.badgeText}>{shoeBrandInitials[shoe.brand]}</Text>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.brand}>{shoe.brand}</Text>
            <Text accessibilityRole="header" style={styles.model}>
              {shoe.model}
            </Text>
            <Text style={styles.modelEn}>{shoe.modelEn}</Text>
          </View>
        </View>
        <View style={styles.chipWrap}>
          <Chip label={shoe.category} tone="accent" />
          <Chip label={shoe.subCategory} tone="accent" />
          <Chip
            label={shoePlateLabels[shoe.plate]}
            tone={shoe.plate === 'none' ? 'neutral' : 'warning'}
          />
          <Chip label={shoePriceBandLabels[shoe.priceBand]} />
        </View>
        <Text style={styles.pick}>{shoe.pick}</Text>
      </Card>

      <Card style={styles.block}>
        <Text style={styles.blockTitle}>이런 상황에 잘 맞아요</Text>
        <View style={styles.chipWrap}>
          {shoe.purposeTags.map((tag) => (
            <Chip key={tag} label={tag} tone="positive" />
          ))}
        </View>
        <Text style={styles.metaLabel}>추천 실력</Text>
        <View style={styles.chipWrap}>
          {shoe.levels.map((level) => (
            <Chip key={level} label={level} />
          ))}
        </View>
        <Text style={styles.metaLabel}>어울리는 거리</Text>
        <View style={styles.chipWrap}>
          {shoe.distances.map((distance) => (
            <Chip key={distance} label={distance} />
          ))}
        </View>
      </Card>

      <Card style={styles.block}>
        <Text style={styles.blockTitle}>장점</Text>
        {shoe.strengths.map((strength) => (
          <Text key={strength} style={styles.bullet}>
            · {strength}
          </Text>
        ))}
        <Text style={[styles.blockTitle, styles.blockTitleSpaced]}>주의할 점</Text>
        {shoe.watchouts.map((watchout) => (
          <Text key={watchout} style={styles.watchout}>
            · {watchout}
          </Text>
        ))}
      </Card>

      <Card style={styles.block}>
        <Text style={styles.blockTitle}>내 기록에 반영하기</Text>
        <View style={styles.chipWrap}>
          <Chip
            label={current ? '현재 러닝화' : '내 러닝화로 설정'}
            selected={current}
            onPress={onToggleCurrent}
            tone="accent"
          />
          <Chip
            label={saved ? '관심 저장됨' : '관심 저장'}
            selected={saved}
            onPress={onToggleSaved}
            tone="positive"
          />
        </View>
      </Card>

      <Card style={styles.block}>
        <Text style={styles.blockTitle}>국내에서 찾아보기</Text>
        <Text style={styles.note}>
          아래는 검색 결과로 이동하는 링크예요. 러닝봄은 가격을 수집하지 않으니 최종 가격과 정품 여부는
          각 판매처에서 직접 확인해 주세요.
        </Text>
        <View style={styles.linkColumn}>
          {links.map((destination) => (
            <Button
              key={destination.id}
              label={destination.label}
              onPress={() => onOpenPurchase(destination)}
              tone={destination.id === 'official-korea' ? 'primary' : 'secondary'}
            />
          ))}
        </View>
        <Text style={styles.note}>
          국내 공식 경로가 확인된 브랜드에만 공식 버튼을 보여 줘요. 해외 공식몰은 국내 구매 경로로
          연결하지 않습니다.
        </Text>
      </Card>

      <Card style={styles.sourceBlock}>
        <Text style={styles.blockTitle}>출처와 검증 상태</Text>
        <Text style={styles.note}>분류 근거 · {shoeVerificationLabels[shoe.verification]}</Text>
        <Text style={styles.note}>
          수치 스펙 · {shoe.specNote ?? '공식 확인된 항목만 표기'}
        </Text>
        <Text style={styles.note}>데이터 버전 · {SHOE_DATA_VERSION}</Text>
        <Text style={styles.note}>
          무게·드롭·스택높이·정확한 판매가는 확인된 값만 표기하며, 미확인 항목은 비워 둡니다.
          가격은 밴드 구간으로만 안내해요.
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, paddingBottom: spacing.xxl },
  hero: { gap: spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  badge: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: palette.white, fontSize: typeScale.body, fontWeight: '900' },
  heroCopy: { flex: 1, minWidth: 0 },
  brand: { color: palette.muted, fontSize: typeScale.caption, fontWeight: '800' },
  model: { color: palette.ink, fontSize: typeScale.title, fontWeight: '900', marginTop: 2 },
  modelEn: { color: palette.muted, fontSize: typeScale.bodySmall, marginTop: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pick: { color: palette.ink, fontSize: typeScale.body, lineHeight: 24, fontWeight: '700' },
  block: { gap: spacing.sm },
  sourceBlock: { gap: spacing.xs, backgroundColor: palette.surfaceWarm },
  blockTitle: { color: palette.ink, fontSize: typeScale.titleSmall, fontWeight: '900' },
  blockTitleSpaced: { marginTop: spacing.sm },
  metaLabel: { color: palette.muted, fontSize: typeScale.caption, fontWeight: '800' },
  bullet: { color: palette.inkSoft, fontSize: typeScale.bodySmall, lineHeight: 21 },
  watchout: { color: palette.warning, fontSize: typeScale.bodySmall, lineHeight: 21, fontWeight: '700' },
  note: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 18 },
  linkColumn: { gap: spacing.xs },
});
