// 회차를 따라 하는 화면입니다. "지금 무엇을 해야 하는지"가 한눈에 보이는 것이 이 화면의 전부예요.
//
// 위에서부터: 구간 띠 → 큰 원(남은 시간·지금 할 일) → 전체 경과 시간·남은 구간 수 → 버튼.
// 시간 계산은 domains/programs/session.ts의 순수 함수가 하고, 여기서는 1초마다 세기만 합니다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, SectionHeader, screenStyles } from '../../design-system/components';
import {
  borderWidth,
  fontWeight,
  lineHeight,
  palette,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';
import { sessionShape } from '../../../domains/programs/beginnerProgram';
import { judgeSession, type SessionAttempt } from '../../../domains/programs/progress';
import {
  CUE_LEAD_SECONDS,
  elapsedLabel,
  remainingSegmentsLabel,
  ribbonCells,
  sessionNow,
  sessionTimeline,
  skipToNextSegment,
} from '../../../domains/programs/session';
import { formatClock, type ProgramSession } from '../../../domains/programs/types';
import { programCoachSession } from '../../../domains/programs/coachSession';
import {
  coachSpeechDiagnostics,
  type CoachSpeechDiagnostics,
  pauseCoachSession,
  resumeCoachSession,
  seekCoachSpeech,
  startCoachSession,
  stopCoachSession,
  syncCoachSpeech,
} from '../../../services/audio/coachService';
import { CountdownRing } from './CountdownRing';
import { SegmentRibbon } from './SegmentRibbon';

export type SessionRunnerProps = {
  session: ProgramSession;
  /** 그만 두고 목록으로 돌아갈 때 씁니다. */
  onClose: () => void;
  /**
   * 회차를 마쳤을 때 부릅니다.
   * markComplete가 false면 "같은 회차를 한 번 더 하겠다"는 뜻이라 다음으로 넘어가지 않아요.
   */
  onFinish: (attempt: SessionAttempt, markComplete: boolean) => void;
};

export function SessionRunner({ session, onClose, onFinish }: SessionRunnerProps) {
  const timeline = useMemo(() => sessionTimeline(session), [session]);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  /** 음성 엔진에 마지막으로 알려 준 멈춤 상태입니다. 처음에는 아직 알려 준 적이 없습니다. */
  const pausedSentRef = useRef<boolean | undefined>(undefined);
  /** 음성이 실제로 나가고 있는지 화면에 보여 주는 값입니다. */
  const [voiceStatus, setVoiceStatus] = useState<CoachSpeechDiagnostics | undefined>(undefined);

  // 회차를 메인 음성 코치 엔진에 그대로 넘깁니다.
  // 이 화면이 직접 말하지 않고, 자유 러닝과 같은 엔진이 읽어 줍니다.
  // 덕분에 화면을 잠그고 주머니에 넣어도 걷기·달리기 전환이 귀로 들립니다.
  useEffect(() => {
    let cancelled = false;
    pausedSentRef.current = undefined;
    // 말하기는 앱이 직접 합니다. 시간과 화면 잠금 유지만 기기 서비스에 맡깁니다.
    //
    // 회차 음성이 기기 서비스의 대사표에만 의존하던 동안, 첫 대사만 들리고 그 뒤로
    // 조용하다는 신고가 두 번 있었습니다. 그 서비스 안에서 무슨 일이 일어나는지는
    // 앱에서 볼 수 없고, 고치려면 새 APK가 필요합니다.
    // 반면 앱이 직접 말하는 경로는 같은 기기에서 이미 잘 들리고 있습니다.
    void startCoachSession(programCoachSession(session), 1, 'female', {
      speechOwner: 'app',
    }).catch(() => {
      // 음성이 준비되지 않아도 회차 자체는 그대로 진행합니다(화면 안내는 남아 있습니다).
    });
    return () => {
      cancelled = true;
      void stopCoachSession().catch(() => undefined);
      void cancelled;
    };
  }, [session]);

  // 화면의 일시정지·재개를 음성 엔진에도 그대로 전달합니다.
  //
  // 처음 그려질 때는 보내지 않습니다. 시작은 위 effect가 이미 맡고 있고,
  // 시작이 준비되는 동안 재개 신호가 먼저 도착하면 엔진이 시작 전 상태에서 그 신호를 받습니다.
  // 실제로 멈춤 상태가 바뀐 순간에만 알려 줍니다.
  useEffect(() => {
    if (ended) return;
    if (pausedSentRef.current === undefined || pausedSentRef.current === paused) {
      pausedSentRef.current = paused;
      return;
    }
    pausedSentRef.current = paused;
    void (paused ? pauseCoachSession() : resumeCoachSession()).catch(() => undefined);
  }, [ended, paused]);

  // 회차가 끝나면 음성도 함께 정리합니다.
  useEffect(() => {
    if (!ended) return;
    void stopCoachSession().catch(() => undefined);
  }, [ended]);

  useEffect(() => {
    if (paused || ended) return undefined;
    const id = setInterval(() => {
      setElapsed((value) => {
        const next = value + 1;
        // 화면 시계가 정본입니다. 음성이 어긋나 있으면 화면에 맞춥니다.
        // 두 시계를 따로 두면 "다음 구간으로"를 눌렀을 때 음성만 옛날 자리에 남습니다.
        syncCoachSpeech(next);
        return next;
      });
      // 음성이 실제로 나가고 있는지 화면에서 바로 확인할 수 있게 합니다.
      // "안 들린다"를 짐작이 아니라 사실로 좁히기 위한 값입니다.
      setVoiceStatus(coachSpeechDiagnostics());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [ended, paused]);

  useEffect(() => {
    if (!ended && elapsed >= timeline.totalSeconds) setEnded(true);
  }, [elapsed, ended, timeline.totalSeconds]);

  const now = useMemo(() => sessionNow(timeline, elapsed), [elapsed, timeline]);
  const cells = useMemo(() => ribbonCells(timeline, now.index), [now.index, timeline]);

  const completedSeconds = Math.min(elapsed, timeline.totalSeconds);
  const verdict = useMemo(
    () =>
      judgeSession({
        completedSeconds,
        totalSeconds: timeline.totalSeconds,
        isMilestone: session.isMilestone,
      }),
    [completedSeconds, session.isMilestone, timeline.totalSeconds],
  );

  const attempt = useMemo<SessionAttempt>(
    () => ({
      sessionId: session.id,
      completedSeconds,
      totalSeconds: timeline.totalSeconds,
      finishedAt: new Date().toISOString(),
    }),
    [completedSeconds, session.id, timeline.totalSeconds],
  );

  const skip = useCallback(() => {
    setElapsed((value) => {
      const next = skipToNextSegment(timeline, value);
      // 구간을 건너뛰면 음성도 그 자리로 함께 옮기고, 새 구간 안내를 바로 말합니다.
      // 건너뛰었는데 아무 말이 없으면 지금 무엇을 할 차례인지 알 수 없습니다.
      seekCoachSpeech(next);
      return next;
    });
  }, [timeline]);

  /** 음성이 안 켜졌을 때 회차를 그대로 둔 채 음성만 다시 시작합니다. */
  const restartVoice = useCallback(() => {
    void startCoachSession(programCoachSession(session), 1, 'female', {
      speechOwner: 'app',
    })
      .then(() => {
        // 다시 켠 음성을 지금 화면 시각으로 옮깁니다. 처음부터 다시 말하면 안 됩니다.
        seekCoachSpeech(elapsed);
        setVoiceStatus(coachSpeechDiagnostics());
      })
      .catch(() => undefined);
  }, [elapsed, session]);

  const stopNow = useCallback(() => {
    setPaused(true);
    setEnded(true);
  }, []);

  if (ended) {
    return (
      <ScrollView contentContainerStyle={screenStyles.content} style={screenStyles.root}>
        <SectionHeader subtitle={session.title} title={verdict.title} />
        <Card style={styles.verdict} tone={verdict.passed ? 'warm' : 'default'}>
          <Text style={styles.verdictPercent}>{`${verdict.percent}%`}</Text>
          <Text style={styles.verdictBody}>{verdict.message}</Text>
          <Text style={styles.verdictMeta}>
            {`채운 시간 ${formatClock(completedSeconds)} / 전체 ${formatClock(
              timeline.totalSeconds,
            )}`}
          </Text>
          <Button
            label={verdict.primaryLabel}
            onPress={() => {
              onFinish(attempt, verdict.passed);
            }}
            size="lg"
          />
          <Button
            label={verdict.secondaryLabel}
            onPress={() => {
              onFinish(attempt, !verdict.passed);
            }}
            tone="secondary"
          />
          <Button label="목록으로" onPress={onClose} tone="quiet" />
        </Card>
        <Text style={styles.footNote}>
          기준에 못 미쳐도 다음 회차로 넘어갈 수 있어요. 고르는 건 언제나 나예요.
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={screenStyles.content} style={screenStyles.root}>
      <SectionHeader
        action={<Button label="그만하기" onPress={stopNow} tone="quiet" />}
        subtitle={sessionShape(session)}
        title={session.title}
      />

      <SegmentRibbon cells={cells} />

      <View accessibilityLiveRegion="polite" style={styles.cueSlot}>
        {now.upcomingCue ? (
          <View style={styles.cue}>
            <Text style={styles.cueText}>{now.upcomingCue}</Text>
          </View>
        ) : (
          <Text style={styles.cueHint}>
            {`구간이 바뀌기 ${CUE_LEAD_SECONDS}초 전에 여기로 미리 알려 드려요.`}
          </Text>
        )}
      </View>

      <CountdownRing
        actionLabel={now.entry.segment.label}
        kind={now.entry.segment.kind}
        ratio={now.segmentRatio}
        remainingLabel={formatClock(now.remainingSeconds)}
        {...(now.next ? { caption: `다음은 ${now.next.label} ${formatClock(now.next.seconds)}` } : {})}
      />

      <View style={styles.statusRow}>
        <View style={styles.status}>
          <Text style={styles.statusValue}>{elapsedLabel(elapsed, timeline.totalSeconds)}</Text>
          <Text style={styles.statusLabel}>전체 경과 시간</Text>
        </View>
        <View style={styles.status}>
          <Text style={styles.statusValue}>{`${now.remainingSegments}개`}</Text>
          <Text style={styles.statusLabel}>남은 구간</Text>
        </View>
      </View>

      {/*
        음성이 나가고 있는지를 화면에서 바로 확인할 수 있게 합니다.
        "안 들린다"가 들어왔을 때, 안내가 안 만들어진 것인지·안 나간 것인지·
        나갔는데 소리가 안 들린 것인지를 짐작이 아니라 사실로 가릅니다.
      */}
      {voiceStatus ? (
        <View style={styles.voiceSlot}>
          <Text style={styles.voiceStatus}>
            {voiceStatus.owner === 'none'
              ? '음성이 아직 안 켜졌어요.'
              : voiceStatus.lastSpokenOffsetSeconds === undefined
                ? `음성 준비 중 · 남은 안내 ${voiceStatus.remainingCues}개`
                : `방금 안내 ${formatClock(voiceStatus.lastSpokenOffsetSeconds)} · 남은 안내 ${voiceStatus.remainingCues}개`}
          </Text>
          {voiceStatus.owner === 'none' ? (
            // 음성이 안 켜졌을 때 회차를 처음부터 다시 하지 않고 여기서 되살립니다.
            <Button label="음성 다시 켜기" onPress={restartVoice} tone="secondary" />
          ) : null}
        </View>
      ) : null}

      <View style={styles.controls}>
        <Button
          label={paused ? '이어서 하기' : '일시정지'}
          onPress={() => {
            setPaused((value) => !value);
          }}
          size="lg"
          style={styles.controlButton}
        />
        <Button
          label="다음 구간으로"
          onPress={skip}
          style={styles.controlButton}
          tone="secondary"
        />
      </View>

      {session.isMilestone && session.encouragement ? (
        <Card style={styles.encourage} tone="warm">
          <Text style={styles.encourageTitle}>오늘은 고비예요</Text>
          <Text style={styles.encourageBody}>{session.encouragement}</Text>
        </Card>
      ) : null}

      {paused ? (
        <Text style={styles.footNote}>
          잠깐 멈췄어요. 물 마시고 숨 고른 뒤에 이어서 하기를 눌러요.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cueSlot: {
    minHeight: 44,
    justifyContent: 'center',
  },
  cue: {
    backgroundColor: palette.accentSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cueText: {
    color: palette.accentDark,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
    textAlign: 'center',
  },
  cueHint: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  status: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    paddingVertical: spacing.sm,
    gap: spacing.xxs,
  },
  statusValue: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.bold,
  },
  statusLabel: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  voiceSlot: { gap: spacing.xs },
  voiceStatus: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  controlButton: {
    flex: 1,
  },
  encourage: {
    gap: spacing.xs,
  },
  encourageTitle: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.bold,
  },
  encourageBody: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  verdict: {
    gap: spacing.sm,
  },
  verdictPercent: {
    color: palette.accentDark,
    fontSize: typeScale.display,
    lineHeight: lineHeight.display,
    fontWeight: fontWeight.heavy,
  },
  verdictBody: {
    color: palette.ink,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
  },
  verdictMeta: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  footNote: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    paddingTop: spacing.xs,
  },
});
