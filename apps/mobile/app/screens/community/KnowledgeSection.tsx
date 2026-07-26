// 러닝 Q&A 지식 카드 섹션입니다. 서버 없이 앱에 내장된 내용이라 오프라인에서도 읽을 수 있습니다.
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, Chip, Disclosure, SearchField } from '../../design-system/components';
import { palette, radius, spacing, typeScale } from '../../design-system/theme';
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
  /** 연결돼 있으면 관련 기능으로 바로 이동하고, 없으면 어디서 열 수 있는지 안내만 합니다. */
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
        <Text style={styles.introTitle}>러닝 Q&A {knowledgeCards.length}개</Text>
        <Text style={styles.introBody}>
          초보가 가장 많이 묻는 질문을 앱 안에 담았어요. 검색하거나 주제를 골라 찾아보세요. 답변은
          일반적인 참고 정보이며 진단이 아니에요.
        </Text>
      </Card>

      <SearchField
        accessibilityLabel="러닝 질문 검색"
        onChangeText={(value) => {
          setQuery(value);
          setOpenId(undefined);
        }}
        placeholder="예: 무릎, 러닝화 교체, 인터벌"
        value={query}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {knowledgeCategories.map((value) => (
          <Chip
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
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>찾는 질문이 아직 없어요</Text>
          <Text style={styles.emptyBody}>
            아래 임시 보관함에 질문을 적어 두면, 커뮤니티 글쓰기가 열릴 때 그대로 올릴 수 있어요.
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {results.map((card) => (
            <Disclosure
              badge={<Chip label={card.category} />}
              expanded={openId === card.id}
              key={card.id}
              onToggle={() => setOpenId((current) => (current === card.id ? undefined : card.id))}
              title={card.question}
            >
              {card.answer.map((line, index) => (
                <View key={`${card.id}-${index}`} style={styles.answerRow}>
                  <Text style={styles.answerDot}>·</Text>
                  <Text style={styles.answerText}>{line}</Text>
                </View>
              ))}
              {card.link ? (
                <View style={styles.linkBox}>
                  <Text style={styles.linkLabel}>
                    관련 기능 · {knowledgeLinkLabels[card.link.target]}
                  </Text>
                  <Text style={styles.linkHint}>{card.link.hint}</Text>
                  {onNavigate ? (
                    <Chip
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
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  introCard: { backgroundColor: palette.surfaceWarm },
  introTitle: { color: palette.ink, fontSize: typeScale.titleSmall, fontWeight: '900' },
  introBody: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  chipRow: { flexDirection: 'row', gap: spacing.xs, paddingVertical: 2 },
  resultCount: { color: palette.muted, fontSize: typeScale.caption, fontWeight: '800' },
  list: { gap: spacing.xs },
  answerRow: { flexDirection: 'row', gap: spacing.xs },
  answerDot: { color: palette.accent, fontSize: typeScale.bodySmall, fontWeight: '900' },
  answerText: {
    flex: 1,
    minWidth: 0,
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: 22,
  },
  linkBox: {
    gap: spacing.xxs,
    alignItems: 'flex-start',
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  linkLabel: { color: palette.accentDark, fontSize: typeScale.caption, fontWeight: '900' },
  linkHint: { color: palette.inkSoft, fontSize: typeScale.caption, lineHeight: 18 },
  linkHintQuiet: { color: palette.muted, fontSize: 11, lineHeight: 16 },
  emptyCard: { backgroundColor: palette.surfaceWarm },
  emptyTitle: { color: palette.ink, fontSize: typeScale.body, fontWeight: '900' },
  emptyBody: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
});
