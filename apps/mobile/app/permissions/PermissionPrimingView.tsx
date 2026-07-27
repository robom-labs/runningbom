// 시스템 창이 뜨기 직전에 보여 주는 사전 설명 화면의 본문입니다.
// 버튼은 온보딩 아래쪽 고정 영역이 갖고 있어서, 여기서는 읽을 내용만 그립니다.
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../design-system/components';
import {
  fontWeight,
  lineHeight,
  palette,
  radius,
  spacing,
  typeScale,
} from '../design-system/theme';
import type { PermissionPrimingCopy } from './copy';
import type { PermissionAction, PermissionOutcome } from './types';

export type PermissionPrimingViewProps = {
  copy: PermissionPrimingCopy;
  action: PermissionAction;
  outcome: PermissionOutcome;
  /** 설정 화면을 열어 본 뒤 남기는 한 줄 안내입니다. */
  note?: string;
};

export function PermissionPrimingView({ copy, action, outcome, note }: PermissionPrimingViewProps) {
  // 방금 무슨 일이 있었는지(note)가 있으면 그것만 보여 주고, 같은 말을 두 번 하지 않습니다.
  const showDeniedNote = !note && (outcome === 'denied' || outcome === 'opened');

  return (
    <View style={styles.root} testID={`permission-priming-${copy.key}`}>
      <Text accessibilityRole="header" style={styles.title}>
        {copy.title}
      </Text>
      <Text style={styles.body}>{copy.body}</Text>

      <Card style={styles.honestyCard} tone="muted">
        <Text style={styles.honestyLabel}>안 켜도 되는 것</Text>
        <Text style={styles.honestyBody}>{copy.honesty}</Text>
      </Card>

      {copy.promise ? (
        <Card style={styles.promiseCard} tone="warm">
          <Text style={styles.promiseBody}>{copy.promise}</Text>
        </Card>
      ) : null}

      {copy.steps ? (
        <Card style={styles.stepsCard}>
          <Text style={styles.stepsLabel}>여기서 이렇게 하면 돼요</Text>
          {copy.steps.map((step) => (
            <View key={step} style={styles.stepRow}>
              <View style={styles.stepBullet} />
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {action === 'open-app-settings' ? (
        <Text accessibilityLiveRegion="polite" style={styles.note}>
          {copy.settingsNote}
        </Text>
      ) : showDeniedNote ? (
        <Text accessibilityLiveRegion="polite" style={styles.note}>
          {copy.deniedNote}
        </Text>
      ) : null}

      {note ? (
        <Text accessibilityLiveRegion="polite" style={styles.note}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  title: {
    color: palette.ink,
    fontSize: typeScale.title,
    lineHeight: lineHeight.title,
    fontWeight: fontWeight.heavy,
    letterSpacing: -0.6,
  },
  body: {
    color: palette.inkSoft,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
  },
  honestyCard: { gap: spacing.xxs },
  honestyLabel: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.bold,
  },
  honestyBody: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  promiseCard: { gap: spacing.xxs },
  promiseBody: {
    color: palette.accentDark,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.semibold,
  },
  stepsCard: { gap: spacing.xs },
  stepsLabel: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.heavy,
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  stepBullet: {
    width: spacing.xs,
    height: spacing.xs,
    marginTop: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.accentStrong,
  },
  stepText: {
    flex: 1,
    minWidth: 0,
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  note: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.semibold,
  },
});
