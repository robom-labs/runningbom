// 보조 프로젝트를 한 단계씩 해 나가는 곳입니다.
//
// 훈련과 달리 시간을 재지 않습니다. 며칠에 걸쳐 하나씩 챙기고 "했어요"를 누릅니다.
// 벌여 놓기만 하지 않도록, 하던 것을 먼저 보여 주고 다음 단계 하나만 강조합니다.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, ProgressBar, SectionHeader } from '../../design-system/components';
import {
  borderWidth,
  fontWeight,
  lineHeight,
  palette,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';
import { projectCategoryLabels, type ProjectProgress } from '../../../domains/projects/library';

export type ProjectBoardProps = {
  items: ProjectProgress[];
  onToggleStep: (stepId: string) => void;
};

export function ProjectBoard({ items, onToggleStep }: ProjectBoardProps) {
  if (items.length === 0) return null;

  return (
    <View style={styles.root}>
      <SectionHeader
        subtitle="달리기 말고, 달리기를 더 잘하게 해 주는 것들이에요. 하루에 하나씩이면 돼요."
        title="같이 챙기면 좋은 것"
      />
      {items.map((item) => (
        <ProjectRow item={item} key={item.project.id} onToggleStep={onToggleStep} />
      ))}
    </View>
  );
}

function ProjectRow({
  item,
  onToggleStep,
}: {
  item: ProjectProgress;
  onToggleStep: (stepId: string) => void;
}) {
  return (
    <Card style={styles.card} tone={item.finished ? 'warm' : 'default'}>
      <Text style={styles.category}>{projectCategoryLabels[item.project.category]}</Text>
      <Text style={styles.title}>{item.project.title}</Text>
      <Text style={styles.description}>{item.project.description}</Text>

      <ProgressBar
        label={`${item.project.title} ${item.label}`}
        ratio={item.ratio}
        tone={item.finished ? 'positive' : 'accent'}
      />
      <Text style={styles.count}>{item.label}</Text>

      {item.finished ? (
        <Text style={styles.done}>다 했어요. 이건 이제 몸이 기억할 거예요.</Text>
      ) : null}

      {item.project.steps.map((step) => {
        const checked = item.doneStepIds.includes(step.id);
        // 다음에 할 단계 하나만 눈에 띄게 합니다. 다섯 개가 똑같이 보이면 시작하기 어렵습니다.
        const isNext = item.nextStep?.id === step.id;
        return (
          <Pressable
            accessibilityLabel={`${step.title} ${checked ? '했음' : '아직'}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            key={step.id}
            onPress={() => onToggleStep(step.id)}
            style={[styles.step, isNext && styles.stepNext]}
          >
            <View style={[styles.box, checked && styles.boxOn]}>
              {checked ? <Text style={styles.check}>✓</Text> : null}
            </View>
            <View style={styles.stepBody}>
              <Text style={[styles.stepTitle, checked && styles.stepTitleDone]}>{step.title}</Text>
              <Text style={styles.stepDetail}>{step.detail}</Text>
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
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
  description: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    paddingBottom: spacing.xxs,
  },
  count: {
    color: palette.muted,
    fontSize: typeScale.caption,
    paddingBottom: spacing.xxs,
  },
  done: {
    color: palette.accentDark,
    fontSize: typeScale.bodySmall,
    fontWeight: fontWeight.bold,
    paddingBottom: spacing.xxs,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    minHeight: 48,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
  },
  stepNext: { backgroundColor: palette.accentSoft },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxOn: { backgroundColor: palette.accent, borderColor: palette.accent },
  check: { color: palette.surface, fontSize: typeScale.caption, fontWeight: fontWeight.bold },
  stepBody: { flex: 1, gap: 2 },
  stepTitle: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    fontWeight: fontWeight.bold,
  },
  stepTitleDone: { color: palette.muted },
  stepDetail: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
});
