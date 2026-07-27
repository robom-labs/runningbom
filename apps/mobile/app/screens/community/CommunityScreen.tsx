// 커뮤니티 — "사람들이 올리는 곳"입니다.
//
// 무엇을 고쳤나
// - 예전에는 이 화면을 열면 앱이 미리 써 둔 안내 글 묶음이 가장 먼저 나왔습니다. 그건 사람들이
//   올린 글이 아니어서 "사람이 모이는 곳"과 "앱이 알려 주는 곳"이 한 화면에 섞여 있었습니다.
//   그래서 안내 글은 app/screens/guide(러닝 궁금증)로 옮기고, 이 화면은 사람이 올리는 것만 남겼습니다.
// - 서버가 아직 없어서 남의 글은 정말로 없습니다. 없는 사람과 없는 글을 지어내지 않고,
//   지금 정직하게 할 수 있는 것(내 기록을 카드로 만들어 내보내기, 내 글 보관해 두기)을 먼저 둡니다.
// - 서버가 있어야 되는 것(사람들 소식·크루·리그)은 "준비 중"이라고 그대로 적습니다.
//   언제 열리는지는 정해지지 않았으므로 날짜를 말하지 않습니다.
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
import { fontWeight, layout, lineHeight, palette, spacing, typeScale } from '../../design-system/theme';
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
import { ProfileSummaryCard } from './ProfileSummaryCard';
import {
  communitySections,
  defaultCommunitySection,
  notReadySuffix,
  sectionAccessibilityLabel,
  sectionChipLabel,
  type CommunitySectionKey,
} from './sections';
import { ShareCardComposer } from './ShareCardComposer';

const modeLabels: Record<CommunityMode, string> = {
  NORMAL: '커뮤니티 연결됨',
  LIMITED_WRITE: '쓰기 제한 상태',
  READ_ONLY_COMMUNITY: '읽기만 되는 상태',
  CORE_ONLY: '내 기기에만 저장하는 상태',
};

type Props = {
  /** 러닝화·대회처럼 앱 안의 다른 화면으로 갑니다. 라우팅은 부모가 합니다. */
  onNavigate?: (route: RouteKey) => void;
  /** 러닝 궁금증(도움말) 화면을 여는 방법입니다. 부모가 연결해 줍니다. */
  onOpenGuide?: () => void;
};

