// 직접 입력 활동을 개인 기록으로만 저장하는 간결한 입력 카드를 제공합니다.
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { parseManualActivity } from '../../../domains/activities/manual';
import type { ActivityKind } from '../../../domains/activities/types';
import { Button, Card, Chip } from '../../design-system/components';
import {
  borderWidth,
  fontWeight,
  layout,
  lineHeight,
  palette,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';

type ManualActivityCardProps = {
  onSave: (input: {
    kind: ActivityKind;
    durationMinutes: number;
    distanceKm?: number;
  }) => Promise<void>;
};

const kindLabels: Array<[ActivityKind, string]> = [
  ['run', '러닝'],
  ['walk', '걷기'],
  ['recovery', '회복'],
];

export function ManualActivityCard({ onSave }: ManualActivityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [kind, setKind] = useState<ActivityKind>('run');
  const [durationText, setDurationText] = useState('30');
  const [distanceText, setDistanceText] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    const result = parseManualActivity({ kind, durationText, distanceText });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      await onSave(result.value);
      setMessage(
        result.movementCounts
          ? '기기 개인 기록에 저장했어요. 직접 입력은 리그 점수에 포함되지 않아요.'
          : '기기 개인 기록에 저장했어요. 인정 기준보다 짧아 연속 기록에는 포함되지 않아요.',
      );
      setDistanceText('');
    } catch {
      setMessage('기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text style={styles.title}>직접 기록</Text>
          <Text style={styles.caption}>내 연속 기록용이며 공식 인증이나 리그 점수가 아니에요.</Text>
        </View>
        <Button
          label={expanded ? '접기' : '입력'}
          onPress={() => setExpanded((current) => !current)}
          tone="quiet"
        />
      </View>
      {expanded ? (
        <View style={styles.form}>
          <View accessibilityRole="tablist" style={styles.chips}>
            {kindLabels.map(([value, label]) => (
              <Chip
                key={value}
                accessibilityRole="tab"
                label={label}
                onPress={() => {
                  setKind(value);
                  setMessage('');
                }}
                selected={kind === value}
                tone={kind === value ? 'accent' : 'neutral'}
              />
            ))}
          </View>
          <TextInput
            accessibilityLabel="활동 시간 분"
            inputMode="numeric"
            keyboardType="number-pad"
            onChangeText={setDurationText}
            placeholder="시간(분)"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={durationText}
          />
          {kind === 'run' ? (
            <TextInput
              accessibilityLabel="러닝 거리 킬로미터 선택 입력"
              inputMode="decimal"
              keyboardType="decimal-pad"
              onChangeText={setDistanceText}
              placeholder="거리(km, 선택)"
              placeholderTextColor={palette.muted}
              style={styles.input}
              value={distanceText}
            />
          ) : null}
          <Button
            disabled={saving}
            label={saving ? '저장 중' : '기기 기록에 저장'}
            onPress={() => void save()}
            tone="secondary"
          />
          {message ? (
            <Text accessibilityLiveRegion="polite" style={styles.message}>
              {message}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  copy: { flex: 1, minWidth: 0 },
  title: {
    color: palette.ink,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.heavy,
  },
  caption: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    marginTop: spacing.xxs,
  },
  form: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  input: {
    minHeight: layout.touchTarget,
    borderColor: palette.line,
    borderWidth: borderWidth.thin,
    borderRadius: radius.md,
    color: palette.ink,
    backgroundColor: palette.surface,
    fontSize: typeScale.body,
    paddingHorizontal: spacing.md,
  },
  message: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
});
