// 공개 피드와 선택 로그인 기반 크루·리그의 보호모드 상태를 보여줍니다.
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Chip, Wordmark } from '../../design-system/components';
import { palette, spacing, typeScale } from '../../design-system/theme';
import { reactionKinds, reactionLabels, type PublicPost } from '../../../domains/social/types';
import { featureFlags } from '../../../services/feature-flags/flags';
import { loadPublicFeed } from '../../../services/supabase/community';
import { communityMode, type CommunityMode } from '../../../services/supabase/client';
import { useAppState } from '../../state/AppStateProvider';

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

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Wordmark compact />
        <Text style={styles.heading}>함께 달리는 공간</Text>
        <Text style={styles.subtitle}>
          {featureFlags.social
            ? '공개 글은 로그인 없이 읽고, 참여 기능은 로그인 후 사용해요.'
            : '외부 커뮤니티 연결이 검증되기 전에는 코어 러닝 기능만 제공해요.'}
        </Text>

        <View accessibilityRole="tablist" style={styles.tabs}>
          {(['피드', '크루', '리그'] as Section[]).map((value) => (
            <Chip
              key={value}
              label={value}
              selected={section === value}
              onPress={() => setSection(value)}
              tone="accent"
              accessibilityRole="tab"
            />
          ))}
        </View>

        <View accessibilityLiveRegion="polite" style={styles.modeRow}>
          <Chip label={modeLabels[mode]} tone={mode === 'NORMAL' ? 'positive' : 'warning'} />
          <Text style={styles.modeText}>{message}</Text>
        </View>

        {section === '피드' ? (
          posts.length > 0 ? (
            <View style={styles.list}>
              {posts.map((post) => (
                <Card key={post.id} style={styles.post}>
                  <Text style={styles.author}>{post.authorNickname}</Text>
                  <Text style={styles.postBody}>{post.body}</Text>
                  <View style={styles.reactions}>
                    {reactionKinds.map((kind) => (
                      <Chip
                        key={kind}
                        label={`${reactionLabels[kind]} ${post.reactionCounts[kind] ?? 0}`}
                      />
                    ))}
                  </View>
                  <Text style={styles.meta}>댓글 {post.commentCount} · {post.createdAt.slice(0, 10)}</Text>
                </Card>
              ))}
            </View>
          ) : (
            <Card style={styles.empty}>
              <Text style={styles.emptyTitle}>첫 공개 글을 기다리고 있어요</Text>
              <Text style={styles.emptyBody}>
                코칭을 마친 뒤에도 자동 게시하지 않으며, 사용자가 본문과 공개범위를 확인해야 게시됩니다.
              </Text>
            </Card>
          )
        ) : null}

        {section === '크루' ? (
          <Card style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {featureFlags.social && mode === 'NORMAL'
                ? '크루 연결을 검증하는 중이에요'
                : '크루는 안전 검증 뒤 열려요'}
            </Text>
            <Text style={styles.emptyBody}>
              공개·승인제·비공개 크루, 역할, 일정과 참석 구조는 서버 연결 뒤 활성화합니다.
              번개런과 실시간 위치는 제공하지 않아요.
            </Text>
            <Text style={styles.statusNote}>
              실제 Supabase 역할별 공격 테스트와 운영자 검수 흐름이 통과되기 전에는
              가입·생성 버튼을 노출하지 않습니다.
            </Text>
          </Card>
        ) : null}

        {section === '리그' ? (
          <Card style={styles.empty}>
            <Text style={styles.emptyTitle}>꾸준함 리그는 참여를 선택해야 해요</Text>
            <Text style={styles.emptyBody}>
              기본은 꺼짐이며, 코치로 완료한 활동만 하루 한 번·주 5일 한도로 계산합니다.
              전체 세계 순위나 꼴찌 독촉은 만들지 않아요.
            </Text>
            <Button
              label={preferences.leagueOptIn ? '리그 참여 해제' : '리그 참여 선택'}
              onPress={() =>
                void updatePreferences({ leagueOptIn: !preferences.leagueOptIn })
              }
              tone={preferences.leagueOptIn ? 'quiet' : 'secondary'}
              style={styles.button}
            />
            <Text accessibilityLiveRegion="polite" style={styles.statusNote}>
              {preferences.leagueOptIn
                ? '이 기기에서 참여 의사를 저장했어요. 서버 리그가 열리기 전에는 공개 점수로 전송하지 않습니다.'
                : '현재 기본값은 참여 안 함입니다.'}
            </Text>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  content: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    padding: spacing.md,
    paddingBottom: 112,
  },
  heading: {
    color: palette.ink,
    fontSize: typeScale.display,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: spacing.md,
  },
  subtitle: { color: palette.muted, fontSize: typeScale.body, lineHeight: 24, marginTop: spacing.xs },
  tabs: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.lg },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  modeText: { flex: 1, minWidth: 0, color: palette.muted, fontSize: typeScale.caption, lineHeight: 18 },
  list: { gap: spacing.md },
  post: { gap: spacing.sm },
  author: { color: palette.ink, fontSize: typeScale.body, fontWeight: '900' },
  postBody: { color: palette.inkSoft, fontSize: typeScale.body, lineHeight: 24 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  meta: { color: palette.muted, fontSize: typeScale.caption },
  empty: { backgroundColor: palette.surfaceWarm },
  emptyTitle: { color: palette.ink, fontSize: typeScale.titleSmall, fontWeight: '900' },
  emptyBody: { color: palette.inkSoft, fontSize: typeScale.bodySmall, lineHeight: 21, marginTop: spacing.sm },
  button: { marginTop: spacing.lg },
  statusNote: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
});
