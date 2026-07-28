// 코치를 고르는 카드입니다. 설정 화면에 놓입니다.
//
// 왜 미리듣기 문장을 반드시 같이 보여 주는가:
//   "잔소리 폼 코치"라는 이름만으로는 그 코치가 나에게 어떻게 말할지 알 수 없습니다.
//   골라 보고, 달려 보고, 실망하고, 다시 설정에 들어오는 일이 반복됩니다.
//   **고르기 전에 실제로 나올 문장을 보여 주면** 그 왕복이 사라집니다.
//   그래서 말투(존댓말·반말)를 바꾸면 미리듣기 문장도 그 자리에서 바뀝니다.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../design-system/components';
import { palette, radius, spacing, typeScale } from '../../design-system/theme';
import {
  coachPersonas,
  densityDescriptions,
  densityLabels,
  registerExamples,
  registerLabels,
  type CoachDensity,
  type CoachSettings,
  type SpeechRegister,
} from '../../../domains/coaching/persona';

const densities: CoachDensity[] = ['essential', 'balanced', 'close-coach', 'full-talk'];
const registers: SpeechRegister[] = ['honorific', 'casual'];

export type CoachPersonaCardProps = {
  settings: CoachSettings;
  /** 성인 확인을 통과했는지입니다. 통과 못 하면 매운맛은 목록에 없습니다. */
  adultConfirmed: boolean;
  onChange: (patch: Partial<CoachSettings>) => void;
};

export function CoachPersonaCard({ settings, adultConfirmed, onChange }: CoachPersonaCardProps) {
  // 성인 확인이 없으면 매운맛은 아예 보이지 않습니다.
  // 잠긴 채로 보여 주면 오히려 눌러 보게 만듭니다.
  const visible = coachPersonas.filter((persona) => !persona.adultOnly || adultConfirmed);
  const selected = visible.find((persona) => persona.id === settings.personaId) ?? visible[0];

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>어떤 코치가 좋으세요?</Text>

      <View style={styles.list}>
        {visible.map((persona) => {
          const on = persona.id === settings.personaId;
          return (
            <Pressable
              accessibilityLabel={`${persona.name}. ${persona.summary}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              key={persona.id}
              onPress={() =>
                onChange({
                  personaId: persona.id,
                  register: persona.defaultRegister,
                  density: persona.defaultDensity,
                })
              }
              style={[styles.row, on && styles.rowOn]}
            >
              <Text style={[styles.name, on && styles.nameOn]}>{persona.name}</Text>
              <Text style={styles.summary}>{persona.summary}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>말투</Text>
      <View style={styles.chips}>
        {registers.map((register) => {
          const on = register === settings.register;
          return (
            <Pressable
              accessibilityLabel={`${registerLabels[register]}. 예를 들면, ${registerExamples[register]}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              key={register}
              onPress={() => onChange({ register })}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {registerLabels[register]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 고르기 전에 실제로 나올 문장을 보여 줍니다. */}
      <View style={styles.preview}>
        <Text style={styles.previewLabel}>이렇게 말해요</Text>
        <Text style={styles.previewText}>{selected?.sample[settings.register]}</Text>
      </View>

      <Text style={styles.label}>얼마나 말할까요</Text>
      <View style={styles.chips}>
        {densities.map((density) => {
          const on = density === settings.density;
          return (
            <Pressable
              accessibilityLabel={`${densityLabels[density]}. ${densityDescriptions[density]}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              key={density}
              onPress={() => onChange({ density })}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {densityLabels[density]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.note}>{densityDescriptions[settings.density]}</Text>

      {/* 우리가 볼 수 없다는 사실을 숨기지 않습니다. */}
      <Text style={styles.note}>
        코치는 자세를 보지 못해요. 대신 확인할 곳을 짚어 주고, 아프면 언제든 멈춰도 됩니다.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  title: { color: palette.ink, fontSize: typeScale.titleSmall, fontWeight: '800' },
  list: { gap: spacing.xs },
  row: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  rowOn: { borderColor: palette.accent, borderWidth: 2 },
  name: { color: palette.ink, fontSize: typeScale.body, fontWeight: '800' },
  nameOn: { color: palette.accent },
  summary: { color: palette.muted, fontSize: typeScale.caption, fontWeight: '600' },
  label: { color: palette.ink, fontSize: typeScale.caption, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  chipOn: { backgroundColor: palette.accentStrong, borderColor: palette.accentStrong },
  chipText: { color: palette.ink, fontSize: typeScale.caption, fontWeight: '700' },
  chipTextOn: { color: palette.surface },
  preview: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceMuted,
    borderColor: palette.line,
    borderWidth: 1,
    gap: spacing.xs,
  },
  previewLabel: { color: palette.muted, fontSize: typeScale.caption, fontWeight: '800' },
  previewText: { color: palette.ink, fontSize: typeScale.body, fontWeight: '600', lineHeight: 22 },
  note: { color: palette.muted, fontSize: typeScale.caption, fontWeight: '600', lineHeight: 18 },
});
