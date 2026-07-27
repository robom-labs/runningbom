// 내가 직접 도전을 만드는 입력 카드입니다. 저장은 이 기기 안에서만 이뤄집니다.
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

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
import {
  defaultCustomInput,
  parseCustomChallenge,
} from '../../../domains/challenges/custom';
import {
  challengeMetricLabels,
  challengeMetricOrder,
  challengeMetricUnits,
  type Challenge,
  type ChallengeMetric,
} from '../../../domains/challenges/types';

export type ChallengeFormProps = {
  /** 성공하면 undefined, 저장할 수 없으면 이유를 돌려줍니다. */
  onCreate: (challenge: Challenge) => Promise<string | undefined>;
};

const metricHints: Record<ChallengeMetric, string> = {
  distance: '기간 동안 달린 거리를 모두 더해요.',
  sessions: '기간 동안 운동한 횟수를 세요.',
  minutes: '기간 동안 움직인 시간을 모두 더해요.',
  activeDays: '기간 동안 움직인 날의 수를 세요.',
};

export function ChallengeForm({ onCreate }: ChallengeFormProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(() => defaultCustomInput());
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  function toggle() {
    setInput(defaultCustomInput());
    setMessage('');
    setOpen((current) => !current);
  }

  async function save() {
    const parsed = parseCustomChallenge(input);
    if (!parsed.ok) {
      setMessage(parsed.message);
      return;
    }
    setSaving(true);
    try {
      const failure = await onCreate(parsed.value);
      if (failure) {
        setMessage(failure);
        return;
      }
      setMessage('내 도전을 만들었어요. 위쪽 "진행 중인 내 도전"에서 볼 수 있어요.');
      setInput(defaultCustomInput());
      setOpen(false);
    } catch {
      setMessage('도전을 저장하지 못했어요. 잠시 뒤에 다시 해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headCopy}>
          <Text accessibilityRole="header" style={styles.title}>
            내가 만드는 도전
          </Text>
          <Text style={styles.caption}>기간과 목표를 정하면 기록으로 알아서 세어 드려요.</Text>
        </View>
        <Button label={open ? '접기' : '만들기'} onPress={toggle} tone="quiet" />
      </View>

      {open ? (
        <View style={styles.form}>
          <Text style={styles.label}>도전 이름</Text>
          <TextInput
            accessibilityLabel="도전 이름"
            onChangeText={(title) => setInput((current) => ({ ...current, title }))}
            placeholder="예: 여름 100km"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={input.title}
          />

          <Text style={styles.label}>기간</Text>
          <View style={styles.dateRow}>
            <TextInput
              accessibilityLabel="시작하는 날"
              autoCapitalize="none"
              inputMode="numeric"
              onChangeText={(startDay) => setInput((current) => ({ ...current, startDay }))}
              placeholder="2026-08-01"
              placeholderTextColor={palette.muted}
              style={[styles.input, styles.dateInput]}
              value={input.startDay}
            />
            <Text style={styles.dateTilde}>~</Text>
            <TextInput
              accessibilityLabel="끝나는 날"
              autoCapitalize="none"
              inputMode="numeric"
              onChangeText={(endDay) => setInput((current) => ({ ...current, endDay }))}
              placeholder="2026-08-31"
              placeholderTextColor={palette.muted}
              style={[styles.input, styles.dateInput]}
              value={input.endDay}
            />
          </View>

          <Text style={styles.label}>무엇을 셀까요</Text>
          <View accessibilityRole="radiogroup" style={styles.chips}>
            {challengeMetricOrder.map((metric) => (
              <Chip
                accessibilityLabel={`${challengeMetricLabels[metric]}로 세기`}
                key={metric}
                label={challengeMetricLabels[metric]}
                onPress={() => setInput((current) => ({ ...current, metric }))}
                selected={input.metric === metric}
                tone="accent"
              />
            ))}
          </View>
          <Text style={styles.caption}>{metricHints[input.metric]}</Text>

          <Text style={styles.label}>목표 값 ({challengeMetricUnits[input.metric]})</Text>
          <TextInput
            accessibilityLabel="목표 값"
            inputMode="decimal"
            onChangeText={(targetText) => setInput((current) => ({ ...current, targetText }))}
            placeholder="예: 100"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={input.targetText}
          />

          <Button
            disabled={saving}
            label={saving ? '만드는 중이에요' : '이 도전 만들기'}
            onPress={() => {
              void save();
            }}
          />
        </View>
      ) : null}

      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  title: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
  },
  caption: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  form: {
    gap: spacing.xs,
  },
  label: {
    color: palette.inkSoft,
    fontSize: typeScale.label,
    lineHeight: lineHeight.label,
    fontWeight: fontWeight.bold,
    marginTop: spacing.xs,
  },
  input: {
    minHeight: layout.touchTarget,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    color: palette.ink,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    paddingHorizontal: spacing.sm,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dateInput: {
    flex: 1,
    minWidth: 0,
  },
  dateTilde: {
    color: palette.muted,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  message: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.medium,
  },
});
