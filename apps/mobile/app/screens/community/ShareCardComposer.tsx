// 내 러닝 하나를 골라 공유 카드로 만들고, 폰의 공유 기능으로 내보내는 곳입니다.
//
// 정직하게 만든 부분
// - 서버가 없어서 남의 글은 없습니다. 그래서 가짜 사람과 가짜 글을 만들지 않았습니다.
// - 대신 이미 내 기기에 저장된 내 기록만 씁니다. 없는 거리는 0으로 채우지 않고 "안 쟀다"고 적습니다.
// - 새 라이브러리를 넣지 않고 React Native에 들어 있는 Share를 그대로 씁니다.
//   그림 파일을 만드는 기능은 아직 없어서, 화면에는 카드 미리보기를 보여 주고
//   밖으로는 같은 내용을 글로 내보냅니다.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Button, EmptyState, SectionHeader } from '../../design-system/components';
import {
  borderWidth,
  fontWeight,
  layout,
  lineHeight,
  palette,
  pressedOpacity,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';
import {
  buildShareCard,
  shareableActivities,
  shareCardMinimumMinutes,
  shareCardText,
  shareCardTitle,
} from '../../../domains/social/shareCard';
import { useAppState } from '../../state/AppStateProvider';

type Props = {
  /** 기록이 하나도 없을 때 러닝 시작 화면으로 보내 줍니다. */
  onStartRun?: () => void;
};

export function ShareCardComposer({ onStartRun }: Props) {
  const { activities, preferences } = useAppState();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [status, setStatus] = useState('러닝을 하나 고르면 카드가 만들어져요.');

  const options = useMemo(() => shareableActivities(activities), [activities]);

  // 기록이 새로 생기거나 고른 기록이 사라지면 가장 최근 기록으로 되돌립니다.
  useEffect(() => {
    if (options.length === 0) {
      setSelectedId(undefined);
      return;
    }
    setSelectedId((current) =>
      current && options.some((activity) => activity.id === current) ? current : options[0]?.id,
    );
  }, [options]);

  const selected = useMemo(
    () => options.find((activity) => activity.id === selectedId),
    [options, selectedId],
  );
  const card = useMemo(() => (selected ? buildShareCard(selected) : undefined), [selected]);

  async function share() {
    if (!card) return;
    const message = shareCardText(card, preferences.nickname);
    try {
      const result = await Share.share({ message, title: shareCardTitle });
      setStatus(
        result.action === Share.dismissedAction
          ? '내보내기를 취소했어요. 카드는 그대로 있어요.'
          : '내보냈어요. 어디에 올릴지는 직접 고르셨어요.',
      );
    } catch {
      setStatus('내보내기 창을 열지 못했어요. 잠시 뒤 다시 눌러 주세요.');
    }
  }

  if (options.length === 0) {
    return (
      <View style={styles.wrap}>
        <SectionHeader
          title="기록 카드 만들기"
          subtitle="내 러닝 하나를 카드로 만들어 원하는 곳에 올릴 수 있어요."
          compact
        />
        <EmptyState
          title="아직 카드로 만들 기록이 없어요"
          body={`${shareCardMinimumMinutes}분 이상 기록이 하나 생기면 여기서 카드로 만들 수 있어요. 러닝을 마치거나 기록·통계에서 직접 입력해 보세요.`}
          {...(onStartRun ? { actionLabel: '러닝 시작하기', onAction: onStartRun } : {})}
          hint="없는 기록을 만들어 보여 주지 않아요."
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <SectionHeader
        title="기록 카드 만들기"
        subtitle="내 러닝 하나를 카드로 만들어 원하는 곳에 올릴 수 있어요."
        compact
      />

      <Text style={styles.pickLabel}>어떤 러닝으로 만들까요?</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pickRow}
      >
        {options.map((activity) => {
          const option = buildShareCard(activity);
          const isSelected = activity.id === selectedId;
          return (
            <Pressable
              accessibilityLabel={`${option.shortDateLabel} ${option.kindLabel} ${option.hasDistance ? option.distanceLabel : ''} ${option.durationLabel}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={activity.id}
              onPress={() => {
                setSelectedId(activity.id);
                setStatus('카드를 만들었어요. 아래에서 확인하고 내보낼 수 있어요.');
              }}
              style={({ pressed }) => [
                styles.pickItem,
                isSelected && styles.pickItemSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.pickDate, isSelected && styles.pickTextSelected]}>
                {option.shortDateLabel}
              </Text>
              <Text style={[styles.pickMain, isSelected && styles.pickTextSelected]}>
                {option.hasDistance ? option.distanceLabel : option.durationLabel}
              </Text>
              <Text style={[styles.pickKind, isSelected && styles.pickTextSelected]}>
                {option.kindLabel}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {card ? (
        <View
          accessibilityLabel={`기록 카드 미리보기. ${card.dateLabel}. ${card.kindLabel}. ${card.distanceLabel}. ${card.durationLabel}. ${card.paceLabel}.`}
          style={styles.preview}
        >
          <Text style={styles.previewBrand}>러닝봄 기록 카드</Text>
          <Text style={styles.previewDate}>{card.dateLabel}</Text>
          <Text style={styles.previewBig}>
            {card.hasDistance ? card.distanceLabel : card.durationLabel}
          </Text>
          <Text style={styles.previewKind}>{card.kindLabel}</Text>
          <View style={styles.previewRow}>
            <View style={styles.previewCell}>
              <Text style={styles.previewCellLabel}>달린 시간</Text>
              <Text style={styles.previewCellValue}>{card.durationLabel}</Text>
            </View>
            <View style={styles.previewCell}>
              <Text style={styles.previewCellLabel}>1km당</Text>
              <Text style={styles.previewCellValue}>
                {card.hasDistance ? card.paceLabel.replace('1km당 ', '') : '기록 없음'}
              </Text>
            </View>
          </View>
          {card.hasDistance ? null : <Text style={styles.previewNote}>{card.paceLabel}</Text>}
          <Text style={styles.previewSource}>{card.sourceLabel}</Text>
        </View>
      ) : null}

      <Button
        accessibilityHint="폰의 공유 창이 열려요. 어디에 올릴지는 직접 고르시면 돼요. 러닝봄이 대신 올리지 않아요."
        label="공유 카드 내보내기"
        onPress={() => void share()}
        size="lg"
        style={styles.shareButton}
      />

      <Text accessibilityLiveRegion="polite" style={styles.status}>
        {status}
      </Text>
      <Text style={styles.note}>
        러닝봄이 대신 올리는 곳은 없어요. 공유 창에서 고른 곳에만 내 손으로 올라가고, 카드 내용은
        기기에 저장된 내 기록 그대로예요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  pressed: { opacity: pressedOpacity },
  pickLabel: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.bold,
  },
  pickRow: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.xxs / 2 },
  pickItem: {
    minWidth: 96,
    minHeight: layout.touchTarget,
    gap: spacing.xxs / 2,
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: borderWidth.thin,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pickItemSelected: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  pickDate: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
  },
  pickMain: {
    color: palette.ink,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.heavy,
  },
  pickKind: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
  },
  pickTextSelected: { color: palette.white },
  preview: {
    gap: spacing.xxs,
    backgroundColor: palette.navy,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  previewBrand: {
    color: palette.onNavyAccent,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.heavy,
  },
  previewDate: {
    color: palette.onNavySoft,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  previewBig: {
    color: palette.onNavy,
    fontSize: typeScale.display,
    lineHeight: lineHeight.display,
    fontWeight: fontWeight.heavy,
    marginTop: spacing.xs,
  },
  previewKind: {
    color: palette.onNavySoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.semibold,
  },
  previewRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  previewCell: { flex: 1, minWidth: 0, gap: spacing.xxs / 2 },
  previewCellLabel: {
    color: palette.onNavyMuted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
  },
  previewCellValue: {
    color: palette.onNavy,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.bold,
  },
  previewNote: {
    color: palette.onNavyMuted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    marginTop: spacing.xs,
  },
  previewSource: {
    color: palette.onNavyMuted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    marginTop: spacing.md,
  },
  shareButton: { minHeight: layout.touchTarget },
  status: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.semibold,
  },
  note: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
  },
});
