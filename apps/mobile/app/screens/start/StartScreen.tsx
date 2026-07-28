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
  createCoachSessionForExtent,
  currentPhase,
  cueDensityPerMinute,
  extentLabel,
  mayMentionRemaining,
  quickMinutes,
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
  type SessionExtent,
} from '../../../domains/coaching/model';
import {
  MAX_COACH_MINUTES,
  MIN_COACH_MINUTES,
} from '../../../services/storage/preferences';
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
  prepareCoachAsideVoice,
  previewCoachVoice,
  resumeCoachSession,
  speakCoachAside,
  startCoachSession,
  stopCoachSession,
  type CoachRuntimeState,
} from '../../../services/audio/coachService';
import { coachCompletionRecord } from '../../../domains/coaching/runtime';
import { withTrackedDistance } from '../../../domains/activities/pace';
import {
  estimateCalories,
  speedIndependenceNote,
  weightMissingNotice,
} from '../../../domains/activities/calories';
import {
  injuryNotices,
  MAX_VISIBLE_INJURY_NOTICES,
  type InjuryNotice,
} from '../../../domains/activities/injuryGuard';
import {
  initialLiveStatsState,
  nextLiveStatsCue,
  type LiveStatsState,
} from '../../../domains/coaching/liveStats';
import type { ActivitySplit } from '../../../domains/activities/types';
import {
  autoPauseAnnouncements,
  autoPauseSpeedSummary,
  autoPauseTunings,
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
  useRunPreferences,
  useRunTracking,
  type TrackedActivityExtras,
} from '../../../domains/tracking';
import { attachActivityTrack } from '../../../services/storage/localDatabase';
import { parseWeightInput, weightRangeNotice } from '../../../services/storage/runPreferences';
import { setRunInProgress } from '../../../services/updates';
import { countdownHelpText, countdownStep } from './countdown';
import { shouldUseNightMode } from './nightMode';

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
  const { activities, preferences, updatePreferences, completeActivity } = useAppState();
  const runSettings = useRunPreferences();
  const [minutes, setMinutes] = useState(preferences.coachMinutes);
  const [kind, setKind] = useState<CoachSessionKind>(validKind(preferences.coachType));
  const [directInput, setDirectInput] = useState(String(preferences.coachMinutes));
  const [inputError, setInputError] = useState('');
  /** 끝을 정하지 않고 뛰는지입니다. 켜면 시간 대신 "끝낼 때까지"가 됩니다. */
  const [openEnded, setOpenEnded] = useState(preferences.coachOpenEnded === true);
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

  // 시작 카운트다운 · 자동 멈춤 · 지금 기록 안내 · 야간 모드
  const [countdownRemaining, setCountdownRemaining] = useState<number>();
  const countdownValueRef = useRef(0);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [autoPausedByApp, setAutoPausedByApp] = useState(false);
  const autoPausedByAppRef = useRef(false);
  const [autoPauseNotice, setAutoPauseNotice] = useState<string>();
  const [liveStatsText, setLiveStatsText] = useState<string>();
  const liveStatsRef = useRef<LiveStatsState>(initialLiveStatsState);
  const [night, setNight] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightError, setWeightError] = useState('');

  const type = useMemo(() => resolveRunningType(kind), [kind]);
  const extent = useMemo<SessionExtent>(
    () => (openEnded ? { type: 'open-ended' } : { type: 'fixed-time', seconds: minutes * 60 }),
    [openEnded, minutes],
  );
  const session = useMemo(
    () => createCoachSessionForExtent(kind, extent, preferences.coachGuidance),
    [kind, extent, preferences.coachGuidance],
  );
  /** 끝을 모르면 남은 시간·진행률을 화면에도 띄우지 않습니다. 코치만 입을 다무는 게 아닙니다. */
  const showsRemaining = mayMentionRemaining(extent);
  const active = runtime.state === 'running' || runtime.state === 'paused';

  // 달리는 동안에는 새 내용을 적용하지 않도록 알려 둡니다.
  // 적용은 앱을 다시 시작하는 일이라, 달리는 중에 하면 그날 기록이 사라집니다.
  useEffect(() => {
    setRunInProgress(active);
    return () => setRunInProgress(false);
  }, [active]);

  // GPS 추적은 Preview 빌드에서만 켜지며, 권한을 거부해도 코칭은 그대로 진행됩니다.
  // 화면 꺼짐 방지는 "진행 중"일 때 켜고, 스스로 멈춘 동안에도 유지합니다.
  // (화면이 꺼지면 위치를 못 받아 다시 달려도 알아채지 못하기 때문입니다.)
  const tracking = useRunTracking(
    active,
    runtime.state === 'running' || autoPausedByApp,
    { autoPauseLevel: runSettings.preferences.autoPause },
  );
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

  // 야간 모드는 달리는 화면에만 적용합니다. 자동일 때는 1분마다 해가 졌는지 다시 봅니다.
  const nightSetting = runSettings.preferences.nightMode;
  useEffect(() => {
    const apply = () => setNight(shouldUseNightMode(nightSetting));
    apply();
    const timer = setInterval(apply, 60_000);
    return () => clearInterval(timer);
  }, [nightSetting]);

  useEffect(() => {
    autoPausedByAppRef.current = autoPausedByApp;
  }, [autoPausedByApp]);

  useEffect(() => {
    setWeightInput(
      runSettings.preferences.weightKg === undefined
        ? ''
        : String(runSettings.preferences.weightKg),
    );
  }, [runSettings.preferences.weightKg]);

  // 카운트다운 도중에 화면을 떠나면 타이머를 반드시 정리합니다.
  useEffect(
    () => () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    },
    [],
  );

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
        // 끝을 정하지 않고 시작했다면 그 사실을 되살립니다.
        // 되살리지 않으면 앱을 다시 켠 순간 "6시간짜리 러닝"으로 보이고,
        // 코치가 갑자기 남은 시간을 말하기 시작합니다.
        if (!preferences.coachOpenEnded) {
          setOpenEnded(false);
          setMinutes(restoredMinutes);
          setDirectInput(String(restoredMinutes));
        } else {
          setOpenEnded(true);
        }
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
  }, [completeActivity, preferences.coachOpenEnded]);

  useEffect(() => {
    void refreshRuntime();
  }, [refreshRuntime]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => void refreshRuntime(), 1_000);
    return () => clearInterval(timer);
  }, [active, refreshRuntime]);

  const runtimeStateRef = useRef(runtime.state);
  useEffect(() => {
    runtimeStateRef.current = runtime.state;
  }, [runtime.state]);

  // 자동 멈춤·다시 시작을 화면과 음성 양쪽으로 알리고, 코치 시간도 함께 멈추거나 이어 갑니다.
  const autoPauseChange = tracking.autoPause.change;
  const handledAutoPauseAtRef = useRef(0);
  useEffect(() => {
    if (!autoPauseChange || autoPauseChange.atMillis === handledAutoPauseAtRef.current) return;
    handledAutoPauseAtRef.current = autoPauseChange.atMillis;

    if (autoPauseChange.event === 'paused') {
      // 사용자가 직접 멈춘 상태라면 아무것도 하지 않습니다.
      if (runtimeStateRef.current !== 'running') return;
      autoPausedByAppRef.current = true;
      setAutoPausedByApp(true);
      setAutoPauseNotice(autoPauseAnnouncements.paused.screen);
      speakCoachAside(autoPauseAnnouncements.paused.voice);
      void pauseCoachSession()
        .then(setRuntime)
        .catch(() => undefined);
      return;
    }

    // 스스로 멈춘 경우에만 스스로 다시 시작합니다.
    if (!autoPausedByAppRef.current) return;
    autoPausedByAppRef.current = false;
    setAutoPausedByApp(false);
    setAutoPauseNotice(autoPauseAnnouncements.resumed.screen);
    speakCoachAside(autoPauseAnnouncements.resumed.voice);
    void resumeCoachSession()
      .then(setRuntime)
      .catch(() => undefined);
  }, [autoPauseChange]);

  // 실제로 잰 숫자에 해석을 한 마디 붙여 말해 줍니다. 기존 코치 멘트와 같은 발화 큐를 씁니다.
  useEffect(() => {
    if (runtime.state !== 'running' || !tracking.snapshot.measuring) return;
    const splits = tracking.splits;
    const cue = nextLiveStatsCue(
      liveStatsRef.current,
      {
        distanceMeters: tracking.snapshot.distanceMeters,
        elapsedSeconds: runtime.elapsedSeconds,
        averagePaceSecondsPerKm: tracking.snapshot.averagePaceSecondsPerKm,
        lastSplitPaceSecondsPerKm:
          splits.length > 0 ? splitPaceSecondsPerKm(splits, splits.length - 1) : undefined,
        completedSplits: splits.length,
      },
      {
        mode: runSettings.preferences.liveStats,
        intervalMinutes: runSettings.preferences.liveStatsMinutes,
      },
    );
    if (!cue) return;
    liveStatsRef.current = cue.state;
    setLiveStatsText(cue.text);
    speakCoachAside(cue.text);
  }, [
    runSettings.preferences.liveStats,
    runSettings.preferences.liveStatsMinutes,
    runtime.elapsedSeconds,
    runtime.state,
    tracking.snapshot,
    tracking.splits,
  ]);

  // 칼로리는 몸무게가 있을 때만 계산합니다. 없으면 숫자를 지어내지 않고 안내만 보여 줍니다.
  const calories = useMemo(
    () =>
      estimateCalories({
        weightKg: runSettings.preferences.weightKg,
        distanceKm: tracking.snapshot.measuring ? tracking.snapshot.distanceKm : undefined,
        minutes: runtime.elapsedSeconds / 60,
      }),
    [
      runSettings.preferences.weightKg,
      runtime.elapsedSeconds,
      tracking.snapshot.distanceKm,
      tracking.snapshot.measuring,
    ],
  );

  // 오늘 무리인지 알려 주는 안내입니다. 거리를 재는 중이면 오늘 거리까지 함께 봅니다.
  const measuredKmForGuard =
    tracking.snapshot.measuring && tracking.snapshot.distanceKm > 0
      ? Math.round(tracking.snapshot.distanceKm * 10) / 10
      : undefined;
  const guardNotices: InjuryNotice[] = useMemo(
    () =>
      injuryNotices({
        activities,
        now: new Date(),
        ...(measuredKmForGuard === undefined ? {} : { plannedDistanceKm: measuredKmForGuard }),
      }).slice(0, MAX_VISIBLE_INJURY_NOTICES),
    [activities, measuredKmForGuard],
  );

  function applyDirectInput() {
    const value = Number(directInput);
    // 예전에는 10~120분만 받았습니다. 7분 걷기도, 3시간 롱런도 거절당했습니다.
    // 이제 하루 안이면 받습니다. 막는 것은 사람이 고를 리 없는 값뿐입니다.
    if (!Number.isInteger(value) || value < MIN_COACH_MINUTES || value > MAX_COACH_MINUTES) {
      setInputError(`${MIN_COACH_MINUTES}분부터 ${MAX_COACH_MINUTES}분 사이의 정수를 입력해 주세요.`);
      return;
    }
    setInputError('');
    setOpenEnded(false);
    setMinutes(value);
  }

  /** 빠른 선택 버튼입니다. 슬라이더로 맞추기 번거로운 길이를 한 번에 고릅니다. */
  function chooseQuickMinutes(value: number) {
    setInputError('');
    setOpenEnded(false);
    setMinutes(value);
    setDirectInput(String(value));
  }

  /** "끝낼 때까지"입니다. 남은 시간을 모르므로 코치가 진행·마무리를 말하지 않습니다. */
  function chooseOpenEnded() {
    setInputError('');
    setOpenEnded(true);
  }

  function chooseVoice(gender: VoiceGender) {
    setVoiceGender(gender);
    void saveCoachVoicePreference({ gender });
  }

  function saveWeight() {
    const value = parseWeightInput(weightInput);
    if (value === undefined) {
      setWeightError(weightRangeNotice);
      return;
    }
    setWeightError('');
    void runSettings.update({ weightKg: value });
  }

  function stopCountdown() {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = undefined;
    countdownValueRef.current = 0;
    setCountdownRemaining(undefined);
  }

  /** 카운트다운이 끝난 뒤 실제로 코칭을 시작합니다. */
  async function launchSession() {
    await updatePreferences({ coachMinutes: minutes, coachType: kind, coachOpenEnded: openEnded });
    try {
      setRuntime(await startCoachSession(session, preferences.speechRate, voiceGender));
    } catch {
      Alert.alert(
        '음성 코치를 시작하지 못했어요',
        '러닝을 시작하지 못했어요. 기기의 한국어 음성 설정을 확인한 뒤 다시 시도해 주세요.',
      );
    }
  }

  async function begin() {
    setCompletionSaved(false);
    setCompletionTrack(undefined);
    setAutoPauseNotice(undefined);
    setLiveStatsText(undefined);
    setAutoPausedByApp(false);
    autoPausedByAppRef.current = false;
    liveStatsRef.current = initialLiveStatsState;
    completionInFlightRef.current = null;
    tracking.reset();

    // 카운트다운도 코치와 같은 목소리로 세도록 미리 준비합니다.
    await prepareCoachAsideVoice(voiceGender, preferences.speechRate);

    const seconds = runSettings.preferences.countdownSeconds;
    countdownValueRef.current = seconds;
    setCountdownRemaining(seconds);
    speakCoachAside(countdownStep(seconds).voiceText);

    const timer = setInterval(() => {
      countdownValueRef.current -= 1;
      const remaining = countdownValueRef.current;
      if (remaining <= 0) {
        stopCountdown();
        speakCoachAside(countdownStep(0).voiceText);
        void launchSession();
        return;
      }
      setCountdownRemaining(remaining);
      speakCoachAside(countdownStep(remaining).voiceText);
    }, 1_000);
    countdownTimerRef.current = timer;
  }

  // 오확인으로 러닝이 끊기지 않도록 종료는 항상 한 번 되묻습니다.
  function confirmStop() {
    Alert.alert(
      '오늘 운동을 끝낼까요?',
      `${formatElapsed(runtime.elapsedSeconds)} 진행했어요. 예정 시간 전에 끝내면 완주 기록으로 저장하지 않아요.`,
      [
        { text: '계속 달리기', style: 'cancel' },
        {
          text: '종료',
          style: 'destructive',
          onPress: () => {
            autoPausedByAppRef.current = false;
            setAutoPausedByApp(false);
            void stopCoachSession().then(setRuntime);
          },
        },
      ],
    );
  }

  /** 사용자가 직접 멈추거나 다시 시작할 때는 자동 판정이 끼어들지 않게 표시를 지웁니다. */
  function togglePause() {
    autoPausedByAppRef.current = false;
    setAutoPausedByApp(false);
    setAutoPauseNotice(undefined);
    void (runtime.state === 'paused' ? resumeCoachSession() : pauseCoachSession()).then(setRuntime);
  }

  // 야간 모드는 "달리는 중"에만 켜집니다. 다른 화면 색은 그대로 둡니다.
  const nightRun = night && active;

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, nightRun && styles.safeNight]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {nightRun ? null : <Wordmark compact />}
          {nightRun ? null : <Text style={styles.heading}>오늘 얼마나 움직일까요?</Text>}

          {nightRun ? null : (
          <Card style={styles.timeCard}>
            <Text accessibilityLiveRegion="polite" style={styles.minutes}>
              {openEnded ? extentLabel({ type: 'open-ended' }) : `${minutes}분`}
            </Text>

            {/* 자주 쓰는 길이를 한 번에 고릅니다. 슬라이더로 5분을 맞추는 것은 성가십니다. */}
            <View style={styles.quickRow}>
              {quickMinutes.map((value) => (
                <Pressable
                  accessibilityLabel={`${value}분`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !openEnded && minutes === value }}
                  key={value}
                  onPress={() => chooseQuickMinutes(value)}
                  style={[styles.quickChip, !openEnded && minutes === value && styles.quickChipOn]}
                >
                  <Text
                    style={[
                      styles.quickChipText,
                      !openEnded && minutes === value && styles.quickChipTextOn,
                    ]}
                  >
                    {value}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityLabel="끝낼 때까지 달리기"
                accessibilityRole="button"
                accessibilityState={{ selected: openEnded }}
                onPress={chooseOpenEnded}
                style={[styles.quickChip, styles.quickChipWide, openEnded && styles.quickChipOn]}
              >
                <Text style={[styles.quickChipText, openEnded && styles.quickChipTextOn]}>
                  끝낼 때까지
                </Text>
              </Pressable>
            </View>

            {openEnded ? (
              <Text style={styles.range}>
                끝을 정하지 않았어요. 코치는 남은 시간을 말하지 않고, 멈출 때까지 함께 갑니다.
              </Text>
            ) : (
              <>
                <Slider
                  accessibilityLabel="코칭 시간"
                  maximumTrackTintColor={palette.line}
                  maximumValue={180}
                  minimumTrackTintColor={palette.accent}
                  minimumValue={5}
                  onValueChange={(value) => {
                    const rounded = Math.round(value / 5) * 5;
                    setMinutes(rounded);
                    setDirectInput(String(rounded));
                    setInputError('');
                  }}
                  step={5}
                  thumbTintColor={palette.accent}
                  value={Math.min(180, Math.max(5, minutes))}
                />
                <View style={styles.rangeRow}>
                  <Text style={styles.range}>5분</Text>
                  <Text style={styles.range}>180분</Text>
                </View>
              </>
            )}
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
              {'\n'}권장 밖도 그대로 갑니다. {MIN_COACH_MINUTES}분부터 {MAX_COACH_MINUTES}분까지
              직접 입력할 수 있어요.
            </Text>
          </Card>
          )}

          {nightRun ? null : (
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
              <Chip label={`힘든 정도 ${type.rpe.min}~${type.rpe.max}`} tone="warning" />
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
              disabled={active || countdownRemaining !== undefined}
              label={active ? '코칭 진행 중' : '러닝 시작'}
              onPress={() => void begin()}
              style={styles.primary}
            />
            <Text style={styles.range}>
              {countdownHelpText(runSettings.preferences.countdownSeconds)}
            </Text>

            {/* 오늘 무리인지 미리 다정하게 알려 줍니다. 겁주지 않고, 근거도 함께 밝힙니다. */}
            {!active && guardNotices.length > 0
              ? guardNotices.map((notice) => (
                  <View
                    accessibilityLiveRegion="polite"
                    key={notice.id}
                    style={[
                      styles.preNotice,
                      notice.tone !== 'gentle' && styles.preNoticeWarning,
                    ]}
                  >
                    <Text style={styles.preNoticeTitle}>{notice.title}</Text>
                    <Text style={styles.preNoticeBody}>{notice.body}</Text>
                    <Text style={styles.preNoticeAction}>{notice.evidence}</Text>
                  </View>
                ))
              : null}

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
          )}

          {active || runtime.state === 'completed' ? (
            <Card
              accessibilityLabel="러닝 진행 화면"
              style={[styles.runtimeCard, nightRun && styles.runtimeCardNight]}
            >
              <View style={styles.runtimeHeader}>
                <Text style={styles.runtimeLabel}>
                  {runtime.native ? '기기 백그라운드 코치' : '화면 안내 fallback'}
                </Text>
                <Text style={styles.runtimeState}>
                  {runtime.state === 'paused'
                    ? autoPausedByApp
                      ? '스스로 멈춤'
                      : '잠시 멈춤'
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
              {/* 끝을 정하지 않았으면 남은 시간도 진행률도 없습니다.
                  모르는 것을 숫자로 그려 보여 주면 그것도 거짓말입니다. */}
              {showsRemaining ? (
                <>
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
                </>
              ) : (
                <View style={styles.timeRow}>
                  <Text style={styles.runtimeRemain}>끝낼 때까지</Text>
                  <Text style={styles.runtimeTotal}>멈추면 그때가 끝이에요</Text>
                </View>
              )}

              {/* 자동 멈춤·다시 시작을 화면에서도 바로 알립니다(음성으로도 함께 말합니다). */}
              {autoPauseNotice || tracking.autoPause.status ? (
                <View
                  accessibilityLiveRegion="polite"
                  style={[
                    styles.noticeBox,
                    tracking.autoPause.paused && styles.noticeWarning,
                  ]}
                >
                  <Text style={styles.noticeTitle}>
                    {tracking.autoPause.status?.label ?? '자동 멈춤'}
                  </Text>
                  {autoPauseNotice ? (
                    <Text style={styles.trackingNote}>{autoPauseNotice}</Text>
                  ) : null}
                  {tracking.autoPause.status ? (
                    <Text style={styles.trackingNote}>{tracking.autoPause.status.detail}</Text>
                  ) : null}
                </View>
              ) : null}

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
                  <Text style={styles.trackingNote}>
                    자동 멈춤 {autoPauseTunings[tracking.autoPause.level].label} ·{' '}
                    {autoPauseSpeedSummary(tracking.autoPause.level)}
                  </Text>
                </View>
              ) : (
                <View style={styles.noticeBox}>
                  <Text style={styles.noticeTitle}>이 빌드는 시간 기반 코칭만 해요</Text>
                  <Text style={styles.trackingNote}>{gpsUnavailableNotice}</Text>
                </View>
              )}

              {/* 칼로리: 몸무게가 있어야만 숫자를 보여 줍니다. 없으면 안내만 합니다. */}
              <View accessibilityLabel="칼로리" style={styles.trackingBox}>
                <Text style={styles.phaseLabel}>칼로리</Text>
                {calories.available ? (
                  <>
                    <Text style={styles.caloriesValue}>{calories.label}</Text>
                    <Text style={styles.trackingNote}>{calories.note}</Text>
                    {calories.basis === 'distance' ? null : (
                      <Text style={styles.trackingNote}>{speedIndependenceNote}</Text>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.trackingNote}>{calories.message}</Text>
                    <Text style={styles.trackingNote}>
                      아래 &quot;안내·음성 설정&quot;이나 설정 화면에서 몸무게를 넣을 수 있어요.
                    </Text>
                  </>
                )}
              </View>

              {/* 달리는 중에도 오늘 거리가 평소보다 많이 길면 부드럽게 알려 줍니다. */}
              {active && guardNotices.length > 0 ? (
                <View accessibilityLiveRegion="polite" style={styles.noticeBox}>
                  <Text style={styles.noticeTitle}>{guardNotices[0]?.title}</Text>
                  <Text style={styles.trackingNote}>{guardNotices[0]?.body}</Text>
                </View>
              ) : null}

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
                {liveStatsText ? (
                  <Text style={styles.cueDistance}>{liveStatsText}</Text>
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
                    label={runtime.state === 'paused' ? '다시 시작' : '잠시 멈춤'}
                    onPress={togglePause}
                    tone="secondary"
                    style={styles.action}
                  />
                  <Button
                    accessibilityHint="한 번 더 확인한 뒤 오늘 운동을 끝내요."
                    label="종료"
                    onPress={confirmStop}
                    tone="danger"
                    style={styles.action}
                  />
                </View>
              )}
            </Card>
          ) : null}

          {nightRun ? null : (
          <Button
            label={showAdvanced ? '세부 설정 접기' : '안내·음성 설정'}
            onPress={() => setShowAdvanced((value) => !value)}
            tone="quiet"
          />
          )}
          {showAdvanced && !nightRun ? (
            <Card style={styles.advanced}>
              <Text style={styles.advancedTitle}>몸무게</Text>
              <Text style={styles.range}>
                칼로리를 계산할 때만 써요. 넣지 않으면 칼로리를 보여 주지 않아요.
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  accessibilityLabel="몸무게(킬로그램)"
                  inputMode="decimal"
                  maxLength={5}
                  onChangeText={(value) => {
                    setWeightInput(value);
                    setWeightError('');
                  }}
                  onSubmitEditing={saveWeight}
                  placeholder="예: 62"
                  returnKeyType="done"
                  style={styles.input}
                  value={weightInput}
                />
                <Button label="저장" onPress={saveWeight} tone="secondary" />
              </View>
              {weightError ? <Text style={styles.error}>{weightError}</Text> : null}
              <Text style={styles.range}>
                {runSettings.preferences.weightKg === undefined
                  ? weightMissingNotice
                  : `지금은 ${runSettings.preferences.weightKg}kg으로 계산해요. ${speedIndependenceNote}`}
              </Text>

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

      {/* 시작 카운트다운: 화면에 크게 세고, 음성으로도 함께 셉니다. */}
      <Modal
        animationType="fade"
        onRequestClose={stopCountdown}
        transparent
        visible={countdownRemaining !== undefined}
      >
        <View style={styles.countdownBackdrop}>
          <Text
            accessibilityLiveRegion="assertive"
            accessibilityLabel={countdownStep(countdownRemaining ?? 0).spokenLabel}
            style={styles.countdownNumber}
          >
            {countdownStep(countdownRemaining ?? 0).screenText}
          </Text>
          <Text style={styles.countdownHelp}>곧 시작해요. 준비되면 그대로 두세요.</Text>
          <Button label="취소" onPress={stopCountdown} tone="quiet" />
        </View>
      </Modal>

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
                    {value.intensityLabel} · 힘든 정도 {value.rpe.min}~{value.rpe.max}
                    (10점 만점) · 추천 {value.defaultMinutes}분
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
  // 야간 모드: 달리는 중에만 화면 바탕을 어둡게 합니다.
  safeNight: { backgroundColor: '#0B1018' },
  runtimeCardNight: { backgroundColor: '#111A28' },
  caloriesValue: {
    color: palette.white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  countdownBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(11,16,24,0.92)',
    padding: spacing.lg,
  },
  countdownNumber: {
    color: palette.white,
    fontSize: 120,
    lineHeight: 132,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  countdownHelp: { color: '#CCD5E3', fontSize: typeScale.body, lineHeight: 24 },
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
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  quickChip: {
    minWidth: 48,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  quickChipWide: { minWidth: 96 },
  quickChipOn: { backgroundColor: palette.accent, borderColor: palette.accent },
  quickChipText: { color: palette.ink, fontSize: typeScale.caption, fontWeight: '700' },
  quickChipTextOn: { color: palette.surface },
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
