// 나에게 맞는 훈련 계획을 고르는 곳입니다.
//
// 계획이 여러 개여도 처음부터 전부 늘어놓지 않습니다.
//   1) 지금 어느 정도인지 고르고
//   2) 그에 맞는 세 개를 먼저 보여 주고
//   3) 더 보고 싶을 때만 전체를 폅니다.
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, SectionHeader } from '../../design-system/components';
import {
  borderWidth,
  fontWeight,
  lineHeight,
  palette,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';
import {
  availableFamilies,
  categoryLabels,
  checkEligibility,
  programFamilies,
  recommendFamilies,
  type ProgramFamily,
} from '../../../domains/programs/catalog';
import {
  decideLevel,
  levelLabels,
  selfPickLevels,
  type RunnerCapability,
  type UserLevelId,
} from '../../../domains/programs/level';

export type PlanPickerProps = {
  /** 지금 하고 있는 계획입니다. */
  activePlanId: string;
  /** 최근 기록에서 뽑아낸 재료입니다. 없으면 빈 객체를 넘깁니다. */
  capability: RunnerCapability;
  onChoose: (planId: string) => void;
};

export function PlanPicker({ activePlanId, capability, onChoose }: PlanPickerProps) {
  const [selfPick, setSelfPick] = useState<UserLevelId | undefined>(undefined);
  const [showAll, setShowAll] = useState(false);

  const decision = useMemo(() => decideLevel(selfPick, capability), [capability, selfPick]);
  const recommended = useMemo(
    () => recommendFamilies(decision.level, capability),
    [capability, decision.level],
  );
  const available = useMemo(
    () => availableFamilies(decision.level, capability),
    [capability, decision.level],
  );

  const shown = showAll ? programFamilies : recommended;

  return (
    <View style={styles.root}>
      <SectionHeader
        subtitle="고른 내용과 최근 기록을 함께 보고 골라 드려요."
        title="지금 어느 정도인가요?"
      />

      <View accessibilityRole="radiogroup" style={styles.levelRow}>
        {selfPickLevels.map((level) => {
          const picked = selfPick === level;
          return (
            <Pressable
              accessibilityLabel={levelLabels[level]}
              accessibilityRole="radio"
              accessibilityState={{ selected: picked }}
              key={level}
              onPress={() => setSelfPick(picked ? undefined : level)}
              style={[styles.levelChip, picked && styles.levelChipOn]}
            >
              <Text style={[styles.levelText, picked && styles.levelTextOn]}>
                {levelLabels[level]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.reason}>{decision.reason}</Text>

      <SectionHeader
        subtitle={
          showAll
            ? `전체 ${programFamilies.length}개 중 지금 시작할 수 있는 건 ${available.length}개예요.`
            : '지금 바로 시작할 수 있는 것만 골랐어요.'
        }
        title={showAll ? '전체 계획' : '나에게 맞는 계획'}
      />

      {shown.map((family) => (
        <PlanCard
          activePlanId={activePlanId}
          capability={capability}
          family={family}
          key={family.id}
          level={decision.level}
          onChoose={onChoose}
        />
      ))}

      <Button
        label={showAll ? '추천만 보기' : '전체 계획 보기'}
        onPress={() => setShowAll((value) => !value)}
        tone="quiet"
      />
    </View>
  );
}

type PlanCardProps = {
  family: ProgramFamily;
  level: UserLevelId;
  capability: RunnerCapability;
  activePlanId: string;
  onChoose: (planId: string) => void;
};

function PlanCard({ activePlanId, capability, family, level, onChoose }: PlanCardProps) {
  const eligibility = checkEligibility(family, level, capability);
  const current = family.id === activePlanId;

  return (
    <Card style={styles.card} tone={current ? 'warm' : 'default'}>
      <Text style={styles.category}>{categoryLabels[family.category]}</Text>
      <Text style={styles.title}>{family.title}</Text>
      <Text style={styles.subtitle}>{family.subtitle}</Text>
      <Text style={styles.description}>{family.description}</Text>

      {current ? (
        <Text style={styles.current}>지금 하고 있는 계획이에요.</Text>
      ) : eligibility.allowed ? (
        <Button label="이 계획 시작하기" onPress={() => onChoose(family.id)} size="lg" />
      ) : (
        // 막을 때도 왜 막는지, 무엇을 먼저 하면 되는지 알려 줍니다.
        <Text style={styles.blocked}>{eligibility.reason}</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  levelChip: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  levelChipOn: { backgroundColor: palette.accentSoft, borderColor: palette.accent },
  levelText: { color: palette.inkSoft, fontSize: typeScale.bodySmall },
  levelTextOn: { color: palette.accentDark, fontWeight: fontWeight.bold },
  reason: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  card: { gap: spacing.xxs },
  category: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    fontWeight: fontWeight.bold,
  },
  title: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.bold,
  },
  subtitle: { color: palette.muted, fontSize: typeScale.caption },
  description: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    paddingBottom: spacing.xxs,
  },
  current: {
    color: palette.accentDark,
    fontSize: typeScale.bodySmall,
    fontWeight: fontWeight.bold,
  },
  blocked: {
    color: palette.muted,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
});
