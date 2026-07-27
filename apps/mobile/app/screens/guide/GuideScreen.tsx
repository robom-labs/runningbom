// "러닝 궁금증" 화면입니다.
//
// 왜 커뮤니티에서 떼어 냈나
// - 예전에는 커뮤니티를 열면 이 안내 글 묶음이 가장 먼저 나왔습니다. 그런데 이 글들은
//   사람들이 올린 글이 아니라 앱이 미리 써 둔 안내입니다. 사람이 모이는 곳과 앱이
//   알려 주는 곳이 한 화면에 섞여 있어서 "여기가 뭐 하는 곳인지" 알 수 없었습니다.
// - 그래서 앱이 알려 주는 쪽은 이 화면으로, 사람이 올리는 쪽은 커뮤니티로 나눴습니다.
//
// 라우팅은 부모가 합니다. 이 화면은 onBack·onNavigate를 받기만 합니다.
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, screenStyles, SectionHeader } from '../../design-system/components';
import { fontWeight, layout, lineHeight, palette, spacing, typeScale } from '../../design-system/theme';
import type { RouteKey } from '../../navigation/types';
import { knowledgeCards } from './knowledge';
import { KnowledgeSection } from './KnowledgeSection';

/** 화면 이름입니다. 문구를 한곳에서 바꿀 수 있게 상수로 둡니다. */
export const guideScreenTitle = '러닝 궁금증';
export const guideScreenSubtitle = '앱이 알려 주는 러닝 안내 코너예요';

type Props = {
  /** 있으면 맨 위에 "돌아가기"를 보여 줍니다. 없으면 그리지 않습니다. */
  onBack?: () => void;
  /** 안내 글 안에서 러닝화·대회 같은 관련 화면으로 바로 이동할 때 씁니다. */
  onNavigate?: (route: RouteKey) => void;
};

export function GuideScreen({ onBack, onNavigate }: Props) {
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

      <SectionHeader title={guideScreenTitle} subtitle={guideScreenSubtitle} />

      <Card style={styles.noteCard} tone="muted">
        <Text style={styles.noteTitle}>여기는 어떤 곳인가요?</Text>
        <Text style={styles.noteBody}>
          러닝을 하다 보면 생기는 궁금증에 러닝봄이 미리 답을 적어 둔 곳이에요. 글 {knowledgeCards.length}개가
          앱 안에 들어 있어서 인터넷이 없어도 읽을 수 있어요.
        </Text>
        <Text style={styles.noteBody}>
          사람들이 서로 이야기를 나누는 곳은 커뮤니티예요. 여기는 앱이 알려 주는 곳, 커뮤니티는
          사람이 올리는 곳으로 나눠 두었어요.
        </Text>
        <Text style={styles.noteQuiet}>
          몸이 아프거나 이상한 느낌이 들 때의 안내는 일반적인 참고 정보예요. 병을 가려내거나
          치료법을 정해 주지 않으니, 아픈 곳이 있으면 의료 전문가와 상담해 주세요.
        </Text>
      </Card>

      <KnowledgeSection {...(onNavigate ? { onNavigate } : {})} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backRow: { alignItems: 'flex-start' },
  backButton: { minHeight: layout.touchTarget },
  noteCard: { gap: spacing.xs },
  noteTitle: {
    color: palette.ink,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.heavy,
  },
  noteBody: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  noteQuiet: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
});
