// 처음 앱을 연 사람이 3화면 안에 러닝봄을 이해하고 바로 시작할 수 있게 하는 온보딩입니다.
// 상태 저장은 AppStateProvider의 completeOnboarding이 맡고, 이 화면은 선택만 모읍니다.
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, StepDots, Wordmark } from '../../design-system/components';
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
import { countRaces } from '../../../domains/races/aggregate';
import { shoeCatalog } from '../../../domains/shoes/catalog';
import { voiceGenderLabels, type VoiceGender } from '../../../domains/coaching/voice';
import { useAppState } from '../../state/AppStateProvider';
import { useRaceState } from '../../state/RaceStateProvider';
import {
  checkNickname,
  coachSentenceTotal,
  defaultGoalPresetId,
  goalPresets,
  introHighlights,
  isLastOnboardingStep,
  nextOnboardingStep,
  onboardingStepCount,
  onboardingStepIndex,
  onboardingStepSubtitles,
  onboardingStepTitles,
  previousOnboardingStep,
  voiceChoiceNote,
  type GoalPresetId,
  type OnboardingStepId,
} from './steps';

const voiceGenders: VoiceGender[] = ['female', 'male'];

const voiceDescriptions: Record<VoiceGender, string> = {
  female: '기기에 설치된 한국어 여성 음성으로 안내해요.',
  male: '기기에 설치된 한국어 남성 음성으로 안내해요.',
};

