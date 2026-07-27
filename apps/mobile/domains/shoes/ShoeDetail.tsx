// 러닝화 한 켤레의 상세 화면입니다. 장점·주의점·추천 상황과 국내 구매 경로를 제공합니다.
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip } from '../../app/design-system/components';
import { layout, palette, radius, spacing, typeScale } from '../../app/design-system/theme';
import {
  OFFICIAL_SPEC_CAPTION,
  SHOE_DATA_VERSION,
  findShoeEntry,
  officialSpecItems,
  type ShoeEntry,
} from './catalog';
import { entryPurchaseLinks, specReferenceLink, type ShoePurchaseLink } from './purchaseLinks';
import { SHOE_ART_CAPTION, shoeArtSpec } from './art';
import { ShoeArt } from './ShoeArt';
import { ArtImage } from '../media/ArtImage';
import { imageCreditLabel, officialImage } from '../media/officialImages';
import { priceDisplay } from './price';
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
  compareSelected = false,
  onBack,
  onToggleSaved,
  onToggleCurrent,
  onOpenPurchase,
  onOpenShoe,
  onToggleCompare,
}: {
  shoe: ShoeEntry;
  saved: boolean;
  current: boolean;
  compareSelected?: boolean;
  onBack: () => void;
  onToggleSaved: () => void;
  onToggleCurrent: () => void;
  onOpenPurchase: (destination: ShoePurchaseLink) => void;
  onOpenShoe?: (id: string) => void;
  onToggleCompare?: () => void;
}) {
  const links = entryPurchaseLinks(shoe);
  // 가격은 상세에서 가장 먼저 보이는 숫자여야 합니다. 정가를 모르면 가격대 범위가 옵니다.
  const price = priceDisplay(shoe, new Date());
  // 값이 확인된 항목만 들어옵니다. 비어 있으면 카드 대신 공식 페이지 안내를 보여 줍니다.
  const specs = officialSpecItems(shoe);
  const specReference = specReferenceLink(shoe);
  const alternatives = shoe.comparedTo
    .map((id) => findShoeEntry(id))
    .filter((entry): entry is ShoeEntry => Boolean(entry));

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

      {/*
        공식 사진이 있으면 사진, 없으면 우리 그림입니다.
        캡션도 그에 맞게 바뀝니다 — 우리 그림을 사진인 것처럼, 남의 사진을 우리 것처럼 보이게 하지 않습니다.
      */}
      <Card style={styles.artCard}>
        <ArtImage
          accessibilityLabel={`${shoe.brand} ${shoe.model} 이미지`}
          fallback={
            <ShoeArt spec={shoeArtSpec(shoe)} width={220} />
          }
          height={140}
          id={shoe.id}
          width={220}
        />
        <Text style={styles.artCaption}>
          {officialImage(shoe.id)
            ? imageCreditLabel(officialImage(shoe.id) as { source: string; url: string; checkedAt: string })
            : SHOE_ART_CAPTION}
        </Text>
      </Card>

      {/*
        가격 — 정가를 확인했으면 정가를, 아직이면 가격대 범위를 크게 씁니다.
        빈칸도 만들지 않고, 값을 지어내지도 않습니다.
      */}
      <Card style={styles.block}>
        <Text style={styles.blockTitle}>가격</Text>
        <Text style={[styles.priceHeadline, !price.confirmed && styles.priceHeadlineBand]}>
          {price.headline}
        </Text>
        <Text style={styles.priceDetail}>{price.detail}</Text>
        {price.basis ? <Text style={styles.note}>{price.basis}</Text> : null}
        {price.warning ? <Text style={styles.priceWarning}>{price.warning}</Text> : null}
        <Text style={styles.note}>
          매장·시기에 따라 다를 수 있어요. 러닝봄은 신발을 팔지 않고 공식 판매처로 이동만 해요.
        </Text>
      </Card>

      <Card style={styles.block}>
        <Text style={styles.blockTitle}>공식 스펙</Text>
        {specs.length > 0 ? (
          <>
            <View style={styles.specGrid}>
              {specs.map((item) => (
                <View
                  key={item.key}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`${item.label} ${item.value}, ${OFFICIAL_SPEC_CAPTION}`}
                  style={styles.specItem}
                >
                  <Text style={styles.specLabel}>{item.label}</Text>
                  <Text style={styles.specValue}>{item.value}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.specCaption}>
              {OFFICIAL_SPEC_CAPTION} · 무게는 브랜드 표준 남성 사이즈(US 9) 기준이에요.
            </Text>
            <Text style={styles.note}>
              확인되지 않은 항목은 빈칸이나 물음표로 채우지 않고 아예 표시하지 않아요.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.paragraph}>
              제조사 공식 페이지에서 무게·드롭을 확인하세요. 러닝봄은 확인되지 않은 수치를 추정해서
              적지 않아요.
            </Text>
            {specReference ? (
              <Button
                label={`${shoe.brand} ${specReference.label}`}
                accessibilityLabel={`${shoe.brand} ${shoe.model} ${specReference.label} 열기`}
                accessibilityHint="외부 브라우저로 이동해요"
                onPress={() => onOpenPurchase(specReference)}
                tone="secondary"
                style={styles.specLink}
              />
            ) : null}
          </>
        )}
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
        <Text style={styles.blockTitle}>언제 신는 신발인가요</Text>
        <Text style={styles.paragraph}>{shoe.useCase}</Text>
      </Card>

      <Card style={styles.block}>
        <Text style={styles.blockTitle}>이런 러너에게 잘 맞아요</Text>
        {shoe.bestForRunner.map((line) => (
          <Text key={line} style={styles.bullet}>
            · {line}
          </Text>
        ))}
        <Text style={[styles.blockTitle, styles.blockTitleSpaced]}>이럴 땐 다른 신발을 보세요</Text>
        {shoe.notFor.map((line) => (
          <Text key={line} style={styles.watchout}>
            · {line}
          </Text>
        ))}
        <Text style={styles.note}>
          발 상태나 통증에 대한 판단은 하지 않아요. 불편함이 이어지면 전문가 상담을 먼저 권해요.
        </Text>
      </Card>

      <Card style={styles.block}>
        <Text style={styles.blockTitle}>착화감·사이즈</Text>
        <Text style={styles.paragraph}>{shoe.fitNote}</Text>
      </Card>

      {shoe.keyTech.length > 0 ? (
        <Card style={styles.block}>
          <Text style={styles.blockTitle}>브랜드 공식 기술명</Text>
          <View style={styles.chipWrap}>
            {shoe.keyTech.map((tech) => (
              <Chip key={tech} label={tech} tone="accent" />
            ))}
          </View>
          <Text style={styles.note}>
            브랜드가 공식적으로 쓰는 이름만 적어요. 확인되지 않은 기술명은 넣지 않습니다.
          </Text>
        </Card>
      ) : null}

      {alternatives.length > 0 ? (
        <Card style={styles.block}>
          <Text style={styles.blockTitle}>비슷한 신발 비교</Text>
          <Text style={styles.note}>
            같은 세부 카테고리에서 자주 함께 검토되는 대안이에요.
          </Text>
          <View style={styles.chipWrap}>
            {alternatives.map((alternative) => (
              <Chip
                key={alternative.id}
                label={`${alternative.brand} ${alternative.model}`}
                accessibilityRole="button"
                accessibilityLabel={`${alternative.brand} ${alternative.model} 상세 보기`}
                onPress={onOpenShoe ? () => onOpenShoe(alternative.id) : undefined}
              />
            ))}
          </View>
          {onToggleCompare ? (
            <Chip
              label={compareSelected ? '비교함에 담김' : '비교함에 담기'}
              accessibilityRole="button"
              accessibilityLabel={
                compareSelected
                  ? `${shoe.model} 비교함에서 빼기`
                  : `${shoe.model} 비교함에 담기`
              }
              selected={compareSelected}
              onPress={onToggleCompare}
              tone="accent"
            />
          ) : null}
        </Card>
      ) : null}

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
            accessibilityRole="button"
            accessibilityLabel={
              current ? `${shoe.model} 현재 러닝화 해제` : `${shoe.model} 내 러닝화로 설정`
            }
            selected={current}
            onPress={onToggleCurrent}
            tone="accent"
          />
          <Chip
            label={saved ? '관심 저장됨' : '관심 저장'}
            accessibilityRole="button"
            accessibilityLabel={
              saved ? `${shoe.model} 관심 저장 해제` : `${shoe.model} 관심 저장`
            }
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
              accessibilityLabel={`${shoe.brand} ${shoe.model} ${destination.label} 열기`}
              accessibilityHint="외부 브라우저로 이동해요"
              onPress={() => onOpenPurchase(destination)}
              tone={destination.id === 'official-korea' ? 'primary' : 'secondary'}
            />
          ))}
        </View>
        <Text style={styles.note}>
          국내 공식 경로가 확인된 브랜드에만 공식 버튼을 보여 줘요. 공식 도메인을 확인하지 못한
          브랜드는 공식몰인 척하지 않고 "브랜드 검색"으로 안내해요. 해외 공식몰은 국내 구매 경로로
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
  paragraph: { color: palette.inkSoft, fontSize: typeScale.bodySmall, lineHeight: 22 },
  block: { gap: spacing.sm },
  artCard: { alignItems: 'center', gap: spacing.xs },
  artCaption: { color: palette.muted, fontSize: typeScale.micro, textAlign: 'center' },
  // 가격은 상세에서 가장 큰 숫자입니다. 가격 때문에 고민하는 사람이 대부분입니다.
  priceHeadline: { color: palette.ink, fontSize: typeScale.headline, fontWeight: '900' },
  // 확인된 정가가 아니라 가격대 범위일 때는 한 단계 눌러 씁니다(다른 값임이 보여야 합니다).
  priceHeadlineBand: { fontSize: typeScale.title, color: palette.inkSoft },
  priceDetail: { color: palette.inkSoft, fontSize: typeScale.bodySmall, fontWeight: '700' },
  priceWarning: { color: palette.warning, fontSize: typeScale.caption, fontWeight: '700' },
  sourceBlock: { gap: spacing.xs, backgroundColor: palette.surfaceWarm },
  blockTitle: { color: palette.ink, fontSize: typeScale.titleSmall, fontWeight: '900' },
  blockTitleSpaced: { marginTop: spacing.sm },
  metaLabel: { color: palette.muted, fontSize: typeScale.caption, fontWeight: '800' },
  bullet: { color: palette.inkSoft, fontSize: typeScale.bodySmall, lineHeight: 21 },
  watchout: { color: palette.warning, fontSize: typeScale.bodySmall, lineHeight: 21, fontWeight: '700' },
  note: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 18 },
  linkColumn: { gap: spacing.xs },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  specItem: {
    minWidth: 96,
    // 화면 확대에서도 값이 잘리지 않도록 터치 대상과 같은 48px을 하한으로 둡니다.
    minHeight: layout.touchTarget,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: palette.surfaceMuted,
  },
  specLabel: { color: palette.muted, fontSize: typeScale.caption, fontWeight: '800' },
  specValue: { color: palette.ink, fontSize: typeScale.body, fontWeight: '900', marginTop: 2 },
  specCaption: { color: palette.inkSoft, fontSize: typeScale.caption, fontWeight: '700', lineHeight: 18 },
  specLink: { minHeight: layout.touchTarget },
});
