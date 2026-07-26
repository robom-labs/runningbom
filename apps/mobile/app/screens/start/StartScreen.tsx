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
  phaseGroups,
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
import { withTrackedDistance } from '../../../domains/activities/pace';
import type { ActivitySplit } from '../../../domains/activities/types';
import {
  fastestSplitIndex,
  formatDistanceKm,
  formatPace,
  gpsUnavailableNotice,
  routePointSummary,
  splitDistanceKm,
  splitLabel,
  splitPaceSecondsPerKm,
  spokenDistanceKm,
  spokenPace,
  spokenSplit,
  useRunTracking,
  type TrackedActivityExtras,
} from '../../../domains/tracking';
import { attachActivityTrack } from '../../../services/storage/localDatabase';

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

/** 구간 목록은 최근 구간이 위로 오게 뒤집어 보여 줍니다. */
const VISIBLE_SPLIT_COUNT = 6;

/** 완료 화면에 남길 이번 세션의 구간·경로 요약입니다. */
type CompletionTrack = {
  splits: ActivitySplit[];
  routePointCount: number;
  /** 기기 저장소에 실제로 붙었는지. 실패해도 기록 자체는 저장돼 있습니다. */
  stored: boolean;
};

/** 스크린리더가 "12:30"을 숫자로 읽지 않도록 사람이 말하듯 풀어 줍니다. */
function spokenDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  if (minutes === 0) return `${remainder}초`;
  if (remainder === 0) return `${minutes}분`;
  return `${minutes}분 ${remainder}초`;
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
  const [completionTrack, setCompletionTrack] = useState<CompletionTrack>();
  const completionInFlightRef = useRef<string | null>(null);

  const type = useMemo(() => resolveRunningType(kind), [kind]);
  const session = useMemo(
    () => createCoachSession(kind, minutes, preferences.coachGuidance),
    [kind, minutes, preferences.coachGuidance],
  );
  const active = runtime.state === 'running' || runtime.state === 'paused';

  // GPS 추적은 Preview 빌드에서만 켜지며, 권한을 거부해도 코칭은 그대로 진행됩니다.
  // 화면 꺼짐 방지는 "진행 중"일 때만 켜고, 일시정지하면 바로 풀립니다.
  const tracking = useRunTracking(active, runtime.state === 'running');
  const trackingExtrasRef = useRef<() => TrackedActivityExtras>(() => ({}));
  useEffect(() => {
    trackingExtrasRef.current = tracking.activityExtras;
  }, [tracking.activityExtras]);

  // 최근 구간이 위로 오도록 뒤집고, 진행 중 구간은 맨 위에 따로 얹습니다.
  const recentSplits = useMemo(
    () =>
      tracking.splits
        .map((split, index) => ({ split, index }))
        .reverse()
        .slice(0, VISIBLE_SPLIT_COUNT),
    [tracking.splits],
  );
  const fastestIndex = useMemo(() => fastestSplitIndex(tracking.splits), [tracking.splits]);

  const phase = active ? currentPhase(session, runtime.elapsedSeconds) : undefined;
  const upcoming = active ? nextPhase(session, runtime.elapsedSeconds) : undefined;
  // 첫 줄은 크게 보여 줄 "지금 멘트", 나머지 셋은 최근 로그입니다.
  const spoken = active ? recentCues(session, runtime.elapsedSeconds, 4) : [];
  const latestCue = spoken[0];
  const cueHistory = spoken.slice(1);
  const remainingSeconds = Math.max(0, runtime.durationSeconds - runtime.elapsedSeconds);
  const progressRatio =
    runtime.durationSeconds > 0
      ? Math.max(0, Math.min(1, runtime.elapsedSeconds / runtime.durationSeconds))
      : 0;
  const progressPercent = Math.round(progressRatio * 100);
  const phaseRemainingSeconds = phase
    ? Math.max(0, phase.endSeconds - runtime.elapsedSeconds)
    : 0;

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
          // 측정된 거리가 있을 때만 기존 distanceKm 키에 덧붙입니다(기존 저장 키 변경 없음).
          const extras = trackingExtrasRef.current();
          const stored = await completeActivity(
            withTrackedDistance(
              {
                ...completion,
                source: next.native ? 'COACH_COMPLETED' : 'SELF_LOGGED',
              },
              extras.distanceKm,
            ),
          );
          setCompletionSaved(true);

          // 구간·경로는 활동이 저장된 뒤 선택 필드로만 덧붙입니다. 실패해도 기록은 남습니다.
          if (extras.splits || extras.routePoints) {
            const attached = await attachActivityTrack(stored.id, {
              ...(extras.splits === undefined ? {} : { splits: extras.splits }),
              ...(extras.routePoints === undefined ? {} : { routePoints: extras.routePoints }),
            });
            setCompletionTrack({
              splits: extras.splits ?? [],
              routePointCount: extras.routePoints?.length ?? 0,
              stored: attached,
            });
          }
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
    setCompletionTrack(undefined);
    completionInFlightRef.current = null;
    tracking.reset();
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

  // 오확인으로 러닝이 끊기지 않도록 종료는 항상 한 번 되묻습니다.
  function confirmStop() {
    Alert.alert(
      '세션을 종료할까요?',
      `${formatElapsed(runtime.elapsedSeconds)} 진행했어요. 예정 시간 전에 끝내면 완주 기록으로 저장하지 않아요.`,
      [
        { text: '계속 달리기', style: 'cancel' },
        {
          text: '종료',
          style: 'destructive',
          onPress: () => {
            void stopCoachSession().then(setRuntime);
          },
        },
      ],
    );
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

            {/* 시작 전에도 GPS가 어떤 상태인지(빌드·권한·신호) 먼저 알려 줍니다. */}
            {!active && tracking.notice ? (
              <View
                accessibilityLiveRegion="polite"
                style={[
                  styles.preNotice,
                  tracking.notice.tone === 'warning' && styles.preNoticeWarning,
                ]}
              >
                <Text style={styles.preNoticeTitle}>{tracking.notice.title}</Text>
                <Text style={styles.preNoticeBody}>{tracking.notice.body}</Text>
                {tracking.notice.action ? (
                  <Text style={styles.preNoticeAction}>{tracking.notice.action}</Text>
                ) : null}
              </View>
            ) : null}
          </Card>

          {active || runtime.state === 'completed' ? (
            <Card accessibilityLabel="러닝 진행 화면" style={styles.runtimeCard}>
              <View style={styles.runtimeHeader}>
                <Text style={styles.runtimeLabel}>
                  {runtime.native ? '기기 백그라운드 코치' : '화면 안내 fallback'}
                </Text>
                <Text style={styles.runtimeState}>
                  {runtime.state === 'paused'
                    ? '일시정지'
                    : runtime.state === 'completed'
                      ? '완료'
                      : '진행 중'}
                </Text>
              </View>

              <Text
                accessibilityLabel={`경과 ${spokenDuration(runtime.elapsedSeconds)}`}
                style={styles.runtimeTime}
              >
                {formatElapsed(runtime.elapsedSeconds)}
              </Text>
              <View style={styles.timeRow}>
                <Text
                  accessibilityLabel={`남은 시간 ${spokenDuration(remainingSeconds)}`}
                  style={styles.runtimeRemain}
                >
                  남은 {formatElapsed(remainingSeconds)}
                </Text>
                <Text style={styles.runtimeTotal}>전체 {minutes}분</Text>
              </View>

              <View
                accessibilityLabel={`진행률 ${progressPercent}퍼센트`}
                accessibilityRole="progressbar"
                style={styles.progressTrack}
              >
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>
              <Text style={styles.progressCaption}>{progressPercent}% 진행</Text>

              {tracking.supported ? (
                <View accessibilityLabel="GPS 거리와 페이스" style={styles.trackingBox}>
                  <View style={styles.trackingHeader}>
                    <Text style={styles.phaseLabel}>GPS 거리·페이스</Text>
                    <Text style={styles.trackingSignal}>{tracking.snapshot.statusLabel}</Text>
                  </View>
                  <View style={styles.trackingRow}>
                    <View style={styles.trackingMetric}>
                      <Text style={styles.trackingLabel}>거리</Text>
                      <Text
                        accessibilityLabel={
                          tracking.snapshot.measuring
                            ? `거리 ${spokenDistanceKm(tracking.snapshot.distanceMeters)}`
                            : '거리 측정 안 함'
                        }
                        style={styles.trackingValue}
                      >
                        {tracking.snapshot.measuring
                          ? formatDistanceKm(tracking.snapshot.distanceMeters)
                          : '--'}
                      </Text>
                      <Text style={styles.trackingUnit}>km</Text>
                    </View>
                    <View style={styles.trackingMetric}>
                      <Text style={styles.trackingLabel}>현재 페이스</Text>
                      <Text
                        accessibilityLabel={`현재 페이스 ${spokenPace(tracking.snapshot.currentPaceSecondsPerKm)}`}
                        style={styles.trackingValue}
                      >
                        {tracking.snapshot.measuring
                          ? formatPace(tracking.snapshot.currentPaceSecondsPerKm)
                          : `--'--"`}
                      </Text>
                      <Text style={styles.trackingUnit}>/km</Text>
                    </View>
                    <View style={styles.trackingMetric}>
                      <Text style={styles.trackingLabel}>평균 페이스</Text>
                      <Text
                        accessibilityLabel={`평균 페이스 ${spokenPace(tracking.snapshot.averagePaceSecondsPerKm)}`}
                        style={styles.trackingValue}
                      >
                        {tracking.snapshot.measuring
                          ? formatPace(tracking.snapshot.averagePaceSecondsPerKm)
                          : `--'--"`}
                      </Text>
                      <Text style={styles.trackingUnit}>/km</Text>
                    </View>
                  </View>
                  <Text style={styles.trackingNote}>{tracking.snapshot.statusDetail}</Text>
                  {tracking.snapshot.measuring ? (
                    <Text style={styles.trackingNote}>
                      {routePointSummary(tracking.routePointCount)} · 지도는 없고 좌표만 기기에
                      남겨요.
                    </Text>
                  ) : null}
                </View>
              ) : (
                <View style={styles.noticeBox}>
                  <Text style={styles.noticeTitle}>이 빌드는 시간 기반 코칭만 해요</Text>
                  <Text style={styles.trackingNote}>{gpsUnavailableNotice}</Text>
                </View>
              )}

              {tracking.supported && tracking.notice ? (
                <View
                  accessibilityLiveRegion="polite"
                  style={[
                    styles.noticeBox,
                    tracking.notice.tone === 'warning' && styles.noticeWarning,
                  ]}
                >
                  <Text style={styles.noticeTitle}>{tracking.notice.title}</Text>
                  <Text style={styles.trackingNote}>{tracking.notice.body}</Text>
                  {tracking.notice.action ? (
                    <Text style={styles.noticeAction}>{tracking.notice.action}</Text>
                  ) : null}
                </View>
              ) : null}

              {tracking.supported && tracking.snapshot.measuring ? (
                <View style={styles.phaseBox}>
                  <Text style={styles.phaseLabel}>구간 기록 · 1km마다</Text>
                  {tracking.currentSplit ? (
                    <Text
                      accessibilityLabel={`지금 구간 ${spokenDuration(tracking.currentSplit.seconds)} 진행 중`}
                      style={styles.splitCurrent}
                    >
                      지금 구간 · {formatElapsed(tracking.currentSplit.seconds)} · 누적{' '}
                      {tracking.currentSplit.km.toFixed(2)}km
                    </Text>
                  ) : null}
                  {recentSplits.length > 0 ? (
                    recentSplits.map(({ split, index }) => (
                      <Text
                        accessibilityLabel={spokenSplit(tracking.splits, index)}
                        key={`split-${index}-${split.km}`}
                        style={styles.cueLine}
                      >
                        {splitLabel(tracking.splits, index)} · {formatElapsed(split.seconds)} ·{' '}
                        {formatPace(splitPaceSecondsPerKm(tracking.splits, index))}/km
                        {index === fastestIndex ? ' · 가장 빠른 구간' : ''}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.cueLine}>
                      아직 확정된 구간이 없어요. 1km를 지날 때마다 하나씩 쌓여요.
                    </Text>
                  )}
                  {tracking.splits.length > VISIBLE_SPLIT_COUNT ? (
                    <Text style={styles.cueLine}>
                      앞선 {tracking.splits.length - VISIBLE_SPLIT_COUNT}개 구간은 완료 요약에서
                      볼 수 있어요.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {phase ? (
                <View style={styles.phaseBox}>
                  <Text style={styles.phaseLabel}>현재 구간</Text>
                  <Text style={styles.phaseValue}>
                    {phaseGroups[phase.kind]} · {phase.label}
                  </Text>
                  <Text style={styles.phaseNext}>
                    {upcoming
                      ? `${formatElapsed(Math.max(0, upcoming.startSeconds - runtime.elapsedSeconds))} 뒤 "${upcoming.label}" (${phaseGroups[upcoming.kind]})`
                      : `마지막 구간이에요 · ${formatElapsed(phaseRemainingSeconds)} 남음`}
                  </Text>
                </View>
              ) : null}

              <View accessibilityLiveRegion="polite" style={styles.cueBox}>
                <Text style={styles.phaseLabel}>지금 코치 멘트</Text>
                <Text style={styles.cueNow}>
                  {latestCue ? latestCue.text : '곧 첫 안내가 나와요.'}
                </Text>
                {tracking.distanceCueText ? (
                  <Text style={styles.cueDistance}>{tracking.distanceCueText}</Text>
                ) : null}
              </View>

              {cueHistory.length > 0 ? (
                <View style={styles.phaseBox}>
                  <Text style={styles.phaseLabel}>최근 안내</Text>
                  {cueHistory.map((cue, index) => (
                    <Text key={`${cue.offsetSeconds}-${index}`} style={styles.cueLine}>
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
              {tracking.screenAwakeNotice ? (
                <Text accessibilityLiveRegion="polite" style={styles.runtimeHelp}>
                  {tracking.screenAwakeNotice}
                </Text>
              ) : null}
              {runtime.state === 'completed' ? (
                <View style={styles.completionBox}>
                  <View style={styles.chips}>
                    <Chip
                      label={completionSaved ? '활동 기록 완료' : '완료 확인 중'}
                      tone="positive"
                    />
                  </View>
                  {completionTrack ? (
                    <View style={styles.phaseBox}>
                      <Text style={styles.phaseLabel}>이번 러닝 구간 요약</Text>
                      {completionTrack.splits.length > 0 ? (
                        completionTrack.splits.map((split, index) => (
                          <Text
                            accessibilityLabel={spokenSplit(completionTrack.splits, index)}
                            key={`done-split-${index}-${split.km}`}
                            style={styles.cueLine}
                          >
                            {splitLabel(completionTrack.splits, index)} ·{' '}
                            {formatElapsed(split.seconds)} ·{' '}
                            {formatPace(splitPaceSecondsPerKm(completionTrack.splits, index))}/km
                            {splitDistanceKm(completionTrack.splits, index) < 0.99
                              ? ' · 마지막 구간'
                              : ''}
                          </Text>
                        ))
                      ) : (
                        <Text style={styles.cueLine}>
                          1km를 채우지 못해 구간 기록은 남기지 않았어요.
                        </Text>
                      )}
                      <Text style={styles.cueLine}>
                        {routePointSummary(completionTrack.routePointCount)}
                        {completionTrack.stored
                          ? ' · 기기에만 저장돼요.'
                          : ' · 이번 실행 중에만 유지돼요.'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={styles.runtimeActions}>
                  <Button
                    accessibilityHint={
                      runtime.state === 'paused'
                        ? '멈춰 둔 코칭을 이어서 재생해요.'
                        : '코칭 음성과 시간을 잠시 멈춰요.'
                    }
                    label={runtime.state === 'paused' ? '재개' : '일시정지'}
                    onPress={() =>
                      void (runtime.state === 'paused' ? resumeCoachSession() : pauseCoachSession())
                        .then(setRuntime)
                    }
                    tone="secondary"
                    style={styles.action}
                  />
                  <Button
                    accessibilityHint="한 번 더 확인한 뒤 세션을 끝내요."
                    label="종료"
                    onPress={confirmStop}
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
  // 시작 전 안내(밝은 카드 위)입니다.
  preNotice: {
    gap: 2,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: palette.surfaceMuted,
    borderLeftWidth: 4,
    borderLeftColor: palette.line,
  },
  preNoticeWarning: { backgroundColor: palette.surfaceWarm, borderLeftColor: palette.accent },
  preNoticeTitle: { color: palette.ink, fontSize: typeScale.bodySmall, fontWeight: '900', lineHeight: 22 },
  preNoticeBody: { color: palette.inkSoft, fontSize: typeScale.bodySmall, lineHeight: 20 },
  preNoticeAction: { color: palette.accentDark, fontSize: typeScale.bodySmall, fontWeight: '800', lineHeight: 20 },
  runtimeCard: { gap: spacing.sm, backgroundColor: palette.navy },
  runtimeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // 남색 배경 위 대비를 위해 밝은 살구색·흰색 계열만 씁니다.
  runtimeLabel: { color: '#FFB596', fontSize: typeScale.caption, fontWeight: '900' },
  runtimeState: {
    color: palette.navy,
    backgroundColor: '#FFD9C6',
    fontSize: typeScale.caption,
    fontWeight: '900',
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  runtimeTime: {
    color: palette.white,
    fontSize: 64,
    lineHeight: 70,
    fontWeight: '900',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  runtimeRemain: {
    color: palette.white,
    fontSize: typeScale.titleSmall,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  runtimeTotal: { color: '#CCD5E3', fontSize: typeScale.bodySmall, fontWeight: '700' },
  progressTrack: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  progressFill: { height: 12, borderRadius: radius.pill, backgroundColor: palette.accent },
  progressCaption: { color: '#CCD5E3', fontSize: typeScale.caption, fontWeight: '700' },
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
  cueBox: {
    gap: spacing.xs,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderLeftWidth: 4,
    borderLeftColor: palette.accent,
  },
  cueNow: {
    color: palette.white,
    fontSize: typeScale.title,
    fontWeight: '800',
    lineHeight: 32,
  },
  cueDistance: { color: '#FFD9C6', fontSize: typeScale.bodySmall, fontWeight: '800', lineHeight: 20 },
  cueLine: { color: '#CCD5E3', fontSize: typeScale.bodySmall, lineHeight: 20 },
  trackingBox: {
    gap: spacing.xs,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  trackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  trackingSignal: {
    color: palette.navy,
    backgroundColor: '#FFD9C6',
    fontSize: typeScale.caption,
    fontWeight: '900',
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  trackingRow: { flexDirection: 'row', gap: spacing.xs },
  trackingMetric: { flex: 1, minWidth: 0 },
  trackingLabel: { color: '#CCD5E3', fontSize: typeScale.caption, fontWeight: '700' },
  trackingValue: {
    color: palette.white,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  trackingUnit: { color: '#CCD5E3', fontSize: typeScale.caption, fontWeight: '700' },
  trackingNote: { color: '#CCD5E3', fontSize: typeScale.bodySmall, lineHeight: 20 },
  // 빈 상태·오류 안내. 남색 카드 위에서도 읽히도록 밝은 계열만 씁니다.
  noticeBox: {
    gap: 4,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderLeftWidth: 4,
    borderLeftColor: '#FFD9C6',
  },
  noticeWarning: { borderLeftColor: palette.accent, backgroundColor: 'rgba(255,255,255,0.16)' },
  noticeTitle: { color: palette.white, fontSize: typeScale.bodySmall, fontWeight: '900', lineHeight: 22 },
  noticeAction: { color: '#FFD9C6', fontSize: typeScale.bodySmall, fontWeight: '800', lineHeight: 20 },
  splitCurrent: { color: palette.white, fontSize: typeScale.bodySmall, fontWeight: '900', lineHeight: 22 },
  completionBox: { gap: spacing.sm },
  runtimeActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  action: { flex: 1, minHeight: 56 },
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
