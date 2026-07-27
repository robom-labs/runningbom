// 러닝 메트로놈 화면입니다.
//
// 회장 지시: **별도 카테고리로, 배경음악과 함께, 러닝에 최적화.**
//
// 화면이 하는 일은 셋뿐입니다.
//   1. 지금 박자를 크게 보여 준다
//   2. 자주 쓰는 값 셋을 먼저 보여 주고, 세밀 조절은 그 아래에 둔다
//   3. 급하게 못 올리게 막고, 막았으면 말해 준다
//
// 소리를 언제 낼지·얼마나 기다릴지는 전부 `domains/cadence/metronome.ts`가 정합니다
// (순수 함수, 테스트가 봅니다). 이 파일은 그 값을 화면과 소리로 옮기기만 합니다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';

import { Button, Card, SectionHeader, screenStyles } from '../../design-system/components';
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
  DEFAULT_CADENCE,
  MAX_CADENCE,
  MAX_STEP_UP,
  MIN_CADENCE,
  MUSIC_NOTE,
  cadenceLabel,
  cadenceNotes,
  changeCadence,
  commonCadences,
  nextBeatDelay,
  suggestedTarget,
} from '../../../domains/cadence/metronome';

export type CadenceScreenProps = {
  onBack?: () => void;
};

export function CadenceScreen({ onBack }: CadenceScreenProps) {
  const [cadence, setCadence] = useState<number>(DEFAULT_CADENCE);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | undefined>(undefined);
  const [showAll, setShowAll] = useState(false);
  const [beat, setBeat] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const startedAtRef = useRef(0);
  const cadenceRef = useRef(cadence);
  cadenceRef.current = cadence;

  const stop = useCallback(() => {
    setRunning(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = undefined;
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    startedAtRef.current = Date.now();

    /**
     * 흘러간 시간을 매번 보정합니다.
     * setInterval만 쓰면 30분 달리는 동안 발과 소리가 눈에 띄게 어긋납니다.
     */
    const tick = () => {
      setBeat((value) => value + 1);
      // 소리 파일을 번들에 넣지 않습니다(용량·저작권). 짧은 진동으로 박자를 냅니다.
      // 진동은 배경음악을 끊지 않아서, 음악과 같이 쓰기에도 오히려 낫습니다.
      if (Platform.OS !== 'web') Vibration.vibrate(28);
      const delay = nextBeatDelay(startedAtRef.current, Date.now(), cadenceRef.current);
      timerRef.current = setTimeout(tick, delay);
    };

    timerRef.current = setTimeout(tick, nextBeatDelay(startedAtRef.current, Date.now(), cadence));
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // cadence가 바뀌면 다음 박자부터 새 간격이 적용됩니다(위 tick이 ref를 봅니다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // 화면을 벗어나면 반드시 멈춥니다. 주머니에서 계속 울리면 최악입니다.
  useEffect(() => stop, [stop]);

  const apply = useCallback((wanted: number) => {
    setCadence((current) => {
      const result = changeCadence(current, wanted);
      // 깎였으면 반드시 말해 줍니다. 조용히 깎으면 고장으로 보입니다.
      setNote(result.note);
      return result.next;
    });
  }, []);

  return (
    <ScrollView contentContainerStyle={screenStyles.content} style={screenStyles.root}>
      <SectionHeader
        subtitle="발이 땅에 닿는 박자예요. 보폭을 늘리는 대신 발을 자주 놓으면 무릎이 편해져요."
        title="박자 맞추기"
        {...(onBack ? { action: <Button label="닫기" onPress={onBack} tone="quiet" /> } : {})}
      />

      <Card elevated style={styles.hero} tone={running ? 'warm' : 'default'}>
        <Text style={styles.heroValue}>{cadence}</Text>
        <Text style={styles.heroUnit}>분당 발걸음</Text>
        <Text style={styles.heroNote}>{cadenceNotes[cadence] ?? '내 몸에 맞춘 박자예요'}</Text>

        {/* 박자마다 점이 커집니다. 소리를 못 듣는 상황에서도 눈으로 확인됩니다. */}
        <View
          accessibilityLabel={running ? '박자 켜짐' : '박자 꺼짐'}
          style={[styles.pulse, running && beat % 2 === 0 && styles.pulseOn]}
        />

        <Button
          label={running ? '멈추기' : '시작하기'}
          onPress={() => (running ? stop() : setRunning(true))}
          size="lg"
          testID="cadence-toggle"
        />
        <Text style={styles.musicNote}>{MUSIC_NOTE}</Text>
      </Card>

      {/* 자주 쓰는 값 셋을 먼저. 스물한 개를 늘어놓으면 고르다 지칩니다(기획서 §4.6). */}
      <Card style={styles.block}>
        <Text accessibilityRole="header" style={styles.blockTitle}>
          많이 쓰는 박자
        </Text>
        <View style={styles.presets}>
          {commonCadences.map((value) => (
            <Pressable
              accessibilityLabel={cadenceLabel(value)}
              accessibilityRole="button"
              accessibilityState={{ selected: cadence === value }}
              key={value}
              onPress={() => apply(value)}
              style={({ pressed }) => [
                styles.preset,
                cadence === value && styles.presetOn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.presetValue, cadence === value && styles.presetValueOn]}>
                {value}
              </Text>
              <Text style={styles.presetNote}>{cadenceNotes[value]}</Text>
            </Pressable>
          ))}
        </View>

        <Button
          label={showAll ? '세밀 조절 접기' : '세밀하게 맞추기'}
          onPress={() => setShowAll((value) => !value)}
          tone="secondary"
        />

        {showAll ? (
          <View style={styles.fineRow}>
            <Button label="−1" onPress={() => apply(cadence - 1)} tone="secondary" />
            <Button label="−5" onPress={() => apply(cadence - 5)} tone="secondary" />
            <Button label="+1" onPress={() => apply(cadence + 1)} tone="secondary" />
            <Button label="+5" onPress={() => apply(cadence + 5)} tone="secondary" />
          </View>
        ) : null}

        {note ? (
          <Text accessibilityLiveRegion="polite" style={styles.limit}>
            {note}
          </Text>
        ) : null}
      </Card>

      <Card style={styles.block}>
        <Text accessibilityRole="header" style={styles.blockTitle}>
          지켜야 할 것
        </Text>
        <Text style={styles.body}>
          {`한 번에 ${MAX_STEP_UP}보까지만 올려요. 지금이 ${cadence}보면 다음 목표는 ${suggestedTarget(cadence)}보예요. ` +
            '케이던스를 급히 바꾸면 종아리와 정강이가 먼저 아파요. 2~3주에 걸쳐 올리는 게 안전해요.'}
        </Text>
        <Text style={styles.body}>
          {`${MIN_CADENCE}보 아래나 ${MAX_CADENCE}보 위로는 맞출 수 없어요. 그 밖은 달리기 박자가 아니에요.`}
        </Text>
        <Text style={styles.body}>
          훈련 회차 중에 켜 두면, 걷는 구간에서는 저절로 멈추고 코치가 말할 때는 잠깐 비켜요.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.xs },
  heroValue: {
    color: palette.ink,
    fontSize: 64,
    lineHeight: 70,
    fontWeight: fontWeight.heavy,
  },
  heroUnit: { color: palette.inkSoft, fontSize: typeScale.bodySmall, fontWeight: fontWeight.bold },
  heroNote: { color: palette.muted, fontSize: typeScale.caption },
  pulse: {
    width: 14,
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: palette.line,
    marginVertical: spacing.xs,
  },
  pulseOn: { backgroundColor: palette.accentStrong, transform: [{ scale: 1.6 }] },
  musicNote: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    textAlign: 'center',
  },
  block: { gap: spacing.sm },
  blockTitle: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.bold,
  },
  presets: { flexDirection: 'row', gap: spacing.xs },
  preset: {
    flex: 1,
    minHeight: layout.touchTarget + 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderColor: palette.line,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    padding: spacing.xs,
  },
  presetOn: { borderColor: palette.accentStrong, backgroundColor: palette.accentSoft },
  pressed: { opacity: pressedOpacity },
  presetValue: {
    color: palette.ink,
    fontSize: typeScale.title,
    fontWeight: fontWeight.heavy,
  },
  presetValueOn: { color: palette.accentDark },
  presetNote: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    textAlign: 'center',
  },
  fineRow: { flexDirection: 'row', gap: spacing.xs },
  limit: {
    color: palette.warning,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.bold,
  },
  body: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
});
