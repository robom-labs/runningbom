// 회차를 따라 하는 화면입니다. "지금 무엇을 해야 하는지"가 한눈에 보이는 것이 이 화면의 전부예요.
//
// 위에서부터: 구간 띠 → 큰 원(남은 시간·지금 할 일) → 전체 경과 시간·남은 구간 수 → 버튼.
// 시간 계산은 domains/programs/session.ts의 순수 함수가 하고, 여기서는 1초마다 세기만 합니다.
import { useCallback, useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    if (paused || ended) return undefined;
    const id = setInterval(() => {
      setElapsed((value) => value + 1);
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
    setElapsed((value) => skipToNextSegment(timeline, value));
  }, [timeline]);

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
