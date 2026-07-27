// 회차 전체를 한 줄 띠로 보여 줍니다. 칸 하나가 구간 하나이고, 넓이는 구간 길이에 비례해요.
// 걷기와 뛰기는 색으로 나누고, 지금 하고 있는 칸은 테두리와 점으로 강조합니다.
import { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  borderWidth,
  fontWeight,
  lineHeight,
  palette,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';
import type { RibbonCell } from '../../../domains/programs/session';

export type SegmentRibbonProps = {
  cells: RibbonCell[];
  /** 띠 전체 너비입니다. 칸이 아주 얇아지지 않게 가로로 넘치면 옆으로 밀어 볼 수 있어요. */
  width?: number;
};

/** 칸 하나의 최소 너비입니다. 이보다 좁으면 글씨가 안 보여요. */
const MIN_CELL_WIDTH = 46;

export const SegmentRibbon = memo(function SegmentRibbon({
  cells,
  width = 320,
}: SegmentRibbonProps) {
  const totalWidth = Math.max(width, cells.length * MIN_CELL_WIDTH);
  return (
    <View accessibilityLabel="오늘 회차의 구간 순서" style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[styles.row, { width: totalWidth }]}>
          {cells.map((cell) => (
            <View
              accessibilityLabel={`${cell.index + 1}번째 구간 ${cell.label} ${cell.minuteLabel}${
                cell.state === 'current' ? ', 지금 이 구간이에요' : ''
              }`}
              key={cell.id}
              style={[
                styles.cell,
                { width: Math.max(MIN_CELL_WIDTH, totalWidth * cell.widthRatio) },
                cell.kind === 'run' ? styles.cellRun : styles.cellWalk,
                cell.state === 'done' && styles.cellDone,
                cell.state === 'current' && styles.cellCurrent,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.cellTime,
                  cell.kind === 'run' ? styles.cellTimeRun : styles.cellTimeWalk,
                  cell.state === 'current' && styles.cellTimeCurrent,
                ]}
              >
                {cell.minuteLabel}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.cellWalk]} />
          <Text style={styles.legendText}>걷기</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.cellRun]} />
          <Text style={styles.legendText}>뛰기</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xxs,
  },
  cell: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: borderWidth.emphasis,
    paddingHorizontal: spacing.xxs,
  },
  cellWalk: {
    backgroundColor: palette.surfaceMuted,
    borderColor: palette.surfaceMuted,
  },
  cellRun: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.accentSoft,
  },
  cellDone: {
    opacity: 0.5,
  },
  cellCurrent: {
    borderColor: palette.ink,
  },
  cellTime: {
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    fontWeight: fontWeight.semibold,
  },
  cellTimeWalk: { color: palette.inkSoft },
  cellTimeRun: { color: palette.accentDark },
  cellTimeCurrent: { color: palette.ink },
  legend: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
  },
  legendText: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
});
