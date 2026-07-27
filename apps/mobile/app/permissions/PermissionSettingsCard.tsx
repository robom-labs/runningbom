// 설정 화면에 넣는 "알림·위치·배터리" 묶음입니다.
// 지금 무엇이 켜져 있는지 그대로 보여 주고, 여기서 다시 켤 수 있게 합니다.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip } from '../design-system/components';
import { fontWeight, lineHeight, palette, spacing, typeScale } from '../design-system/theme';
import { permissionPriming } from './copy';
import {
  permissionActionLabel,
  permissionStatusLabel,
  permissionStatusTone,
} from './rules';
import { usePermissionLedger } from './usePermissionLedger';
import { permissionKeys, type PermissionKey } from './types';

const unavailableReason: Record<PermissionKey, string> = {
  notification: '이 기기에서는 알림을 쓸 수 없어요.',
  location: '이 빌드는 거리 재기를 쓰지 않아서 위치를 묻지 않아요. 시간 기반 코칭만 진행해요.',
  battery: '이 기기에는 배터리 아끼기 설정이 따로 없어요.',
};

export function PermissionSettingsCard() {
  const { ledger, supported, actionFor, ask } = usePermissionLedger();
  const [message, setMessage] = useState('');

  async function handlePress(key: PermissionKey) {
    setMessage('');
    const result = await ask(key);
    if (result.action === 'open-battery-settings') {
      setMessage(
        result.opened === 'battery-list'
          ? '배터리 목록을 열었어요. 러닝봄을 찾아 제한 없음을 골라 주세요.'
          : result.opened === 'app-settings'
            ? '배터리 목록이 없어서 러닝봄 앱 설정을 열었어요. 배터리 항목을 찾아 주세요.'
            : '설정을 열지 못했어요. 휴대폰 설정 > 배터리에서 러닝봄을 찾아 주세요.',
      );
      return;
    }
    if (result.action === 'open-app-settings') {
      setMessage(
        result.opened === 'app-settings'
          ? '러닝봄 설정을 열었어요. 거기서 켜고 돌아오면 이 화면에 바로 반영돼요.'
          : '설정을 열지 못했어요. 휴대폰 설정 > 앱 > 러닝봄에서 바꿔 주세요.',
      );
    }
  }

  return (
    <Card style={styles.card}>
      {permissionKeys.map((key) => {
        const copy = permissionPriming[key];
        const record = ledger[key];
        const isSupported = supported[key];
        const action = actionFor(key);
        const label = permissionActionLabel(action);
        return (
          <View key={key} style={styles.row} testID={`permission-row-${key}`}>
            <View style={styles.rowHead}>
              <Text style={styles.rowTitle}>{copy.shortName}</Text>
              <Chip
                label={isSupported ? permissionStatusLabel(key, record) : '해당 없음'}
                tone={isSupported ? permissionStatusTone(record) : 'neutral'}
              />
            </View>
            <Text style={styles.rowMeta}>
              {isSupported ? copy.shortDescription : unavailableReason[key]}
            </Text>
            {isSupported && label ? (
              <Button
                label={label}
                onPress={() => void handlePress(key)}
                testID={`permission-action-${key}`}
                tone="secondary"
              />
            ) : null}
          </View>
        );
      })}
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      ) : null}
      <Text style={styles.rowMeta}>
        휴대폰에서 직접 끄고 켠 값도 이 화면으로 돌아오면 다시 확인해요.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: { gap: spacing.xs },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 32 },
  rowTitle: {
    flex: 1,
    minWidth: 0,
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.bold,
  },
  rowMeta: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  message: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.semibold,
  },
});
