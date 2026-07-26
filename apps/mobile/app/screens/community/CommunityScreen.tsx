// 공개 피드와 크루·리그 상태를 보여줍니다. 서버 쓰기가 꺼져 있으면 그 사실을 그대로 표시합니다.
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  SectionHeader,
  SkeletonCard,
  screenStyles,
} from '../../design-system/components';
import { fontWeight, lineHeight, palette, spacing, typeScale } from '../../design-system/theme';
import { reactionKinds, reactionLabels, type PublicPost } from '../../../domains/social/types';
import { featureFlags } from '../../../services/feature-flags/flags';
import { loadPublicFeed } from '../../../services/supabase/community';
import { communityMode, type CommunityMode } from '../../../services/supabase/client';
import { useAppState } from '../../state/AppStateProvider';
import {
  categoryFor,
  feedCategories,
  feedSorts,
  filterByCategory,
  sortPosts,
  totalReactions,
  type FeedCategory,
  type FeedSort,
} from './categories';
import type { RouteKey } from '../../navigation/types';
import { DraftBox } from './DraftBox';
import { knowledgeCards } from './knowledge';
import { KnowledgeSection } from './KnowledgeSection';

type Section = 'Q&A' | '피드' | '크루' | '리그';

const sections: Section[] = ['Q&A', '피드', '크루', '리그'];

const modeLabels: Record<CommunityMode, string> = {
  NORMAL: '커뮤니티 연결됨',
  LIMITED_WRITE: '쓰기 제한 모드',
  READ_ONLY_COMMUNITY: '읽기 전용 모드',
  CORE_ONLY: '코어 전용 모드',
};

