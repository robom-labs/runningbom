// "러닝 궁금증" 코너의 본문입니다. 검색 → 분류 → 질문 목록 → 펼치면 답변 순서로 읽습니다.
// 앱 안에 내장된 글이라 서버 없이, 인터넷 없이도 그대로 읽을 수 있습니다.
//
// 글이 130개로 늘면서 화면을 이렇게 손봤습니다.
// - 맨 위에 "많이 찾는 질문"을 고정으로 둡니다(검색 전에는 여기부터 보이게).
// - 분류가 15개라 칩을 한 줄에 다 담을 수 없어 여러 줄로 접히게 했습니다(잘리지 않게).
// - 검색은 질문·답변·검색 낱말을 모두 훑고, 걸린 낱말을 색으로 강조하고 미리보기를 보여 줍니다.
// - 0건이면 비슷한 질문을 추천합니다.
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

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
  knowledgeSnippet,
  popularKnowledgeCards,
  splitBySearchTerms,
  suggestKnowledge,
  type KnowledgeCard,
  type KnowledgeCategory,
} from './knowledge';

type Props = {
  /** 연결돼 있으면 관련 화면으로 바로 이동하고, 없으면 어디서 열 수 있는지 안내만 합니다. */
  onNavigate?: (route: RouteKey) => void;
  /**
   * 이 코너 위에 함께 얹을 화면 머리말입니다(돌아가기·제목·안내 카드).
   * 목록을 이 컴포넌트가 직접 굴리기 때문에, 화면이 스크롤 통을 따로 두지 않고 여기에 넘겨 줍니다.
   */
  header?: ReactNode;
  /** 목록 통에 그대로 넘길 바깥 여백·배경입니다. 화면이 쓰던 공통 레이아웃을 그대로 받습니다. */
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/** 검색어와 겹치는 글자만 색을 다르게 칠합니다. 검색어가 없으면 그냥 한 덩어리로 그립니다. */
function Highlighted({
  text,
  query,
  style,
}: {
  text: string;
  query: string;
  style: StyleProp<TextStyle>;
}) {
  const parts = useMemo(() => splitBySearchTerms(text, query), [text, query]);
  if (parts.length === 1) return <Text style={style}>{text}</Text>;
  return (
    <Text style={style}>
      {parts.map((part, index) =>
        part.matched ? (
          <Text key={`${part.text}-${index}`} style={styles.mark}>
            {part.text}
          </Text>
        ) : (
          part.text
        ),
      )}
    </Text>
  );
}

export function KnowledgeSection({ onNavigate, header, style, contentContainerStyle }: Props) {
  const [category, setCategory] = useState<KnowledgeCategory>('전체');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | undefined>();

  const counts = useMemo(() => knowledgeCountsByCategory(), []);
  const results = useMemo(() => findKnowledgeCards(category, query), [category, query]);
  const trimmed = query.trim();
  const searching = trimmed.length > 0;
  const popular = useMemo(() => popularKnowledgeCards(), []);
  const suggestions = useMemo(
    () => (results.length === 0 && searching ? suggestKnowledge(query) : []),
    [results.length, searching, query],
  );

  /** 목록 한 줄입니다. 많이 찾는 질문과 검색 결과가 같은 모양을 쓰도록 함수로 뺐습니다. */
  const renderCard = (card: KnowledgeCard, keyPrefix: string, spaced = false) => {
    const rowId = `${keyPrefix}:${card.id}`;
    const expanded = openId === rowId;
    const snippet = searching ? knowledgeSnippet(card, query) : undefined;
    return (
      // 아코디언 머리글의 accessibilityRole="button" + accessibilityState={{ expanded }}와
      // 48px 이상 터치 높이는 공통 Disclosure(app/design-system/components.tsx)가 보장합니다.
      <View key={rowId} style={[styles.row, spaced && styles.listRow]}>
        <Disclosure
          badge={<Chip accessibilityLabel={`${card.category} 주제`} label={card.category} />}
          expanded={expanded}
          onToggle={() => setOpenId((current) => (current === rowId ? undefined : rowId))}
          title={card.question}
        >
          <View
            accessibilityLabel={`${card.question} 답변 ${card.answer.length}줄`}
            accessibilityLiveRegion="polite"
            accessibilityState={{ expanded }}
            style={styles.answerList}
          >
            {card.answer.map((line, index) => (
              <View key={`${rowId}-${index}`} style={styles.answerRow}>
                <Text style={styles.answerDot}>·</Text>
                <Highlighted query={query} style={styles.answerText} text={line} />
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
        {!expanded && snippet ? (
          <View style={styles.snippetBox}>
            <Text style={styles.snippetLabel}>답변에서 찾음</Text>
            <Highlighted query={query} style={styles.snippetText} text={snippet} />
          </View>
        ) : null}
      </View>
    );
  };

  // 목록 한 줄을 그리는 함수는 매번 새로 만들지 않습니다(FlatList가 줄을 다시 그릴 이유가 줄어듭니다).
  const renderRow = useCallback(
    ({ item }: { item: KnowledgeCard }) => renderCard(item, 'result', true),
    // renderCard는 펼침 상태·검색어를 읽으므로 그 둘이 바뀔 때만 새로 만듭니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openId, query, searching, onNavigate],
  );
  const keyOfRow = useCallback((item: KnowledgeCard) => item.id, []);

  const listHeader = (
    <View style={styles.wrap}>
      {header}
      <Card style={styles.introCard}>
        <Text style={styles.introTitle}>궁금한 것 {knowledgeCards.length}가지</Text>
        <Text style={styles.introBody}>
          러닝하면서 가장 많이 나오는 궁금증을 앱 안에 담아 뒀어요. 검색하거나 주제를 골라
          찾아보세요. 질문·답변·비슷한 낱말을 한 번에 찾아 줘요. 사람들이 올린 글이 아니라 러닝봄이
          준비한 안내이고, 일반적인 참고 정보이며 진단이 아니에요.
        </Text>
      </Card>

      <SearchField
        accessibilityLabel="궁금한 것 검색"
        onChangeText={(value) => {
          setQuery(value);
          setOpenId(undefined);
        }}
        placeholder="예: 무릎, 미세먼지, 러닝화 교체, 살 안 빠져"
        value={query}
      />

      {/* 분류가 15개라 가로 스크롤 대신 여러 줄로 접습니다. 화면이 좁아도 잘리지 않아요. */}
      <View style={styles.chipRow}>
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
      </View>

      {!searching && category === '전체' ? (
        <View style={styles.popularBox}>
          <Text style={styles.blockTitle}>많이 찾는 질문 {popular.length}개</Text>
          <Text style={styles.blockHint}>사람들이 가장 많이 찾아본 것부터 모아 뒀어요.</Text>
          <View style={styles.list}>{popular.map((card) => renderCard(card, 'popular'))}</View>
        </View>
      ) : null}

      <Text accessibilityLiveRegion="polite" style={styles.resultCount}>
        {searching
          ? `"${trimmed}" 검색 결과 ${results.length}개`
          : `${category} ${results.length}개 질문`}
      </Text>

    </View>
  );

  const listEmpty = (
    <View style={styles.list}>
      <EmptyState
        title="찾는 내용이 아직 없어요"
        body="다른 낱말로 찾아보거나 주제를 '전체'로 바꿔 보세요. 아래에 비슷한 질문을 골라 뒀어요."
        actionLabel="전체 주제로 보기"
        onAction={() => {
          setCategory('전체');
          setQuery('');
        }}
        tone="muted"
      />
      {suggestions.length > 0 ? (
        <View style={styles.popularBox}>
          <Text style={styles.blockTitle}>이런 질문을 찾으셨나요?</Text>
          <View style={styles.list}>{suggestions.map((card) => renderCard(card, 'suggest'))}</View>
        </View>
      ) : null}
    </View>
  );

  // 글이 130개라 예전에는 한 번에 130줄을 통째로 그렸습니다(스크롤 통 안에서 .map).
  // 이제 화면에 보이는 만큼만 그리고, 스크롤하면서 이어서 그립니다. 보이는 내용은 하나도 줄지 않습니다.
  return (
    <FlatList
      ListEmptyComponent={listEmpty}
      ListHeaderComponent={listHeader}
      contentContainerStyle={contentContainerStyle}
      data={results}
      initialNumToRender={8}
      keyExtractor={keyOfRow}
      keyboardShouldPersistTaps="handled"
      maxToRenderPerBatch={8}
      removeClippedSubviews={false}
      renderItem={renderRow}
      showsVerticalScrollIndicator={false}
      style={style}
      windowSize={7}
    />
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingVertical: spacing.xxs / 2,
  },
  popularBox: {
    gap: spacing.xxs,
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  blockTitle: {
    color: palette.ink,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.heavy,
  },
  blockHint: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    marginBottom: spacing.xxs,
  },
  resultCount: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.bold,
  },
  list: { gap: spacing.xs },
  row: { gap: spacing.xxs },
  // 목록을 스크롤 통에서 FlatList로 옮기면서, 줄 사이 간격(styles.list의 gap)을 줄마다 답니다.
  listRow: { marginBottom: spacing.xs },
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
  mark: {
    color: palette.accentDark,
    backgroundColor: palette.accentSoft,
    fontWeight: fontWeight.heavy,
  },
  snippetBox: {
    gap: spacing.xxs / 2,
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  snippetLabel: {
    color: palette.muted,
    fontSize: typeScale.micro,
    lineHeight: lineHeight.micro,
    fontWeight: fontWeight.bold,
  },
  snippetText: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
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
