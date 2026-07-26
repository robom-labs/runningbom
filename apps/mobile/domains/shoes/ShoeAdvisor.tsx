// "내게 맞는 러닝화 찾기" 마법사 화면입니다.
// 3~4개 질문에 답하면 카탈로그를 걸러 상위 5~8종과 한 줄 근거를 보여 줍니다.
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip } from '../../app/design-system/components';
import { palette, spacing, typeScale } from '../../app/design-system/theme';
import {
  ADVISOR_MAX_RESULTS,
  advisorQuestions,
  recommendShoeEntries,
  type AdvisorAnswers,
} from './advisor';
import { ShoeCard } from './ShoeCard';

type PartialAnswers = Partial<AdvisorAnswers>;

function isComplete(answers: PartialAnswers): answers is AdvisorAnswers {
  return advisorQuestions.every((question) => answers[question.key] !== undefined);
}

export function ShoeAdvisor({
  savedIds,
  compareIds,
  onBack,
  onOpenShoe,
  onToggleCompare,
}: {
  savedIds: string[];
  compareIds: string[];
  onBack: () => void;
  onOpenShoe: (id: string) => void;
  onToggleCompare: (id: string) => void;
}) {
  const [answers, setAnswers] = useState<PartialAnswers>({});
  const complete = isComplete(answers);
  const results = useMemo(
    () => (isComplete(answers) ? recommendShoeEntries(answers, undefined, ADVISOR_MAX_RESULTS) : []),
    [answers],
  );
  const answeredCount = advisorQuestions.filter(
    (question) => answers[question.key] !== undefined,
  ).length;

  return (
    <View style={styles.container}>
      <Button label="목록으로" onPress={onBack} tone="quiet" />

      <Card style={styles.intro}>
        <Text accessibilityRole="header" style={styles.title}>
          내게 맞는 러닝화 찾기
        </Text>
        <Text style={styles.note}>
          아래 {advisorQuestions.length}개 질문에 답하면 카탈로그에서 조건에 맞는 러닝화를 골라 줘요.
          추천은 카탈로그 분류(용도·거리·실력·가격대)만 근거로 하고, 발 상태를 진단하지는 않아요.
        </Text>
        <Text style={styles.progress}>
          {answeredCount} / {advisorQuestions.length} 답변 완료
        </Text>
      </Card>

      {advisorQuestions.map((question) => (
        <Card key={question.key} style={styles.block}>
          <Text style={styles.blockTitle}>{question.title}</Text>
          <Text style={styles.note}>{question.help}</Text>
          <View style={styles.chipWrap}>
            {question.options.map((option) => (
              <Chip
                key={String(option.value)}
                label={option.label}
                selected={answers[question.key] === option.value}
                onPress={() =>
                  setAnswers((current) => ({ ...current, [question.key]: option.value }))
                }
                tone="accent"
              />
            ))}
          </View>
          <Text style={styles.hint}>
            {question.options
              .filter((option) => answers[question.key] === option.value)
              .map((option) => option.hint)
              .join('') || question.options.map((option) => option.hint).join(' / ')}
          </Text>
        </Card>
      ))}

      {complete ? (
        <View style={styles.results}>
          <Card style={styles.resultHeader}>
            <Text style={styles.blockTitle}>이 조건이면 이 {results.length}켤레를 보세요</Text>
            <Text style={styles.note}>
              한 브랜드가 목록을 독차지하지 않도록 브랜드당 최대 2종까지만 보여 줘요. 최종 선택 전에
              매장 착화를 권해요.
            </Text>
            <Button label="답변 다시 하기" onPress={() => setAnswers({})} tone="secondary" />
          </Card>
          {results.map((result) => (
            <View key={result.shoe.id} style={styles.resultItem}>
              <Text style={styles.reason}>{result.reason}</Text>
              <ShoeCard
                shoe={result.shoe}
                saved={savedIds.includes(result.shoe.id)}
                compareSelected={compareIds.includes(result.shoe.id)}
                onPress={() => onOpenShoe(result.shoe.id)}
                onToggleCompare={() => onToggleCompare(result.shoe.id)}
              />
            </View>
          ))}
          {results.length === 0 ? (
            <Card style={styles.block}>
              <Text style={styles.note}>
                조건에 맞는 러닝화를 찾지 못했어요. 예산이나 거리 답변을 바꿔 다시 시도해 주세요.
              </Text>
            </Card>
          ) : null}
        </View>
      ) : (
        <Card style={styles.block}>
          <Text style={styles.note}>
            남은 질문에 답하면 추천 목록이 여기에 나타나요.
          </Text>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, paddingBottom: spacing.xxl },
  intro: { gap: spacing.sm, backgroundColor: palette.surfaceWarm },
  title: { color: palette.ink, fontSize: typeScale.title, fontWeight: '900' },
  block: { gap: spacing.sm },
  blockTitle: { color: palette.ink, fontSize: typeScale.titleSmall, fontWeight: '900' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  note: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 18 },
  hint: { color: palette.inkSoft, fontSize: typeScale.caption, lineHeight: 18 },
  progress: { color: palette.inkSoft, fontSize: typeScale.bodySmall, fontWeight: '800' },
  results: { gap: spacing.md },
  resultHeader: { gap: spacing.sm, backgroundColor: palette.surfaceWarm },
  resultItem: { gap: spacing.xs },
  reason: { color: palette.accent, fontSize: typeScale.caption, fontWeight: '800', lineHeight: 18 },
});
