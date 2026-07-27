// 달리는 중 경험(자동 멈춤·칼로리·기록 안내·야간 모드·시작 카운트다운) 설정 묶음입니다.
// 설정 화면(SettingsScreen)에서 이 컴포넌트 하나만 끼워 넣으면 그대로 붙습니다.
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Chip, SectionHeader } from '../../design-system/components';
import {
  fontWeight,
  layout,
  lineHeight,
  palette,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';
import {
  speedIndependenceNote,
  weightMissingNotice,
} from '../../../domains/activities/calories';
import {
  liveStatsModeDescriptions,
  liveStatsModeLabels,
  liveStatsModes,
  liveStatsIntervalChoices,
} from '../../../domains/coaching/liveStats';
import {
  autoPauseLevels,
  autoPauseSpeedSummary,
  autoPauseTunings,
  useRunPreferences,
} from '../../../domains/tracking';
import {
  countdownChoices,
  nightModeDescriptions,
  nightModeLabels,
  nightModeSettings,
  parseWeightInput,
  weightRangeNotice,
} from '../../../services/storage/runPreferences';
import { countdownHelpText } from '../start/countdown';
import { nightModeStatusText } from '../start/nightMode';

export function RunSettingsSection() {
  const { preferences, update } = useRunPreferences();
  const [weightInput, setWeightInput] = useState('');
  const [weightError, setWeightError] = useState('');
  const [weightSaved, setWeightSaved] = useState('');

  const savedWeight = preferences.weightKg;

  function saveWeight() {
    const value = parseWeightInput(weightInput);
    if (value === undefined) {
      setWeightSaved('');
      setWeightError(weightRangeNotice);
      return;
    }
    setWeightError('');
    setWeightSaved(`${value}kg으로 저장했어요.`);
    setWeightInput('');
    void update({ weightKg: value });
  }

  function clearWeight() {
    setWeightError('');
    setWeightSaved('몸무게를 지웠어요. 이제 칼로리를 보여 주지 않아요.');
    setWeightInput('');
    void update({ weightKg: undefined });
  }

  return (
    <>
      <SectionHeader
        title="달리는 중"
        subtitle="달리는 동안 화면과 음성이 어떻게 움직일지 정해요."
      />

      <Card style={styles.card}>
        <SettingLabel
          title="자동 멈춤"
          description="신호등에서 멈추면 기록도 같이 멈추고, 다시 달리면 이어서 쌓여요."
        />
        <View accessibilityRole="radiogroup" style={styles.chips}>
          {autoPauseLevels.map((level) => (
            <Chip
              key={level}
              label={autoPauseTunings[level].label}
              onPress={() => void update({ autoPause: level })}
              selected={preferences.autoPause === level}
              tone="accent"
            />
          ))}
        </View>
        <Text style={styles.rowMeta}>{autoPauseTunings[preferences.autoPause].description}</Text>
        <Text style={styles.rowStrong}>{autoPauseSpeedSummary(preferences.autoPause)}</Text>
        <View style={styles.table}>
          {autoPauseLevels
            .filter((level) => level !== 'off')
            .map((level) => (
              <Text key={level} style={styles.rowMeta}>
                {autoPauseTunings[level].label} · 멈춤 시속 {autoPauseTunings[level].pauseSpeedKmh}
                km · 다시 시작 시속 {autoPauseTunings[level].resumeSpeedKmh}km
              </Text>
            ))}
          <Text style={styles.rowMeta}>
            신호를 못 받는 동안에는 멈추지 않고 &quot;신호를 찾는 중&quot;이라고만 알려 줘요.
          </Text>
        </View>
      </Card>

      <Card style={styles.card}>
        <SettingLabel
          title="몸무게"
          description="칼로리를 계산할 때만 써요. 키·나이·성별은 필요하지 않아요."
        />
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="몸무게(킬로그램)"
            inputMode="decimal"
            maxLength={5}
            onChangeText={(value) => {
              setWeightInput(value);
              setWeightError('');
              setWeightSaved('');
            }}
            onSubmitEditing={saveWeight}
            placeholder={savedWeight === undefined ? '예: 62' : String(savedWeight)}
            returnKeyType="done"
            style={styles.input}
            value={weightInput}
          />
          <Button label="저장" onPress={saveWeight} tone="secondary" />
        </View>
        {weightError ? <Text style={styles.errorText}>{weightError}</Text> : null}
        {weightSaved ? (
          <Text accessibilityLiveRegion="polite" style={styles.statusText}>
            {weightSaved}
          </Text>
        ) : null}
        <Text style={styles.rowMeta}>
          {savedWeight === undefined
            ? weightMissingNotice
            : `지금은 ${savedWeight}kg으로 계산해요.`}
        </Text>
        <Text style={styles.rowMeta}>{speedIndependenceNote}</Text>
        {savedWeight === undefined ? null : (
          <Button label="몸무게 지우기" onPress={clearWeight} tone="quiet" />
        )}
      </Card>

      <Card style={styles.card}>
        <SettingLabel
          title="지금 기록 알려 주기"
          description="달린 거리와 페이스를 숫자만 읽지 않고 한 마디 해석을 붙여 말해 줘요."
        />
        <View accessibilityRole="radiogroup" style={styles.chips}>
          {liveStatsModes.map((mode) => (
            <Chip
              key={mode}
              label={liveStatsModeLabels[mode]}
              onPress={() => void update({ liveStats: mode })}
              selected={preferences.liveStats === mode}
              tone="accent"
            />
          ))}
        </View>
        <Text style={styles.rowMeta}>{liveStatsModeDescriptions[preferences.liveStats]}</Text>
        {preferences.liveStats === 'time' || preferences.liveStats === 'both' ? (
          <>
            <SettingLabel title="말해 주는 간격" description="몇 분마다 말해 줄지 정해요." />
            <View accessibilityRole="radiogroup" style={styles.chips}>
              {liveStatsIntervalChoices.map((value) => (
                <Chip
                  key={value}
                  label={`${value}분마다`}
                  onPress={() => void update({ liveStatsMinutes: value })}
                  selected={preferences.liveStatsMinutes === value}
                  tone="accent"
                />
              ))}
            </View>
          </>
        ) : null}
        <Text style={styles.rowMeta}>
          예: &quot;2.4km 지났어요. 평균 5분 42초, 방금 1km는 8초 빨랐어요.&quot;
        </Text>
      </Card>

      <Card style={styles.card}>
        <SettingLabel
          title="야간 모드"
          description="달리는 화면만 어둡게 해요. 다른 화면 색은 그대로예요."
        />
        <View accessibilityRole="radiogroup" style={styles.chips}>
          {nightModeSettings.map((value) => (
            <Chip
              key={value}
              label={nightModeLabels[value]}
              onPress={() => void update({ nightMode: value })}
              selected={preferences.nightMode === value}
              tone="accent"
            />
          ))}
        </View>
        <Text style={styles.rowMeta}>{nightModeDescriptions[preferences.nightMode]}</Text>
        <Text style={styles.rowStrong}>{nightModeStatusText(preferences.nightMode)}</Text>
      </Card>

      <Card style={styles.card}>
        <SettingLabel
          title="시작 카운트다운"
          description="시작을 누른 뒤 몇 초를 세고 출발할지 정해요. 숫자는 음성으로도 세어 줘요."
        />
        <View accessibilityRole="radiogroup" style={styles.chips}>
          {countdownChoices.map((value) => (
            <Chip
              key={value}
              label={`${value}초`}
              onPress={() => void update({ countdownSeconds: value })}
              selected={preferences.countdownSeconds === value}
              tone="accent"
            />
          ))}
        </View>
        <Text style={styles.rowMeta}>{countdownHelpText(preferences.countdownSeconds)}</Text>
      </Card>
    </>
  );
}

function SettingLabel({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.settingLabel}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowMeta}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  settingLabel: { gap: spacing.xxs / 2 },
  table: { gap: spacing.xxs / 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: layout.touchTarget,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
    color: palette.ink,
    fontSize: typeScale.body,
    paddingHorizontal: spacing.md,
  },
  rowTitle: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.bold,
  },
  rowMeta: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  rowStrong: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.semibold,
  },
  errorText: {
    color: palette.danger,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  statusText: {
    color: palette.positive,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
});
