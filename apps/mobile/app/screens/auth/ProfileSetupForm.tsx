// 체험 로그인을 마친 뒤 딱 3가지만 물어보는 입력 화면입니다.
// 닉네임은 사용자가 직접 적습니다. 가짜 이름이나 가짜 메일 주소를 대신 지어 넣지 않습니다.
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
import { experienceLevels, type ExperienceLevel } from '../../../domains/badges/goals';
import {
  trialProfileExperienceLabel,
  trialProfileNicknameLabel,
  trialProfileSubmitLabel,
  trialProfileSubtitle,
  trialProfileTitle,
  trialProfileWeeklyLabel,
  trialWeeklySessionOptions,
  type TrialWeeklySessions,
} from '../../../domains/identity/trialLogin';

export type ProfileSetupValue = {
  nickname: string;
  experience?: ExperienceLevel;
  weeklySessions?: TrialWeeklySessions;
};

export type ProfileSetupFormProps = {
  onSubmit: (value: ProfileSetupValue) => void;
  onBack: () => void;
  /** 입력이 잘못됐을 때 규칙 함수가 돌려준 문구입니다. */
  message?: string;
};

export function ProfileSetupForm({ onSubmit, onBack, message }: ProfileSetupFormProps) {
  const [nickname, setNickname] = useState('');
  const [experience, setExperience] = useState<ExperienceLevel | undefined>(undefined);
  const [weeklySessions, setWeeklySessions] = useState<TrialWeeklySessions | undefined>(undefined);

  return (
    <Card style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        {trialProfileTitle}
      </Text>
      <Text style={styles.caption}>{trialProfileSubtitle}</Text>

      <Text style={styles.label}>{trialProfileNicknameLabel}</Text>
      <TextInput
        accessibilityLabel={trialProfileNicknameLabel}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setNickname}
        placeholder="예: 봄이"
        placeholderTextColor={palette.muted}
        style={styles.input}
        value={nickname}
      />

      <Text style={styles.label}>{trialProfileExperienceLabel}</Text>
      <View accessibilityRole="radiogroup" style={styles.chips}>
        {experienceLevels.map((level) => (
          <Chip
            accessibilityLabel={`러닝 경력 ${level}`}
            key={level}
            label={level}
            onPress={() => setExperience((current) => (current === level ? undefined : level))}
            selected={experience === level}
            tone="accent"
          />
        ))}
      </View>

      <Text style={styles.label}>{trialProfileWeeklyLabel}</Text>
      <View accessibilityRole="radiogroup" style={styles.chips}>
        {trialWeeklySessionOptions.map((count) => (
          <Chip
            accessibilityLabel={`이번 주 ${count}번 달리기`}
            key={count}
            label={`주 ${count}번`}
            onPress={() =>
              setWeeklySessions((current) => (current === count ? undefined : count))
            }
            selected={weeklySessions === count}
            tone="accent"
          />
        ))}
      </View>

      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      ) : null}

      <Button
        label={trialProfileSubmitLabel}
        onPress={() =>
          onSubmit({
            nickname,
            ...(experience ? { experience } : {}),
            ...(weeklySessions ? { weeklySessions } : {}),
          })
        }
        size="lg"
      />
      <Button label="뒤로" onPress={onBack} tone="quiet" />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
  },
  title: {
    color: palette.ink,
    fontSize: typeScale.title,
    lineHeight: lineHeight.title,
    fontWeight: fontWeight.heavy,
  },
  caption: {
    color: palette.muted,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  label: {
    color: palette.inkSoft,
    fontSize: typeScale.label,
    lineHeight: lineHeight.label,
    fontWeight: fontWeight.bold,
    marginTop: spacing.sm,
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  message: {
    color: palette.danger,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.medium,
    marginTop: spacing.xs,
  },
});
