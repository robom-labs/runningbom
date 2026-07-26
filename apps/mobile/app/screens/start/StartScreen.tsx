// 러닝 유형과 시간을 고른 뒤 옆에서 계속 말해 주는 기기 TTS 코칭을 시작하는 화면입니다.
import Slider from '@react-native-community/slider';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Chip, Wordmark } from '../../design-system/components';
import { palette, radius, spacing, typeScale } from '../../design-system/theme';
import { useAppState } from '../../state/AppStateProvider';
import {
  createCoachSession,
  currentPhase,
  cueDensityPerMinute,
  guidanceDescriptions,
  guidanceLabels,
  isCoachSessionKind,
  nextPhase,
  recentCues,
  resolveRunningType,
  runningTypeCategories,
  runningTypesByCategory,
  type CoachSessionKind,
  type GuidanceLevel,
  type RunningTypeCategory,
} from '../../../domains/coaching/model';
import {
  voiceGenderLabels,
  type VoiceGender,
} from '../../../domains/coaching/voice';
import {
  defaultCoachVoicePreference,
  loadCoachVoicePreference,
  saveCoachVoicePreference,
} from '../../../domains/coaching/voicePreference';
import {
  coachVoiceStatus,
  getCoachState,
  nativeCoachAvailable,
  pauseCoachSession,
  previewCoachVoice,
  resumeCoachSession,
  startCoachSession,
  stopCoachSession,
  type CoachRuntimeState,
} from '../../../services/audio/coachService';
import { coachCompletionRecord } from '../../../domains/coaching/runtime';

const guidanceOptions: GuidanceLevel[] = ['minimal', 'standard', 'detailed'];
const voiceGenders: VoiceGender[] = ['female', 'male'];

function validKind(value: string): CoachSessionKind {
  return isCoachSessionKind(value) ? value : '이지런';
}

