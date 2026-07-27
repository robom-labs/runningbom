// 처음 앱을 연 사람이 몇 번만 눌러도 알림·거리 재기·배터리 설정을 켜고 바로 달리러 나가게 하는 온보딩입니다.
// 순서: 소개 → 목표 → 음성 → 로그인 자리 → 알림 → 위치(Preview) → 배터리 → 완료.
// 시스템 창은 언제나 사전 설명 화면 "다음"에만 뜹니다. 거절해도 흐름은 절대 막히지 않습니다.
// 상태 저장은 AppStateProvider의 completeOnboarding이 맡고, 이 화면은 선택만 모읍니다.
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Chip, StepDots, Wordmark } from '../../design-system/components';
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
  PermissionPrimingView,
  onboardingDoneCopy,
  onboardingLoginCopy,
  permissionPriming,
  permissionStatusLabel,
  permissionStatusTone,
  usePermissionLedger,
  type PermissionAction,
  type PermissionKey,
  type PermissionOutcome,
} from '../../permissions';
import { countRaces } from '../../../domains/races/aggregate';
import { shoeCatalog } from '../../../domains/shoes/catalog';
import { voiceGenderLabels, type VoiceGender } from '../../../domains/coaching/voice';
import { useAppState } from '../../state/AppStateProvider';
import { useRaceState } from '../../state/RaceStateProvider';
import {
  buildOnboardingSteps,
  checkNickname,
  coachSentenceTotal,
  defaultGoalPresetId,
  goalPresets,
  introHighlights,
  isLastOnboardingStep,
  isPermissionStep,
  nextOnboardingStep,
  onboardingStepIndex,
  onboardingStepSubtitles,
  onboardingStepTitles,
  permissionStepIds,
  previousOnboardingStep,
  voiceChoiceNote,
  type GoalPresetId,
  type OnboardingStepId,
  type PermissionStepId,
} from './steps';

const voiceGenders: VoiceGender[] = ['female', 'male'];

const voiceDescriptions: Record<VoiceGender, string> = {
  female: '기기에 설치된 한국어 여성 음성으로 안내해요.',
  male: '기기에 설치된 한국어 남성 음성으로 안내해요.',
};

export type OnboardingScreenProps = {
  /**
   * 로그인 단계 자리입니다.
   * 부모(app/navigation)가 app/screens/auth의 AuthScreen을 여기에 연결합니다.
   * 연결하지 않으면 "로그인 없이 계속" 안내 카드만 보여 주고 흐름은 그대로 이어집니다.
   */
  renderLoginStep?: (helpers: { onDone: () => void; onSkip: () => void }) => ReactNode;
};

