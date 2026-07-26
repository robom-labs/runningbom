// 시간과 유형을 고른 뒤 기기 TTS 기반 백그라운드 코칭을 시작하는 화면입니다.
import Slider from '@react-native-community/slider';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  type CoachSessionKind,
  recommendedSessionKinds,
} from '../../../domains/coaching/model';
import {
  getCoachState,
  nativeCoachAvailable,
  pauseCoachSession,
  resumeCoachSession,
  startCoachSession,
  stopCoachSession,
  type CoachRuntimeState,
} from '../../../services/audio/coachService';
import { coachCompletionRecord } from '../../../domains/coaching/runtime';

const allSessionKinds: CoachSessionKind[] = [
  ...recommendedSessionKinds,
  '조금 빠르게',
  '인터벌',
  '러닝머신',
  '대회 전',
  '회복 루틴',
  '아침 깨우기',
  '걷기',
];

function validKind(value: string): CoachSessionKind {
  return allSessionKinds.includes(value as CoachSessionKind)
    ? (value as CoachSessionKind)
    : '편안한 지속주';
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function StartScreen() {
  const { preferences, updatePreferences, completeActivity } = useAppState();
  const [minutes, setMinutes] = useState(preferences.coachMinutes);
  const [kind, setKind] = useState<CoachSessionKind>(validKind(preferences.coachType));
  const [directInput, setDirectInput] = useState(String(preferences.coachMinutes));
  const [inputError, setInputError] = useState('');
  const [showKinds, setShowKinds] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [runtime, setRuntime] = useState<CoachRuntimeState>({
    state: 'idle',
    elapsedSeconds: 0,
    durationSeconds: 0,
    native: nativeCoachAvailable(),
  });
  const [completionSaved, setCompletionSaved] = useState(false);
  const completionInFlightRef = useRef<string | null>(null);

  const session = useMemo(
    () => createCoachSession(kind, minutes, preferences.coachGuidance),
    [kind, minutes, preferences.coachGuidance],
  );
  const active = runtime.state === 'running' || runtime.state === 'paused';

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

  async function begin() {
    setCompletionSaved(false);
    completionInFlightRef.current = null;
    await updatePreferences({ coachMinutes: minutes, coachType: kind });
    try {
      setRuntime(await startCoachSession(session, preferences.speechRate));
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
          </Card>

          <Card style={styles.sessionCard}>
            <View style={styles.sessionRow}>
              <View style={styles.sessionCopy}>
                <Text style={styles.sessionTitle}>{kind}</Text>
                <Text style={styles.sessionMeta}>
                  {preferences.coachGuidance === 'minimal'
                    ? '최소 안내'
                    : preferences.coachGuidance === 'detailed'
                      ? '자세한 안내'
                      : '기본 안내'}{' '}
                  · 기기 한국어 음성
                </Text>
              </View>
              <Button label="변경" onPress={() => setShowKinds(true)} tone="quiet" />
            </View>
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
            label={showAdvanced ? '세부 설정 접기' : '안내 세부 설정'}
            onPress={() => setShowAdvanced((value) => !value)}
            tone="quiet"
          />
          {showAdvanced ? (
            <Card style={styles.advanced}>
              <Text style={styles.advancedTitle}>안내량</Text>
              <View style={styles.chips}>
                {([
                  ['minimal', '최소'],
                  ['standard', '기본'],
                  ['detailed', '자세히'],
                ] as const).map(([value, label]) => (
                  <Chip
                    key={value}
                    label={label}
                    selected={preferences.coachGuidance === value}
                    onPress={() => void updatePreferences({ coachGuidance: value })}
                  />
                ))}
              </View>
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
            <Text style={styles.modalHelp}>처음에는 자주 쓰는 네 가지를 먼저 보여줘요.</Text>
            <View style={styles.kindList}>
              {allSessionKinds.map((value, index) => (
                <Button
                  key={value}
                  label={index < 4 ? value : `더 보기 · ${value}`}
                  onPress={() => {
                    setKind(value);
                    setShowKinds(false);
                  }}
                  tone={kind === value ? 'primary' : 'secondary'}
                />
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
  sessionCard: { gap: spacing.lg },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sessionCopy: { flex: 1, minWidth: 0 },
  sessionTitle: { color: palette.ink, fontSize: typeScale.title, fontWeight: '900' },
  sessionMeta: { color: palette.muted, fontSize: typeScale.bodySmall, marginTop: 4 },
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
  runtimeActions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  advanced: { gap: spacing.md },
  advancedTitle: { color: palette.ink, fontSize: typeScale.bodySmall, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  modal: { flex: 1, backgroundColor: palette.canvas },
  modalContent: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  modalHelp: { color: palette.muted, fontSize: typeScale.body, lineHeight: 24 },
  kindList: { gap: spacing.sm },
});
