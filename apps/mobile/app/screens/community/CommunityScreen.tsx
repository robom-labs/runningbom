// 공개 피드와 크루·리그 상태를 보여줍니다. 서버 쓰기가 꺼져 있으면 그 사실을 그대로 표시합니다.
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Banner, Button, Card, Chip, SectionHeader } from '../../design-system/components';
import { palette, spacing, typeScale } from '../../design-system/theme';
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

type Section = '피드' | '크루' | '리그';

const modeLabels: Record<CommunityMode, string> = {
  NORMAL: '커뮤니티 연결됨',
  LIMITED_WRITE: '쓰기 제한 모드',
  READ_ONLY_COMMUNITY: '읽기 전용 모드',
  CORE_ONLY: '코어 전용 모드',
};

export function CommunityScreen() {
  const { preferences, updatePreferences } = useAppState();
  const [section, setSection] = useState<Section>('피드');
  const [category, setCategory] = useState<FeedCategory>('전체');
  const [sort, setSort] = useState<FeedSort>('최신순');
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [mode, setMode] = useState<CommunityMode>(communityMode());
  const [message, setMessage] = useState('공개 피드를 확인하고 있어요.');

  useEffect(() => {
    let active = true;
    void loadPublicFeed().then((result) => {
      if (!active) return;
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
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
      <View accessibilityRole="tablist" style={styles.tabs}>
        {(['피드', '크루', '리그'] as Section[]).map((value) => (
          <Chip
            accessibilityRole="tab"
            key={value}
            label={value}
            onPress={() => setSection(value)}
            selected={section === value}
            tone="accent"
          />
        ))}
      </View>

      <Banner
        title={writeEnabled ? '커뮤니티 연결됨' : '읽기 전용 · 글쓰기 준비 중'}
        body={
          writeEnabled
            ? '공개 글은 로그인 없이 읽고, 참여 기능은 로그인 후 사용해요.'
            : '운영 서버 쓰기가 연결되기 전이라 글쓰기·좋아요·댓글은 아직 열리지 않았어요. 지금은 공개 글 읽기만 가능합니다.'
        }
        tone={writeEnabled ? 'positive' : 'warning'}
      />

      <View style={styles.modeRow}>
        <Chip label={modeLabels[mode]} tone={mode === 'NORMAL' ? 'positive' : 'warning'} />
        <Text style={styles.modeText}>{message}</Text>
      </View>

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

          {visiblePosts.length > 0 ? (
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
          ) : (
            <Card style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {posts.length > 0 ? '이 카테고리에는 글이 없어요' : '첫 공개 글을 기다리고 있어요'}
              </Text>
              <Text style={styles.emptyBody}>
                코칭을 마친 뒤에도 자동 게시하지 않으며, 사용자가 본문과 공개 범위를 확인해야
                게시됩니다.
              </Text>
            </Card>
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
          연결과 함께 열립니다.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  content: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  tabs: { flexDirection: 'row', gap: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  modeText: { flex: 1, minWidth: 0, color: palette.muted, fontSize: typeScale.caption, lineHeight: 18 },
  list: { gap: spacing.md },
  post: { gap: spacing.sm },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  author: { flex: 1, minWidth: 0, color: palette.ink, fontSize: typeScale.body, fontWeight: '900' },
  postBody: { color: palette.inkSoft, fontSize: typeScale.body, lineHeight: 24 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  meta: { color: palette.muted, fontSize: typeScale.caption },
  empty: { backgroundColor: palette.surfaceWarm },
  emptyTitle: { color: palette.ink, fontSize: typeScale.titleSmall, fontWeight: '900' },
  emptyBody: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  button: { marginTop: spacing.lg },
  statusNote: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
});