export function OnboardingScreen({ renderLoginStep }: OnboardingScreenProps = {}) {
  const { completeOnboarding } = useAppState();
  const { feed } = useRaceState();
  const { ledger, supported, actionFor, ask, postpone } = usePermissionLedger();
  const [step, setStep] = useState<OnboardingStepId>('intro');
  const [goalPresetId, setGoalPresetId] = useState<GoalPresetId>(defaultGoalPresetId);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [voiceGender, setVoiceGender] = useState<VoiceGender>('female');
  const [stepNotes, setStepNotes] = useState<Partial<Record<PermissionKey, string>>>({});
  const [busy, setBusy] = useState(false);

  // 위치는 Preview 빌드에서만, 배터리는 안드로이드에서만 단계로 넣습니다.
  const steps = useMemo(
    () =>
      buildOnboardingSteps({
        locationStep: supported.location,
        batteryStep: supported.battery,
      }),
    [supported.battery, supported.location],
  );

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
    if (isLastOnboardingStep(step, steps)) {
      finish(false);
      return;
    }
    const next = nextOnboardingStep(step, steps);
    if (next) setStep(next);
  }, [finish, nicknameDraft, step, steps]);

  // 어느 단계에서든 건너뛸 수 있습니다. 음성 단계를 지난 뒤라면 고른 값은 그대로 저장합니다.
  const skipAll = useCallback(() => {
    const passedVoice = onboardingStepIndex(step, steps) > onboardingStepIndex('voice', steps);
    finish(!passedVoice);
  }, [finish, step, steps]);

  const handleAllow = useCallback(
    async (key: PermissionStepId) => {
      if (busy) return;
      setBusy(true);
      try {
        const result = await ask(key);

        if (result.action === 'done' || result.action === 'unavailable') {
          goNext();
          return;
        }

        if (result.action === 'ask') {
          // 켜졌으면 바로 다음으로. 거절했으면 이 화면에 남아 정직한 안내를 보여 주고,
          // 보조 버튼이 "다음"으로 바뀌어 언제든 계속 갈 수 있습니다.
          if (result.outcome === 'granted' || result.outcome === 'unknown') goNext();
          return;
        }

        if (result.action === 'open-battery-settings') {
          setStepNotes((notes) => ({
            ...notes,
            battery:
              result.opened === 'battery-list'
                ? '배터리 목록을 열었어요. 러닝봄을 찾아 제한 없음을 고르고 돌아와 주세요.'
                : result.opened === 'app-settings'
                  ? '이 기기에는 배터리 목록이 없어서 러닝봄 앱 설정을 열었어요. 배터리 항목을 찾아 주세요.'
                  : '설정을 열지 못했어요. 휴대폰 설정 > 배터리에서 러닝봄을 찾아 주세요.',
          }));
          return;
        }

        setStepNotes((notes) => ({
          ...notes,
          [key]:
            result.opened === 'app-settings'
              ? '러닝봄 설정을 열었어요. 켜고 돌아오면 이 화면에 바로 반영돼요.'
              : '설정을 열지 못했어요. 휴대폰 설정 > 앱 > 러닝봄에서 바꿔 주세요.',
        }));
      } finally {
        setBusy(false);
      }
    },
    [ask, busy, goNext],
  );

  const handleLater = useCallback(
    async (key: PermissionStepId) => {
      await postpone(key);
      goNext();
    },
    [goNext, postpone],
  );

  const previous = previousOnboardingStep(step, steps);
  const index = onboardingStepIndex(step, steps);
  const permissionStep = isPermissionStep(step) ? step : undefined;
  const stepNote = permissionStep ? stepNotes[permissionStep] : undefined;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <View style={styles.header}>
        <Wordmark compact />
        <Pressable
          accessibilityHint="남은 안내를 모두 건너뛰고 홈으로 이동해요"
          accessibilityLabel="건너뛰기"
          accessibilityRole="button"
          onPress={skipAll}
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
        {permissionStep ? (
          <PermissionPrimingView
            action={actionFor(permissionStep)}
            copy={permissionPriming[permissionStep]}
            outcome={ledger[permissionStep].outcome}
            {...(stepNote ? { note: stepNote } : {})}
          />
        ) : (
          <>
            <Text accessibilityRole="header" style={styles.title}>
              {onboardingStepTitles[step]}
            </Text>
            <Text style={styles.subtitle}>{onboardingStepSubtitles[step]}</Text>
          </>
        )}

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

        {step === 'login' ? (
          <View style={styles.loginSlot} testID="onboarding-login-slot">
            {renderLoginStep ? (
              renderLoginStep({ onDone: goNext, onSkip: goNext })
            ) : (
              <Card style={styles.card} tone="muted">
                <Text style={styles.cardTitle}>{onboardingLoginCopy.honesty}</Text>
                <Text style={styles.cardBody}>
                  로그인 화면은 설정 &gt; 계정·데이터에서도 열 수 있어요. 아래 &ldquo;다음&rdquo;을
                  누르면 그대로 이어집니다.
                </Text>
              </Card>
            )}
          </View>
        ) : null}

        {step === 'done' ? (
          <Card style={styles.card}>
            {permissionStepIds
              .filter((key) => supported[key])
              .map((key) => (
                <View key={key} style={styles.doneRow}>
                  <Text style={styles.doneRowLabel}>{permissionPriming[key].shortName}</Text>
                  <Chip
                    label={permissionStatusLabel(key, ledger[key])}
                    tone={permissionStatusTone(ledger[key])}
                  />
                </View>
              ))}
            <Text style={styles.cardBody}>{onboardingDoneCopy.settingsHint}</Text>
          </Card>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <StepDots index={index} total={steps.length} />
        {permissionStep ? (
          <View style={styles.permissionActions}>
            <Button
              disabled={busy}
              label={allowLabelFor(permissionStep, actionFor(permissionStep))}
              onPress={() => void handleAllow(permissionStep)}
              size="lg"
              testID="onboarding-permission-allow"
            />
            <Button
              label={laterLabelFor(permissionStep, ledger[permissionStep].outcome)}
              onPress={() => void handleLater(permissionStep)}
              testID="onboarding-permission-later"
              tone="quiet"
            />
          </View>
        ) : (
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
              label={isLastOnboardingStep(step, steps) ? '러닝봄 시작하기' : '다음'}
              onPress={goNext}
              size="lg"
              style={styles.nextButton}
              testID="onboarding-next"
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

/** 사전 설명 화면의 주 버튼 글자입니다. 두 번 거절한 뒤에는 설정 화면으로 보냅니다. */
function allowLabelFor(step: PermissionStepId, action: PermissionAction): string {
  const copy = permissionPriming[step];
  if (action === 'open-app-settings') return copy.settingsLabel;
  if (action === 'done' || action === 'unavailable') return '다음';
  return copy.allowLabel;
}

/** 보조 버튼 글자입니다. 이미 한 번 대답한 뒤에는 "다음"으로 바꿔 막다른 길을 만들지 않습니다. */
function laterLabelFor(step: PermissionStepId, outcome: PermissionOutcome): string {
  return outcome === 'unknown' ? permissionPriming[step].laterLabel : '다음';
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
  loginSlot: { gap: spacing.sm },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 40 },
  doneRowLabel: {
    flex: 1,
    minWidth: 0,
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.bold,
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
  permissionActions: { gap: spacing.xs },
  backButton: { minWidth: 88 },
  nextButton: { flex: 1 },
  pressed: { opacity: pressedOpacity },
});