export function OnboardingScreen() {
  const { completeOnboarding } = useAppState();
  const { feed } = useRaceState();
  const [step, setStep] = useState<OnboardingStepId>('intro');
  const [goalPresetId, setGoalPresetId] = useState<GoalPresetId>(defaultGoalPresetId);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [voiceGender, setVoiceGender] = useState<VoiceGender>('female');

  const highlights = useMemo(
    () =>
      introHighlights({
        coachSentences: coachSentenceTotal(),
        shoes: shoeCatalog.length,
        races: countRaces(feed.races),
      }),
    [feed.races],
  );

  const finish = useCallback(
    (skipped: boolean) => {
      if (skipped) {
        void completeOnboarding({ skipped: true });
        return;
      }
      const nickname = checkNickname(nicknameDraft);
      if (!nickname.ok) {
        setStep('goal');
        setNicknameError(nickname.message);
        return;
      }
      void completeOnboarding({
        skipped: false,
        goalPresetId,
        voiceGender,
        ...(nickname.value ? { nickname: nickname.value } : {}),
      });
    },
    [completeOnboarding, goalPresetId, nicknameDraft, voiceGender],
  );

  const goNext = useCallback(() => {
    if (step === 'goal') {
      const nickname = checkNickname(nicknameDraft);
      if (!nickname.ok) {
        setNicknameError(nickname.message);
        return;
      }
      setNicknameError('');
    }
    if (isLastOnboardingStep(step)) {
      finish(false);
      return;
    }
    const next = nextOnboardingStep(step);
    if (next) setStep(next);
  }, [finish, nicknameDraft, step]);

  const previous = previousOnboardingStep(step);
  const index = onboardingStepIndex(step);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <View style={styles.header}>
        <Wordmark compact />
        <Pressable
          accessibilityHint="소개를 건너뛰고 홈으로 이동해요"
          accessibilityLabel="건너뛰기"
          accessibilityRole="button"
          onPress={() => finish(true)}
          style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
          testID="onboarding-skip"
        >
          <Text style={styles.skipText}>건너뛰기</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <Text accessibilityRole="header" style={styles.title}>
          {onboardingStepTitles[step]}
        </Text>
        <Text style={styles.subtitle}>{onboardingStepSubtitles[step]}</Text>

        {step === 'intro'
          ? highlights.map((item) => (
              <Card key={item.id} style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBody}>{item.body}</Text>
              </Card>
            ))
          : null}

        {step === 'goal' ? (
          <>
            <View accessibilityRole="radiogroup" style={styles.options}>
              {goalPresets.map((preset) => (
                <OptionRow
                  key={preset.id}
                  selected={goalPresetId === preset.id}
                  label={preset.label}
                  description={preset.description}
                  onPress={() => setGoalPresetId(preset.id)}
                  testID={`onboarding-goal-${preset.id}`}
                />
              ))}
            </View>
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>닉네임 (선택)</Text>
              <Text style={styles.cardBody}>
                비워 두면 기본 닉네임을 그대로 써요. 이 기기에만 저장되고 자동으로 공개되지 않아요.
              </Text>
              <TextInput
                accessibilityLabel="닉네임 선택 입력"
                autoCapitalize="none"
                maxLength={16}
                onChangeText={(value) => {
                  setNicknameDraft(value);
                  setNicknameError('');
                }}
                placeholder="예: 아침러너"
                placeholderTextColor={palette.muted}
                style={styles.input}
                value={nicknameDraft}
              />
              {nicknameError ? (
                <Text accessibilityLiveRegion="polite" style={styles.error}>
                  {nicknameError}
                </Text>
              ) : null}
            </Card>
          </>
        ) : null}

        {step === 'voice' ? (
          <>
            <View accessibilityRole="radiogroup" style={styles.options}>
              {voiceGenders.map((gender) => (
                <OptionRow
                  key={gender}
                  selected={voiceGender === gender}
                  label={`${voiceGenderLabels[gender]} 음성`}
                  description={voiceDescriptions[gender]}
                  onPress={() => setVoiceGender(gender)}
                  testID={`onboarding-voice-${gender}`}
                />
              ))}
            </View>
            <Card style={styles.card} tone="warm">
              <Text style={styles.cardTitle}>{voiceChoiceNote}</Text>
              <Text style={styles.cardBody}>
                설정 &gt; 코치·음성에서 목소리와 말하기 속도, 안내 정도를 다시 고를 수 있어요. 기기에
                한국어 음성이 없으면 기본 음성으로 안내하고 그 사실을 화면에 알려 드려요.
              </Text>
            </Card>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <StepDots index={index} total={onboardingStepCount} />
        <View style={styles.footerActions}>
          {previous ? (
            <Button
              label="이전"
              onPress={() => setStep(previous)}
              style={styles.backButton}
              tone="quiet"
            />
          ) : null}
          <Button
            label={isLastOnboardingStep(step) ? '러닝봄 시작하기' : '다음'}
            onPress={goNext}
            size="lg"
            style={styles.nextButton}
            testID="onboarding-next"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

type OptionRowProps = {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

function OptionRow({ label, description, selected, onPress, testID }: OptionRowProps) {
  return (
    <Pressable
      accessibilityLabel={`${label}. ${description}`}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      <View style={styles.optionCopy}>
        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
        <Text style={styles.optionDescription}>{description}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: layout.gutter,
    paddingVertical: spacing.xs,
  },
  skip: {
    minHeight: layout.touchTarget,
    minWidth: 72,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  skipText: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.bold,
  },
  scroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: layout.screenMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    color: palette.ink,
    fontSize: typeScale.title,
    lineHeight: lineHeight.title,
    fontWeight: fontWeight.heavy,
    letterSpacing: -0.6,
  },
  subtitle: {
    color: palette.muted,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    marginBottom: spacing.xs,
  },
  card: { gap: spacing.xs },
  cardTitle: {
    color: palette.ink,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.heavy,
  },
  cardBody: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  options: { gap: spacing.xs },
  option: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: borderWidth.thin,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionSelected: {
    backgroundColor: palette.surfaceWarm,
    borderColor: palette.accentStrong,
    borderWidth: borderWidth.emphasis,
  },
  optionCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  optionLabel: {
    color: palette.ink,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.heavy,
  },
  optionLabelSelected: { color: palette.accentDark },
  optionDescription: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  radio: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.pill,
    borderColor: palette.line,
    borderWidth: borderWidth.emphasis,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: palette.accentStrong },
  radioDot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.accentStrong,
  },
  input: {
    minHeight: layout.touchTarget,
    borderColor: palette.line,
    borderWidth: borderWidth.thin,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    color: palette.ink,
    fontSize: typeScale.body,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xxs,
  },
  error: {
    color: palette.danger,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.semibold,
  },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: palette.canvas,
  },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backButton: { minWidth: 88 },
  nextButton: { flex: 1 },
  pressed: { opacity: pressedOpacity },
});
