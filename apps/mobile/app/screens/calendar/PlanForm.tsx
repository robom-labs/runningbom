// 예정된 러닝 일정을 등록하는 입력 카드입니다. 저장은 이 기기 안에서만 이뤄집니다.
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { parseRunPlan, type RunPlanValue } from '../../../domains/activities/plans';
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

const kindLabels: Array<[ActivityKind, string]> = [
  ['run', '러닝'],
  ['walk', '걷기'],
  ['recovery', '회복'],
];

type Props = {
  date: string;
  onSave: (value: RunPlanValue) => Promise<void>;
};

export function PlanForm({ date, onSave }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dateText, setDateText] = useState(date);
  const [kind, setKind] = useState<ActivityKind>('run');
  const [title, setTitle] = useState('');
  const [minutesText, setMinutesText] = useState('');
  const [distanceText, setDistanceText] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  function open() {
    setDateText(date);
    setExpanded((current) => !current);
    setMessage('');
  }

  async function save() {
    const result = parseRunPlan({ date: dateText, kind, title, minutesText, distanceText });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setSaving(true);
    try {
      await onSave(result.value);
      setMessage('러닝 일정을 등록했어요. 달력에 점선으로 표시됩니다.');
      setTitle('');
      setMinutesText('');
      setDistanceText('');
    } catch {
      setMessage('일정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text style={styles.title}>러닝 일정 등록</Text>
          <Text style={styles.caption}>선택한 날짜에 예정 러닝을 미리 적어 둘 수 있어요.</Text>
        </View>
        <Button label={expanded ? '접기' : '등록'} onPress={open} tone="quiet" />
      </View>
      {expanded ? (
        <View style={styles.form}>
          <TextInput
            accessibilityLabel="일정 날짜"
            autoCapitalize="none"
            inputMode="numeric"
            maxLength={10}
            onChangeText={setDateText}
            placeholder="2026-08-01"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={dateText}
          />
          <View accessibilityRole="tablist" style={styles.chips}>
            {kindLabels.map(([value, label]) => (
              <Chip
                accessibilityRole="tab"
                key={value}
                label={label}
                onPress={() => setKind(value)}
                selected={kind === value}
                tone={kind === value ? 'accent' : 'neutral'}
              />
            ))}
          </View>
          <TextInput
            accessibilityLabel="일정 이름"
            maxLength={40}
            onChangeText={setTitle}
            placeholder="예: 아침 5K 가볍게"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={title}
          />
          <TextInput
            accessibilityLabel="예정 시간 분 선택 입력"
            inputMode="numeric"
            keyboardType="number-pad"
            onChangeText={setMinutesText}
            placeholder="예정 시간(분, 선택)"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={minutesText}
          />
          <TextInput
            accessibilityLabel="예정 거리 킬로미터 선택 입력"
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setDistanceText}
            placeholder="예정 거리(km, 선택)"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={distanceText}
          />
          <Button
            disabled={saving}
            label={saving ? '저장 중' : '일정 저장'}
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
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
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
    backgroundColor: palette.surface,
    color: palette.ink,
    fontSize: typeScale.body,
    paddingHorizontal: spacing.md,
  },
  message: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
});
