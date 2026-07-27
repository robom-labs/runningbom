// "목소리 고르기" 화면입니다.
//
// 왜 만들었나
// - 코치 목소리가 어색하다는 이야기의 원인은 대부분 셋 중 하나입니다.
//   (1) 기기에 기본 목소리만 깔려 있다 (2) 앱이 성별을 잘못 짚어서 고른 목소리와 다른 목소리가 나온다
//   (3) 읽히는 글에 숫자·기호가 그대로 들어 있다.
// - (1)과 (2)는 결국 "직접 들어 보고 고르기"로만 확실히 풀립니다. 그래서 이 화면이 있습니다.
//
// 라우팅은 부모가 합니다. 이 화면은 onBack만 받습니다.
import Slider from '@react-native-community/slider';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Banner, Button, Card, Chip, screenStyles, SectionHeader } from '../../design-system/components';
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
import { toSpeech } from '../../../domains/coaching/speechText';
import {
  androidVoiceSettingsIntent,
  defaultCoachVoicePick,
  koreanVoiceQuality,
  rankKoreanVoices,
  reconcileVoicePick,
  voiceInstallSteps,
  voicePitchRange,
  voicePreviewSentence,
  voiceRateRange,
  voiceTierLabels,
  type CoachVoicePick,
  type RankedVoice,
  type SpeechVoiceLike,
  type VoiceQualityReport,
} from '../../../domains/coaching/voice';
import { loadCoachVoicePick, saveCoachVoicePick } from './voicePickStorage';

export const voicePickerScreenTitle = '목소리 고르기';
export const voicePickerScreenSubtitle = '들어 보고 마음에 드는 코치 목소리를 골라요';

type Props = {
  /** 있으면 맨 위에 "돌아가기"를 보여 줍니다. 없으면 그리지 않습니다. */
  onBack?: () => void;
};

async function readDeviceVoices(): Promise<SpeechVoiceLike[]> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices.map((voice) => ({
      identifier: voice.identifier,
      name: voice.name,
      language: voice.language,
      quality: String(voice.quality ?? ''),
    }));
  } catch {
    return [];
  }
}

/** 안드로이드 음성 설정을 엽니다. 열리지 않으면 이 앱의 설정 화면으로 보냅니다. */
async function openVoiceSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Linking.sendIntent(androidVoiceSettingsIntent);
      return;
    } catch {
      // 아래 폴백으로 넘어갑니다.
    }
  }
  try {
    await Linking.openSettings();
  } catch {
    // 설정을 열 수 없는 기기라면 화면의 안내 문구만 보고 따라가면 됩니다.
  }
}