export function CommunityScreen({ onNavigate, onOpenGuide }: Props = {}) {
  const { preferences, updatePreferences } = useAppState();
  const [section, setSection] = useState<CommunitySectionKey>(defaultCommunitySection);
  const [category, setCategory] = useState<FeedCategory>('전체');
  const [sort, setSort] = useState<FeedSort>('최신순');
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [mode, setMode] = useState<CommunityMode>(communityMode());
  const [message, setMessage] = useState('사람들이 올린 글이 있는지 확인하고 있어요.');
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
            ? '사람들이 올린 글을 불러왔어요.'
            : '아직 올라온 글이 없어요. 가짜 사용자는 만들지 않습니다.'),
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
      {/* ① 맨 위는 내 프로필 요약입니다. 누르면 프로필 화면으로 갑니다. */}
      <ProfileSummaryCard {...(onNavigate ? { onOpenProfile: () => onNavigate('profile') } : {})} />

      {/* ② 여기가 어떤 곳인지 한 번에 알려 줍니다. 궁금증 해결은 다른 화면이라고 분명히 적습니다. */}
      <Banner
        title="여기는 내가 올리는 곳이에요"
        body={
          writeEnabled
            ? '내 기록을 카드로 만들어 원하는 곳에 올릴 수 있어요. 사람들이 올린 글도 함께 볼 수 있어요.'
            : '내 기록을 카드로 만들어 인스타그램·카카오톡 같은 곳에 올릴 수 있어요. 여럿이 함께하는 기능은 아직 준비 중이에요. 러닝이 궁금할 때는 러닝 궁금증 화면에서 찾아보세요.'
        }
        tone={writeEnabled ? 'positive' : 'info'}
      />

      {onOpenGuide ? (
        <Button
          accessibilityHint="러닝하며 생기는 궁금증에 앱이 미리 답해 둔 화면을 열어요."
          label="러닝 궁금증 보러 가기"
          onPress={onOpenGuide}
          style={styles.guideButton}
          tone="secondary"
        />
      ) : null}

      {/* ③ 구획 고르기. 지금 쓸 수 있는 것이 앞, 준비 중인 것이 뒤입니다. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {communitySections.map((info) => (
          <Chip
            accessibilityLabel={sectionAccessibilityLabel(info)}
            accessibilityRole="tab"
            key={info.key}
            label={sectionChipLabel(info)}
            onPress={() => setSection(info.key)}
            selected={section === info.key}
            tone={info.ready ? 'accent' : 'warning'}
          />
        ))}
      </ScrollView>

      {section === 'card' ? (
        <ShareCardComposer {...(onNavigate ? { onStartRun: () => onNavigate('start') } : {})} />
      ) : null}

      {section === 'drafts' ? <DraftBox /> : null}

      {section === 'posts' || section === 'together' ? (
        <View style={styles.modeRow}>
          <Chip label={modeLabels[mode]} tone={mode === 'NORMAL' ? 'positive' : 'warning'} />
          <Text style={styles.modeText}>{message}</Text>
        </View>
      ) : null}

      {section === 'posts' ? (
        <>
          <Card style={styles.notReadyCard} tone="muted">
            <Text style={styles.notReadyTitle}>사람들 소식은 {notReadySuffix}이에요</Text>
            <Text style={styles.notReadyBody}>
              다른 사람의 글을 주고받으려면 글을 모아 두는 서버가 있어야 하는데, 아직 연결되지
              않았어요. 그래서 지금 이 목록은 비어 있는 게 맞아요.
            </Text>
            <Text style={styles.notReadyBody}>
              언제 열리는지는 아직 정해지지 않았어요. 정해지지 않은 날짜를 말씀드리지 않을게요.
            </Text>
          </Card>

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
            <SkeletonCard accessibilityLabel="사람들이 올린 글을 불러오는 중이에요" lines={3} />
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
              title="이 분류에는 글이 없어요"
              body="다른 분류를 골라 보세요. 러닝을 마쳐도 저절로 올라가지 않고, 본인이 내용과 공개 범위를 확인해야 올라가요."
              actionLabel="전체 분류 보기"
              onAction={() => setCategory('전체')}
              tone="muted"
            />
          ) : (
            <EmptyState
              title="아직 아무도 올린 글이 없어요"
              body="가짜 사용자나 자동으로 만든 글은 넣지 않아요. 그동안 내 기록을 카드로 만들어 원하는 곳에 올려 볼 수 있어요."
              actionLabel="기록 카드 만들러 가기"
              onAction={() => setSection('card')}
            />
          )}
        </>
      ) : null}

      {section === 'together' ? (
        <>
          <Card style={styles.notReadyCard} tone="muted">
            <Text style={styles.notReadyTitle}>크루는 {notReadySuffix}이에요</Text>
            <Text style={styles.notReadyBody}>
              여럿이 모이는 방을 만들려면 사람과 일정을 서버에 저장해야 하는데, 아직 연결되지
              않았어요. 안전 점검도 함께 끝나야 열 수 있어서 지금은 가입·만들기 버튼을 두지 않아요.
            </Text>
            <Text style={styles.notReadyBody}>
              지금 당장 모여서 달리는 기능(즉석 모임)과 실시간 위치 나누기는 앞으로도 만들지 않을
              계획이에요.
            </Text>
            <Text style={styles.statusNote}>언제 열리는지는 아직 정해지지 않았어요.</Text>
          </Card>

          <Card style={styles.notReadyCard} tone="muted">
            <Text style={styles.notReadyTitle}>꾸준함 리그도 {notReadySuffix}이에요</Text>
            <Text style={styles.notReadyBody}>
              참여는 본인이 고를 때만 켜져요. 기본은 꺼짐이고, 코치로 마친 러닝만 하루 한 번·주
              5일까지 셈해요. 전체 순위나 꼴찌 알림 같은 건 만들지 않아요.
            </Text>
            <Button
              accessibilityHint="이 기기에만 참여 의사를 저장해요. 밖으로 보내지 않아요."
              label={preferences.leagueOptIn ? '참여 안 함으로 바꾸기' : '나중에 열리면 참여할래요'}
              onPress={() => void updatePreferences({ leagueOptIn: !preferences.leagueOptIn })}
              style={styles.button}
              tone={preferences.leagueOptIn ? 'quiet' : 'secondary'}
            />
            <Text accessibilityLiveRegion="polite" style={styles.statusNote}>
              {preferences.leagueOptIn
                ? '이 기기에 참여 의사를 저장했어요. 리그가 열리기 전에는 아무 점수도 밖으로 보내지 않아요.'
                : '지금은 참여 안 함이에요.'}
            </Text>
          </Card>
        </>
      ) : null}

      <SectionHeader title="커뮤니티에서 지키는 것" compact />
      <Card style={styles.notReadyCard} tone="warm">
        <Text style={styles.notReadyBody}>
          가짜 사용자와 자동으로 만든 글을 넣지 않아요. 내 기록을 저절로 공개하지 않고, 무엇을
          올릴지는 항상 본인이 골라요. 신고와 차단은 서버가 연결될 때 함께 열려요.
        </Text>
        <Text style={styles.statusNote}>
          러닝이 궁금할 때 읽는 안내 글은 이 화면이 아니라 러닝 궁금증 화면에 있어요.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  guideButton: { minHeight: layout.touchTarget },
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
  notReadyCard: { gap: spacing.xs },
  notReadyTitle: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
  },
  notReadyBody: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  button: { marginTop: spacing.sm, minHeight: layout.touchTarget },
  statusNote: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
});
