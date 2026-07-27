// "러닝 궁금증" 코너의 본문입니다. 검색 → 분류 → 질문 목록 → 펼치면 답변 순서로 읽습니다.
// 앱 안에 내장된 글이라 서버 없이, 인터넷 없이도 그대로 읽을 수 있습니다.
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, Chip, Disclosure, EmptyState, SearchField } from '../../design-system/components';
import {
  fontWeight,
  lineHeight,
  palette,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';
import type { RouteKey } from '../../navigation/types';
import {
  findKnowledgeCards,
  knowledgeCards,
  knowledgeCategories,
  knowledgeCountsByCategory,
  knowledgeLinkLabels,
  type KnowledgeCategory,
} from './knowledge';

type Props = {
  /** 연결돼 있으면 관련 화면으로 바로 이동하고, 없으면 어디서 열 수 있는지 안내만 합니다. */
  onNavigate?: (route: RouteKey) => void;
};

export function KnowledgeSection({ onNavigate }: Props) {
  const [category, setCategory] = useState<KnowledgeCategory>('전체');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | undefined>();

  const counts = useMemo(() => knowledgeCountsByCategory(), []);
  const results = useMemo(() => findKnowledgeCards(category, query), [category, query]);

  return (
    <View style={styles.wrap}>
      <Card style={styles.introCard}>
        <Text style={styles.introTitle}>궁금한 것 {knowledgeCards.length}가지</Text>
        <Text style={styles.introBody}>
          러닝하면서 가장 많이 나오는 궁금증을 앱 안에 담아 뒀어요. 검색하거나 주제를 골라
          찾아보세요. 사람들이 올린 글이 아니라 러닝봄이 준비한 안내이고, 일반적인 참고 정보이며
          진단이 아니에요.
        </Text>
      </Card>

      <SearchField
        accessibilityLabel="궁금한 것 검색"
        onChangeText={(value) => {
          setQuery(value);
          setOpenId(undefined);
        }}
        placeholder="예: 무릎, 러닝화 교체, 매일 뛰어도"
        value={query}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {knowledgeCategories.map((value) => (
          <Chip
            accessibilityLabel={`${value} 주제, 글 ${counts[value]}개`}
            accessibilityRole="tab"
            key={value}
            label={`${value} ${counts[value]}`}
            onPress={() => {
              setCategory(value);
              setOpenId(undefined);
            }}
            selected={category === value}
            tone="accent"
          />
        ))}
      </ScrollView>

      <Text accessibilityLiveRegion="polite" style={styles.resultCount}>
        {query.trim() ? `"${query.trim()}" 검색 결과 ${results.length}개` : `${results.length}개 질문`}
      </Text>

      {results.length === 0 ? (
        <EmptyState
          title="찾는 내용이 아직 없어요"
          body="다른 낱말로 찾아보거나 주제를 '전체'로 바꿔 보세요. 그래도 없으면 커뮤니티의 내 글 보관함에 적어 두었다가 나중에 물어볼 수 있어요."
          actionLabel="전체 주제로 보기"
          onAction={() => {
            setCategory('전체');
            setQuery('');
          }}
          tone="muted"
        />
      ) : (
        <View style={styles.list}>
          {results.map((card) => {
            const expanded = openId === card.id;
            return (
              // 아코디언 머리글의 accessibilityRole="button" + accessibilityState={{ expanded }}와
              // 48px 이상 터치 높이는 공통 Disclosure(app/design-system/components.tsx)가 보장합니다.
              <Disclosure
                badge={<Chip accessibilityLabel={`${card.category} 주제`} label={card.category} />}
                expanded={expanded}
                key={card.id}
                onToggle={() => setOpenId((current) => (current === card.id ? undefined : card.id))}
                title={card.question}
              >
                <View
                  accessibilityLabel={`${card.question} 답변 ${card.answer.length}줄`}
                  accessibilityLiveRegion="polite"
                  accessibilityState={{ expanded }}
                  style={styles.answerList}
                >
                  {card.answer.map((line, index) => (
                    <View key={`${card.id}-${index}`} style={styles.answerRow}>
                      <Text style={styles.answerDot}>·</Text>
                      <Text style={styles.answerText}>{line}</Text>
                    </View>
                  ))}
                </View>
                {card.link ? (
                  <View style={styles.linkBox}>
                    <Text style={styles.linkLabel}>
                      관련 화면 · {knowledgeLinkLabels[card.link.target]}
                    </Text>
                    <Text style={styles.linkHint}>{card.link.hint}</Text>
                    {onNavigate ? (
                      <Chip
                        accessibilityLabel={`${knowledgeLinkLabels[card.link.target]} 화면 열기`}
                        accessibilityRole="button"
                        label={`${knowledgeLinkLabels[card.link.target]} 열기`}
                        onPress={() => onNavigate(card.link!.target)}
                        tone="accent"
                      />
                    ) : (
                      <Text style={styles.linkHintQuiet}>
                        왼쪽 위 메뉴에서 {knowledgeLinkLabels[card.link.target]} 화면을 열 수 있어요.
                      </Text>
                    )}
                  </View>
                ) : null}
              </Disclosure>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  introCard: { backgroundColor: palette.surfaceWarm },
  introTitle: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
  },
  introBody: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    marginTop: spacing.xs,
  },
  chipRow: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.xxs / 2 },
  resultCount: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.bold,
  },
  list: { gap: spacing.xs },
  answerList: { gap: spacing.xxs },
  answerRow: { flexDirection: 'row', gap: spacing.xs },
  answerDot: {
    color: palette.accentDark,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.heavy,
  },
  answerText: {
    flex: 1,
    minWidth: 0,
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  linkBox: {
    gap: spacing.xxs,
    alignItems: 'flex-start',
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  linkLabel: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.heavy,
  },
  linkHint: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  linkHintQuiet: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
  },
});