// onNavigate가 연결되면 Q&A 카드에서 관련 기능으로 바로 이동합니다. 없으면 안내만 보여줍니다.
export function CommunityScreen({ onNavigate }: { onNavigate?: (route: RouteKey) => void } = {}) {
  const { preferences, updatePreferences } = useAppState();
  const [section, setSection] = useState<Section>('Q&A');
  const [category, setCategory] = useState<FeedCategory>('전체');
  const [sort, setSort] = useState<FeedSort>('최신순');
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [mode, setMode] = useState<CommunityMode>(communityMode());
  const [message, setMessage] = useState('공개 피드를 확인하고 있어요.');
  const [feedLoading, setFeedLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void loadPublicFeed().then((result) => {
      if (!active) return;
      setFeedLoading(false);
      setPosts(result.posts);
      setMode(result.mode);
      setMessage(
        result.error ??
          (result.posts.length > 0
            ? '운영 공개 피드를 불러왔어요.'
            : '연결된 공개 게시물이 아직 없어요. 가짜 사용자는 만들지 않습니다.'),
      );
    });
    return () => {
      active = false;
    };
  }, []);

  const writeEnabled = featureFlags.social && mode === 'NORMAL';
  const visiblePosts = useMemo(
    () => sortPosts(filterByCategory(posts, category), sort),
    [category, posts, sort],
  );

  return (
    <ScrollView
      contentContainerStyle={screenStyles.content}
      showsVerticalScrollIndicator={false}
      style={screenStyles.root}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {sections.map((value) => (
          <Chip
            accessibilityRole="tab"
            key={value}
            label={value}
            onPress={() => setSection(value)}
            selected={section === value}
            tone="accent"
          />
        ))}
      </ScrollView>

      <Banner
        title={writeEnabled ? '커뮤니티 연결됨' : '읽기 전용 · 글쓰기 준비 중'}
        body={
          writeEnabled
            ? '공개 글은 로그인 없이 읽고, 참여 기능은 로그인 후 사용해요.'
            : `운영 서버 쓰기가 연결되기 전이라 글쓰기·좋아요·댓글은 아직 열리지 않았어요. 그동안 러닝 Q&A ${knowledgeCards.length}개는 로그인 없이 바로 읽을 수 있고, 쓰고 싶은 질문은 임시 보관함에 저장해 둘 수 있어요.`
        }
        tone={writeEnabled ? 'positive' : 'warning'}
      />

      {section === 'Q&A' ? (
        <>
          <KnowledgeSection {...(onNavigate ? { onNavigate } : {})} />
          <DraftBox />
        </>
      ) : null}

      {section !== 'Q&A' ? (
        <View style={styles.modeRow}>
          <Chip label={modeLabels[mode]} tone={mode === 'NORMAL' ? 'positive' : 'warning'} />
          <Text style={styles.modeText}>{message}</Text>
        </View>
      ) : null}

      {section === '피드' ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {feedCategories.map((value) => (
              <Chip
                key={value}
                label={value}
                onPress={() => setCategory(value)}
                selected={category === value}
              />
            ))}
          </ScrollView>
          <View style={styles.chipRow}>
            {feedSorts.map((value) => (
              <Chip
                key={value}
                label={value}
                onPress={() => setSort(value)}
                selected={sort === value}
                tone="accent"
              />
            ))}
          </View>

          {feedLoading ? (
            <SkeletonCard accessibilityLabel="공개 피드를 불러오는 중이에요" lines={3} />
          ) : visiblePosts.length > 0 ? (
            <View style={styles.list}>
              {visiblePosts.map((post) => (
                <Card key={post.id} style={styles.post}>
                  <View style={styles.postHeader}>
                    <Text style={styles.author}>{post.authorNickname}</Text>
                    <Chip label={categoryFor(post)} />
                  </View>
                  <Text style={styles.postBody}>{post.body}</Text>
                  <View style={styles.reactions}>
                    {reactionKinds.map((kind) => (
                      <Chip
                        key={kind}
                        label={`${reactionLabels[kind]} ${post.reactionCounts[kind] ?? 0}`}
                      />
                    ))}
                  </View>
                  <Text style={styles.meta}>
                    좋아요 {totalReactions(post.reactionCounts)} · 댓글 {post.commentCount} ·{' '}
                    {post.createdAt.slice(0, 10)}
                  </Text>
                </Card>
              ))}
            </View>
          ) : posts.length > 0 ? (
            <EmptyState
              title="이 카테고리에는 글이 없어요"
              body="다른 카테고리를 골라 보세요. 코칭을 마친 뒤에도 자동 게시하지 않으며, 사용자가 본문과 공개 범위를 확인해야 게시됩니다."
              actionLabel="전체 카테고리 보기"
              onAction={() => setCategory('전체')}
              tone="muted"
            />
          ) : (
            <EmptyState
              title="첫 공개 글을 기다리고 있어요"
              body="가짜 사용자나 자동 게시물은 만들지 않아요. 그동안 Q&A 탭에서 러닝 질문의 답을 먼저 읽어 보실 수 있어요."
              actionLabel="Q&A 읽기"
              onAction={() => setSection('Q&A')}
            />
          )}
        </>
      ) : null}

      {section === '크루' ? (
        <Card style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {writeEnabled ? '크루 연결을 검증하는 중이에요' : '크루는 안전 검증 뒤 열려요'}
          </Text>
          <Text style={styles.emptyBody}>
            공개·승인제·비공개 크루, 역할, 일정과 참석 구조는 서버 연결 뒤 활성화합니다. 번개런과
            실시간 위치는 제공하지 않아요.
          </Text>
          <Text style={styles.statusNote}>
            역할별 권한 점검과 운영자 검수 흐름이 통과되기 전에는 가입·생성 버튼을 노출하지
            않습니다.
          </Text>
        </Card>
      ) : null}

      {section === '리그' ? (
        <Card style={styles.empty}>
          <Text style={styles.emptyTitle}>꾸준함 리그는 참여를 선택해야 해요</Text>
          <Text style={styles.emptyBody}>
            기본은 꺼짐이며, 코치로 완료한 활동만 하루 한 번·주 5일 한도로 계산합니다. 전체 세계
            순위나 꼴찌 독촉은 만들지 않아요.
          </Text>
          <Button
            label={preferences.leagueOptIn ? '리그 참여 해제' : '리그 참여 선택'}
            onPress={() => void updatePreferences({ leagueOptIn: !preferences.leagueOptIn })}
            style={styles.button}
            tone={preferences.leagueOptIn ? 'quiet' : 'secondary'}
          />
          <Text accessibilityLiveRegion="polite" style={styles.statusNote}>
            {preferences.leagueOptIn
              ? '이 기기에서 참여 의사를 저장했어요. 서버 리그가 열리기 전에는 공개 점수로 전송하지 않습니다.'
              : '현재 기본값은 참여 안 함입니다.'}
          </Text>
        </Card>
      ) : null}

      <SectionHeader title="커뮤니티 원칙" compact />
      <Card style={styles.empty}>
        <Text style={styles.emptyBody}>
          가짜 사용자·자동 게시물을 만들지 않고, 기록을 자동으로 공개하지 않아요. 신고와 차단은 서버
          연결과 함께 열립니다. Q&A는 앱에 내장된 참고 정보이며 의료적 진단이 아니에요.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.xxs / 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  modeText: {
    flex: 1,
    minWidth: 0,
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  list: { gap: spacing.md },
  post: { gap: spacing.sm },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  author: {
    flex: 1,
    minWidth: 0,
    color: palette.ink,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.heavy,
  },
  postBody: {
    color: palette.inkSoft,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
  },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  meta: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  empty: { backgroundColor: palette.surfaceWarm },
  emptyTitle: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
  },
  emptyBody: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    marginTop: spacing.sm,
  },
  button: { marginTop: spacing.lg },
  statusNote: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    marginTop: spacing.sm,
  },
});
