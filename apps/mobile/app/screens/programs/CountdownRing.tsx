// 지금 구간에 남은 시간을 큰 원으로 보여 줍니다. 테두리가 줄어들면서 남은 시간을 알려 줘요.
// 배지에서 쓰던 react-native-svg를 그대로 씁니다(새 라이브러리를 더하지 않습니다).
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import {
  fontWeight,
  lineHeight,
  palette,
  spacing,
  typeScale,
} from '../../design-system/theme';

export type CountdownRingProps = {
  /** 지금 구간을 얼마나 했는지(0~1)입니다. 1이 되면 테두리가 다 사라져요. */
  ratio: number;
  /** 원 안 큰 숫자입니다. 예: "2:30" */
  remainingLabel: string;
  /** 원 안 큰 글씨입니다. 예: "뛰기" */
  actionLabel: string;
  /** 걷기와 뛰기를 색으로 나눕니다. */
  kind: 'walk' | 'run';
  /** 원 아래에 붙는 짧은 설명입니다. */
  caption?: string;
  size?: number;
};

const STROKE = 14;

export const CountdownRing = memo(function CountdownRing({
  ratio,
  remainingLabel,
  actionLabel,
  kind,
  caption,
  size = 240,
}: CountdownRingProps) {
  const safeRatio = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  const radius = size / 2 - STROKE / 2;
  const circumference = 2 * Math.PI * radius;
  const color = kind === 'run' ? palette.accentStrong : palette.navy;
  return (
    <View
      accessibilityLabel={`${actionLabel} ${remainingLabel} 남았어요`}
      accessibilityRole="progressbar"
      style={[styles.wrap, { width: size, height: size }]}
    >
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={palette.surfaceMuted}
          strokeWidth={STROKE}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          origin={`${size / 2}, ${size / 2}`}
          r={radius}
          rotation={-90}
          stroke={color}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * safeRatio}
          strokeLinecap="round"
          strokeWidth={STROKE}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.action, kind === 'run' ? styles.actionRun : styles.actionWalk]}>
          {actionLabel}
        </Text>
        <Text style={styles.remaining}>{remainingLabel}</Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.lg,
  },
  action: {
    fontSize: typeScale.headline,
    lineHeight: lineHeight.headline,
    fontWeight: fontWeight.heavy,
    textAlign: 'center',
  },
  actionRun: { color: palette.accentDark },
  actionWalk: { color: palette.navy },
  remaining: {
    color: palette.ink,
    fontSize: typeScale.display,
    lineHeight: lineHeight.display,
    fontWeight: fontWeight.heavy,
  },
  caption: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    textAlign: 'center',
  },
});