export function VoicePickerScreen({ onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [voices, setVoices] = useState<RankedVoice[]>([]);
  const [report, setReport] = useState<VoiceQualityReport | undefined>(undefined);
  const [pick, setPick] = useState<CoachVoicePick>(defaultCoachVoicePick);
  const [speakingId, setSpeakingId] = useState<string | undefined>(undefined);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void Speech.stop();
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const device = await readDeviceVoices();
    const stored = await loadCoachVoicePick();
    if (!mounted.current) return;
    setVoices(rankKoreanVoices(device));
    setReport(koreanVoiceQuality(device));
    setPick(reconcileVoicePick(stored, device));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const speakWith = useCallback((next: CoachVoicePick) => {
    void Speech.stop();
    setSpeakingId(next.identifier ?? 'auto');
    Speech.speak(toSpeech(voicePreviewSentence), {
      language: 'ko-KR',
      rate: next.rate,
      pitch: next.pitch,
      ...(next.identifier ? { voice: next.identifier } : {}),
      onDone: () => setSpeakingId(undefined),
      onStopped: () => setSpeakingId(undefined),
      onError: () => setSpeakingId(undefined),
    });
  }, []);

  const choose = useCallback(
    (identifier: string) => {
      const next: CoachVoicePick = { ...pick, identifier };
      setPick(next);
      void saveCoachVoicePick(next);
      speakWith(next);
    },
    [pick, speakWith],
  );

  const tune = useCallback(
    (patch: Partial<CoachVoicePick>) => {
      const next: CoachVoicePick = { ...pick, ...patch };
      setPick(next);
      void saveCoachVoicePick(next);
      // 조절한 값이 어떻게 들리는지 바로 확인할 수 있게 다시 들려줍니다.
      speakWith(next);
    },
    [pick, speakWith],
  );

  const showInstallCard = report?.suggestInstall === true;

  return (
    <ScrollView
      contentContainerStyle={screenStyles.content}
      showsVerticalScrollIndicator={false}
      style={screenStyles.root}
    >
      {onBack ? (
        <View style={styles.backRow}>
          <Button
            accessibilityHint="바로 앞에 보던 화면으로 돌아가요."
            label="← 돌아가기"
            onPress={onBack}
            style={styles.backButton}
            tone="quiet"
          />
        </View>
      ) : null}

      <SectionHeader title={voicePickerScreenTitle} subtitle={voicePickerScreenSubtitle} />

      {report ? (
        <Banner
          body={report.detail}
          title={report.headline}
          tone={report.level === 'good' ? 'positive' : 'warning'}
        />
      ) : null}

      {showInstallCard ? (
        <Card style={styles.installCard} tone="warm">
          <Text accessibilityRole="header" style={styles.cardTitle}>
            더 자연스러운 목소리 받는 방법
          </Text>
          <Text style={styles.cardBody}>
            아래 순서대로 하면 무료로 받을 수 있어요. 한 번만 해 두면 계속 쓸 수 있어요.
          </Text>
          {voiceInstallSteps.map((step, index) => (
            <View key={step} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
          <Button
            accessibilityHint="휴대폰의 목소리 설정 화면을 열어요."
            label="휴대폰 목소리 설정 열기"
            onPress={() => void openVoiceSettings()}
            style={styles.installButton}
          />
          <Text style={styles.cardQuiet}>
            설정에서 목소리를 받은 뒤 이 화면으로 돌아와 아래 "목소리 다시 찾기"를 눌러 주세요.
          </Text>
        </Card>
      ) : null}

      <View style={styles.listHeaderRow}>
        <SectionHeader
          compact
          title="이 기기의 한국어 목소리"
          subtitle={
            loading
              ? '목소리를 찾는 중이에요.'
              : `${voices.length}개를 찾았어요. 들어 보고 골라 주세요.`
          }
        />
      </View>

      <Button
        accessibilityHint="목소리를 새로 받았다면 눌러서 목록을 새로고침해요."
        label="목소리 다시 찾기"
        onPress={() => void refresh()}
        tone="secondary"
      />

      {!loading && voices.length === 0 ? (
        <Card style={styles.emptyCard} tone="muted">
          <Text style={styles.cardTitle}>아직 고를 목소리가 없어요</Text>
          <Text style={styles.cardBody}>
            한국어로 말해 줄 목소리를 찾지 못했어요. 위의 순서대로 목소리를 받은 뒤 "목소리 다시
            찾기"를 눌러 주세요.
          </Text>
        </Card>
      ) : null}

      {voices.map((voice) => {
        const selected = pick.identifier === voice.identifier;
        return (
          <Card
            key={voice.identifier}
            accessibilityLabel={`${voice.label}. ${voice.note}`}
            style={[styles.voiceCard, selected && styles.voiceCardSelected]}
            tone={selected ? 'warm' : 'default'}
          >
            <View style={styles.voiceHeader}>
              <View style={styles.voiceCopy}>
                <Text style={styles.voiceLabel}>{voice.label}</Text>
                <Text style={styles.voiceNote}>{voice.note}</Text>
              </View>
              <Chip
                label={voiceTierLabels[voice.tier]}
                tone={
                  voice.tier === 'onlineNatural' || voice.tier === 'offlineNatural'
                    ? 'positive'
                    : 'neutral'
                }
              />
            </View>
            <Text style={styles.voiceSample}>“{voicePreviewSentence}”</Text>
            <View style={styles.voiceActions}>
              <Button
                accessibilityHint="이 목소리로 코치 문장을 들려줘요."
                label={speakingId === voice.identifier ? '들려주는 중…' : '미리 듣기'}
                onPress={() => speakWith({ ...pick, identifier: voice.identifier })}
                style={styles.voiceAction}
                tone="secondary"
              />
              <Button
                accessibilityHint="이 목소리로 코치가 말하게 해요."
                label={selected ? '고른 목소리' : '이 목소리로 하기'}
                onPress={() => choose(voice.identifier)}
                style={styles.voiceAction}
                tone={selected ? 'quiet' : 'primary'}
              />
            </View>
          </Card>
        );
      })}

      <Card style={styles.tuneCard}>
        <Text accessibilityRole="header" style={styles.cardTitle}>
          빠르기와 높낮이
        </Text>
        <Text style={styles.cardBody}>
          손잡이를 옮기면 바로 다시 들려줘요. 달리면서 듣기 편한 자리를 찾아 주세요.
        </Text>

        <View style={styles.tuneRow}>
          <Text style={styles.tuneLabel}>빠르기</Text>
          <Text style={styles.tuneValue}>{pick.rate.toFixed(2)}배</Text>
        </View>
        <Slider
          accessibilityLabel="말하는 빠르기"
          maximumTrackTintColor={palette.line}
          maximumValue={voiceRateRange.max}
          minimumTrackTintColor={palette.accent}
          minimumValue={voiceRateRange.min}
          onSlidingComplete={(value) => tune({ rate: Number(value.toFixed(2)) })}
          step={voiceRateRange.step}
          thumbTintColor={palette.accent}
          value={pick.rate}
        />
        <View style={styles.rangeRow}>
          <Text style={styles.range}>느리게</Text>
          <Text style={styles.range}>빠르게</Text>
        </View>

        <View style={styles.tuneRow}>
          <Text style={styles.tuneLabel}>높낮이</Text>
          <Text style={styles.tuneValue}>{pick.pitch.toFixed(2)}</Text>
        </View>
        <Slider
          accessibilityLabel="목소리 높낮이"
          maximumTrackTintColor={palette.line}
          maximumValue={voicePitchRange.max}
          minimumTrackTintColor={palette.accent}
          minimumValue={voicePitchRange.min}
          onSlidingComplete={(value) => tune({ pitch: Number(value.toFixed(2)) })}
          step={voicePitchRange.step}
          thumbTintColor={palette.accent}
          value={pick.pitch}
        />
        <View style={styles.rangeRow}>
          <Text style={styles.range}>낮게</Text>
          <Text style={styles.range}>높게</Text>
        </View>

        <Button
          accessibilityHint="지금 설정으로 코치 문장을 들려줘요."
          label="지금 설정으로 들어 보기"
          onPress={() => speakWith(pick)}
          tone="secondary"
        />
      </Card>

      <Text style={styles.footNote}>
        고른 목소리는 이 화면에서만 따로 저장돼요. 다른 설정은 그대로 둡니다.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backRow: { alignItems: 'flex-start' },
  backButton: { minHeight: layout.touchTarget },
  installCard: { gap: spacing.xs },
  installButton: { marginTop: spacing.xs },
  emptyCard: { gap: spacing.xs },
  listHeaderRow: { marginTop: spacing.sm },
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
  cardQuiet: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  stepRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  stepNumber: {
    color: palette.white,
    backgroundColor: palette.accentStrong,
    borderRadius: radius.pill,
    minWidth: 22,
    textAlign: 'center',
    fontSize: typeScale.caption,
    lineHeight: 22,
    fontWeight: fontWeight.bold,
    overflow: 'hidden',
  },
  stepText: {
    flex: 1,
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  voiceCard: { gap: spacing.xs },
  voiceCardSelected: {
    borderColor: palette.accentStrong,
    borderWidth: borderWidth.emphasis,
  },
  voiceHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  voiceCopy: { flex: 1, gap: 2 },
  voiceLabel: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
  },
  voiceNote: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  voiceSample: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  voiceActions: { flexDirection: 'row', gap: spacing.xs },
  voiceAction: { flex: 1, minHeight: layout.touchTarget },
  tuneCard: { gap: spacing.xs, marginTop: spacing.sm },
  tuneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  tuneLabel: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.semibold,
  },
  tuneValue: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  range: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  footNote: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    marginTop: spacing.sm,
  },
});