function formatElapsed(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60).toString().padStart(2, '0');
  const remainder = Math.floor(safe % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function StartScreen() {
  const { preferences, updatePreferences, completeActivity } = useAppState();
  const [minutes, setMinutes] = useState(preferences.coachMinutes);
  const [kind, setKind] = useState<CoachSessionKind>(validKind(preferences.coachType));
  const [directInput, setDirectInput] = useState(String(preferences.coachMinutes));
  const [inputError, setInputError] = useState('');
  const [showKinds, setShowKinds] = useState(false);
  const [category, setCategory] = useState<RunningTypeCategory>('기본');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [voiceGender, setVoiceGender] = useState<VoiceGender>(
    defaultCoachVoicePreference.gender,
  );
  const [voiceNotice, setVoiceNotice] = useState('');
  const [runtime, setRuntime] = useState<CoachRuntimeState>({
    state: 'idle',
    elapsedSeconds: 0,
    durationSeconds: 0,
    native: nativeCoachAvailable(),
  });
  const [completionSaved, setCompletionSaved] = useState(false);
  const completionInFlightRef = useRef<string | null>(null);

  const type = useMemo(() => resolveRunningType(kind), [kind]);
  const session = useMemo(
    () => createCoachSession(kind, minutes, preferences.coachGuidance),
    [kind, minutes, preferences.coachGuidance],
  );
  const active = runtime.state === 'running' || runtime.state === 'paused';

  const phase = active ? currentPhase(session, runtime.elapsedSeconds) : undefined;
  const upcoming = active ? nextPhase(session, runtime.elapsedSeconds) : undefined;
  const spoken = active ? recentCues(session, runtime.elapsedSeconds, 3) : [];

  useEffect(() => {
    let cancelled = false;
    void loadCoachVoicePreference().then((value) => {
      if (!cancelled) setVoiceGender(value.gender);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void coachVoiceStatus(voiceGender).then((status) => {
      if (!cancelled) setVoiceNotice(status.availability.notice ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [voiceGender]);

  const refreshRuntime = useCallback(async () => {
    try {
      const next = await getCoachState();
      setRuntime(next);

      if (
        (next.state === 'running' || next.state === 'paused') &&
        next.title &&
        next.durationSeconds > 0
      ) {
        const restoredMinutes = Math.max(1, Math.round(next.durationSeconds / 60));
        setKind(validKind(next.title));
        setMinutes(restoredMinutes);
        setDirectInput(String(restoredMinutes));
      }

      if (
        next.state === 'completed' &&
        next.sessionId &&
        completionInFlightRef.current !== next.sessionId
      ) {
        const completion = coachCompletionRecord(next);
        if (!completion) return;
        completionInFlightRef.current = next.sessionId;
        try {
          await completeActivity({
            ...completion,
            source: next.native ? 'COACH_COMPLETED' : 'SELF_LOGGED',
          });
          setCompletionSaved(true);
        } catch {
          completionInFlightRef.current = null;
          throw new Error('completed coach activity could not be stored');
        }
      }
    } catch {
      setRuntime((current) => ({ ...current, state: 'stopped' }));
    }
  }, [completeActivity]);

  useEffect(() => {
    void refreshRuntime();
  }, [refreshRuntime]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => void refreshRuntime(), 1_000);
    return () => clearInterval(timer);
  }, [active, refreshRuntime]);

  function applyDirectInput() {
    const value = Number(directInput);
    if (!Number.isInteger(value) || value < 10 || value > 120) {
      setInputError('10분부터 120분 사이의 정수를 입력해 주세요.');
      return;
    }
    setInputError('');
    setMinutes(value);
  }

  function chooseVoice(gender: VoiceGender) {
    setVoiceGender(gender);
    void saveCoachVoicePreference({ gender });
  }

  async function begin() {
    setCompletionSaved(false);
    completionInFlightRef.current = null;
    await updatePreferences({ coachMinutes: minutes, coachType: kind });
    try {
      setRuntime(await startCoachSession(session, preferences.speechRate, voiceGender));
    } catch {
      Alert.alert(
        '음성 코치를 시작하지 못했어요',
        '세션을 시작하지 못했어요. 기기의 한국어 음성 설정을 확인한 뒤 다시 시도해 주세요.',
      );
    }
  }

  function stopFallback() {
    if (runtime.native) return;
    Alert.alert('세션을 종료할까요?', '예정 시간 전에 끝내면 완주 기록으로 저장하지 않아요.', [
      { text: '계속', style: 'cancel' },
      {
        text: '종료',
        style: 'destructive',
        onPress: () => {
          void stopCoachSession().then(setRuntime);
        },
      },
    ]);
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Wordmark compact />
          <Text style={styles.heading}>오늘 얼마나 움직일까요?</Text>

          <Card style={styles.timeCard}>
            <Text accessibilityLiveRegion="polite" style={styles.minutes}>{minutes}분</Text>
            <Slider
              accessibilityLabel="코칭 시간"
              maximumTrackTintColor={palette.line}
              maximumValue={120}
              minimumTrackTintColor={palette.accent}
              minimumValue={10}
              onValueChange={(value) => {
                const rounded = Math.round(value / 5) * 5;
                setMinutes(rounded);
                setDirectInput(String(rounded));
                setInputError('');
              }}
              step={5}
              thumbTintColor={palette.accent}
              value={minutes}
            />
            <View style={styles.rangeRow}>
              <Text style={styles.range}>10분</Text>
              <Text style={styles.range}>120분</Text>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                accessibilityLabel="코칭 시간 직접 입력"
                inputMode="numeric"
                maxLength={3}
                onChangeText={setDirectInput}
                onSubmitEditing={applyDirectInput}
                returnKeyType="done"
                style={styles.input}
                value={directInput}
              />
              <Button label="직접 입력" onPress={applyDirectInput} tone="secondary" />
            </View>
            {inputError ? <Text style={styles.error}>{inputError}</Text> : null}
            <Text style={styles.range}>
              추천 {type.defaultMinutes}분 · {type.minMinutes}~{type.maxMinutes}분 권장
            </Text>
          </Card>

          <Card style={styles.sessionCard}>
            <View style={styles.sessionRow}>
              <View style={styles.sessionCopy}>
                <Text style={styles.sessionTitle}>{kind}</Text>
                <Text style={styles.sessionSummary}>{session.summary}</Text>
              </View>
              <Button label="변경" onPress={() => setShowKinds(true)} tone="quiet" />
            </View>

            <View style={styles.chips}>
              <Chip label={type.category} tone="accent" />
              <Chip label={`RPE ${type.rpe.min}~${type.rpe.max}`} tone="warning" />
              <Chip label={guidanceLabels[preferences.coachGuidance]} />
              <Chip label={`${voiceGenderLabels[voiceGender]} 음성`} />
            </View>

            <View style={styles.criteria}>
              <Text style={styles.criteriaLabel}>강도</Text>
              <Text style={styles.criteriaValue}>{type.intensityLabel}</Text>
              <Text style={styles.criteriaLabel}>목적</Text>
              <Text style={styles.criteriaValue}>{type.purpose}</Text>
              <Text style={styles.criteriaLabel}>이런 분께</Text>
              {type.bestFor.map((line) => (
                <Text key={line} style={styles.criteriaValue}>· {line}</Text>
              ))}
              <Text style={styles.criteriaLabel}>이런 날은 다른 유형이 나아요</Text>
              {type.avoidIf.map((line) => (
                <Text key={line} style={styles.criteriaValue}>· {line}</Text>
              ))}
              <Text style={styles.criteriaLabel}>구성</Text>
              {type.structure.map((line) => (
                <Text key={line} style={styles.criteriaValue}>· {line}</Text>
              ))}
            </View>

            <Text style={styles.sessionMeta}>
              {guidanceDescriptions[preferences.coachGuidance]} · 분당 약{' '}
              {cueDensityPerMinute(session).toFixed(1)}개 안내 · 기기 한국어 음성
            </Text>

            <Button
              disabled={active}
              label={active ? '코칭 진행 중' : '러닝 시작'}
              onPress={() => void begin()}
              style={styles.primary}
            />
          </Card>

          {active || runtime.state === 'completed' ? (
            <Card style={styles.runtimeCard}>
              <Text style={styles.runtimeLabel}>
                {runtime.native ? '기기 백그라운드 코치' : '화면 안내 fallback'}
              </Text>
              <Text style={styles.runtimeTime}>
                {formatElapsed(runtime.elapsedSeconds)} / {formatElapsed(runtime.durationSeconds)}
              </Text>
              <Text style={styles.runtimeHelp}>
                남은 시간 {formatElapsed(Math.max(0, runtime.durationSeconds - runtime.elapsedSeconds))}
              </Text>

              {phase ? (
                <View style={styles.phaseBox}>
                  <Text style={styles.phaseLabel}>현재 구간</Text>
                  <Text style={styles.phaseValue}>{phase.label}</Text>
                  <Text style={styles.phaseNext}>
                    {upcoming
                      ? `다음 구간 "${upcoming.label}"까지 ${formatElapsed(upcoming.startSeconds - runtime.elapsedSeconds)}`
                      : '마지막 구간이에요'}
                  </Text>
                </View>
              ) : null}

              {spoken.length > 0 ? (
                <View style={styles.phaseBox}>
                  <Text style={styles.phaseLabel}>코치 멘트</Text>
                  {spoken.map((cue, index) => (
                    <Text
                      key={`${cue.offsetSeconds}-${index}`}
                      style={[styles.cueLine, index === 0 && styles.cueLineLatest]}
                    >
                      {formatElapsed(cue.offsetSeconds)} · {cue.text}
                    </Text>
                  ))}
                </View>
              ) : null}

              <Text style={styles.runtimeHelp}>
                {runtime.native
                  ? '화면을 잠가도 알림의 일시정지·재생·종료로 조작할 수 있어요.'
                  : '이 기기에서는 화면이 열린 동안 시간만 계산해요. 완료 기록은 직접 입력 등급이며 공개 리그 점수에는 쓰지 않아요.'}
              </Text>
              {runtime.state === 'completed' ? (
                <Chip label={completionSaved ? '활동 기록 완료' : '완료 확인 중'} tone="positive" />
              ) : (
                <View style={styles.runtimeActions}>
                  <Button
                    label={runtime.state === 'paused' ? '계속' : '일시정지'}
                    onPress={() =>
                      void (runtime.state === 'paused' ? resumeCoachSession() : pauseCoachSession())
                        .then(setRuntime)
                    }
                    tone="secondary"
                    style={styles.action}
                  />
                  <Button
                    label="종료"
                    onPress={() =>
                      runtime.native
                        ? void stopCoachSession().then(setRuntime)
                        : stopFallback()
                    }
                    tone="danger"
                    style={styles.action}
                  />
                </View>
              )}
            </Card>
          ) : null}

          <Button
            label={showAdvanced ? '세부 설정 접기' : '안내·음성 설정'}
            onPress={() => setShowAdvanced((value) => !value)}
            tone="quiet"
          />
          {showAdvanced ? (
            <Card style={styles.advanced}>
              <Text style={styles.advancedTitle}>안내 밀도</Text>
              <View style={styles.chips}>
                {guidanceOptions.map((value) => (
                  <Chip
                    key={value}
                    label={guidanceLabels[value]}
                    selected={preferences.coachGuidance === value}
                    onPress={() => void updatePreferences({ coachGuidance: value })}
                  />
                ))}
              </View>
              <Text style={styles.range}>
                {guidanceDescriptions[preferences.coachGuidance]}
              </Text>

              <Text style={styles.advancedTitle}>코치 음성</Text>
              <View style={styles.chips}>
                {voiceGenders.map((value) => (
                  <Chip
                    key={value}
                    label={voiceGenderLabels[value]}
                    selected={voiceGender === value}
                    onPress={() => chooseVoice(value)}
                  />
                ))}
              </View>
              <Button
                label="미리듣기"
                onPress={() => void previewCoachVoice(voiceGender, preferences.speechRate)}
                tone="secondary"
              />
              {voiceNotice ? <Text style={styles.notice}>{voiceNotice}</Text> : null}

              <Text style={styles.advancedTitle}>말하기 속도</Text>
              <Slider
                accessibilityLabel="말하기 속도"
                maximumTrackTintColor={palette.line}
                maximumValue={1.2}
                minimumTrackTintColor={palette.accent}
                minimumValue={0.7}
                onSlidingComplete={(value) => void updatePreferences({ speechRate: value })}
                step={0.1}
                thumbTintColor={palette.accent}
                value={preferences.speechRate}
              />
              <Text style={styles.range}>{preferences.speechRate.toFixed(1)}배</Text>
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        animationType="slide"
        onRequestClose={() => setShowKinds(false)}
        presentationStyle="pageSheet"
        visible={showKinds}
      >
        <SafeAreaView style={styles.modal}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.heading}>러닝 유형</Text>
            <Text style={styles.modalHelp}>
              목적에 따라 다섯 갈래로 정리했어요. 유형마다 안내 멘트가 완전히 달라요.
            </Text>
            <View style={styles.chips}>
              {runningTypeCategories.map((value) => (
                <Chip
                  key={value}
                  label={value}
                  selected={category === value}
                  onPress={() => setCategory(value)}
                />
              ))}
            </View>
            <View style={styles.kindList}>
              {runningTypesByCategory(category).map((value) => (
                <Pressable
                  key={value.id}
                  accessibilityRole="button"
                  onPress={() => {
                    setKind(value.title);
                    setShowKinds(false);
                  }}
                  style={[styles.kindItem, kind === value.title && styles.kindItemSelected]}
                >
                  <Text style={styles.kindTitle}>{value.title}</Text>
                  <Text style={styles.kindSummary}>{value.summary}</Text>
                  <Text style={styles.kindMeta}>
                    {value.intensityLabel} · RPE {value.rpe.min}~{value.rpe.max} · 추천{' '}
                    {value.defaultMinutes}분
                  </Text>
                </Pressable>
              ))}
            </View>
            <Button label="닫기" onPress={() => setShowKinds(false)} tone="quiet" />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: palette.canvas },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: spacing.md,
    paddingBottom: 112,
    gap: spacing.md,
  },
  heading: {
    color: palette.ink,
    fontSize: typeScale.display,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: spacing.md,
  },
  timeCard: { gap: spacing.md, marginTop: spacing.sm },
  minutes: {
    color: palette.ink,
    fontSize: 44,
    fontWeight: '900',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  range: { color: palette.muted, fontSize: typeScale.caption, fontWeight: '700' },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
    color: palette.ink,
    fontSize: typeScale.body,
    paddingHorizontal: spacing.md,
  },
  error: { color: palette.danger, fontSize: typeScale.bodySmall, lineHeight: 20 },
  sessionCard: { gap: spacing.md },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sessionCopy: { flex: 1, minWidth: 0 },
  sessionTitle: { color: palette.ink, fontSize: typeScale.title, fontWeight: '900' },
  sessionSummary: { color: palette.inkSoft, fontSize: typeScale.bodySmall, lineHeight: 20, marginTop: 4 },
  sessionMeta: { color: palette.muted, fontSize: typeScale.bodySmall },
  criteria: {
    gap: 2,
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  criteriaLabel: {
    color: palette.muted,
    fontSize: typeScale.caption,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  criteriaValue: { color: palette.ink, fontSize: typeScale.bodySmall, lineHeight: 20 },
  primary: { minHeight: 56 },
  runtimeCard: { gap: spacing.md, backgroundColor: palette.navy },
  runtimeLabel: { color: '#FFB596', fontSize: typeScale.caption, fontWeight: '900' },
  runtimeTime: {
    color: palette.white,
    fontSize: typeScale.display,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  runtimeHelp: { color: '#CCD5E3', fontSize: typeScale.bodySmall, lineHeight: 20 },
  phaseBox: {
    gap: 4,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  phaseLabel: { color: '#FFB596', fontSize: typeScale.caption, fontWeight: '900' },
  phaseValue: { color: palette.white, fontSize: typeScale.titleSmall, fontWeight: '900' },
  phaseNext: { color: '#CCD5E3', fontSize: typeScale.bodySmall, lineHeight: 20 },
  cueLine: { color: '#9FB0C7', fontSize: typeScale.bodySmall, lineHeight: 20 },
  cueLineLatest: { color: palette.white, fontWeight: '700' },
  runtimeActions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  advanced: { gap: spacing.md },
  advancedTitle: { color: palette.ink, fontSize: typeScale.bodySmall, fontWeight: '900' },
  notice: { color: palette.inkSoft, fontSize: typeScale.bodySmall, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  modal: { flex: 1, backgroundColor: palette.canvas },
  modalContent: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  modalHelp: { color: palette.muted, fontSize: typeScale.body, lineHeight: 24 },
  kindList: { gap: spacing.sm },
  kindItem: {
    gap: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: spacing.md,
  },
  kindItemSelected: { borderColor: palette.accent, backgroundColor: palette.surfaceWarm },
  kindTitle: { color: palette.ink, fontSize: typeScale.titleSmall, fontWeight: '900' },
  kindSummary: { color: palette.inkSoft, fontSize: typeScale.bodySmall, lineHeight: 20 },
  kindMeta: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 18 },
});
