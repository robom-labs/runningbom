// 로컬 프로필, 기록, 배지, 계정·개인정보와 앱 빌드 정보를 한곳에 제공합니다.
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import type { Session, UserIdentity } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Chip, Metric, SectionHeader, Wordmark } from '../../design-system/components';
import { palette, spacing, typeScale } from '../../design-system/theme';
import { activitySourceLabels } from '../../../domains/activities/types';
import { BADGE_RULE_VERSION, badgeDefinitions } from '../../../domains/badges/rules';
import { COACH_CONTENT_VERSION } from '../../../domains/coaching/model';
import { SHOE_DATA_VERSION, shoes } from '../../../domains/shoes/catalog';
import {
  currentIdentities,
  currentSession,
  linkIdentity,
  providerMatrix,
  signIn,
  signOut,
  unlinkIdentity,
  type LoginProvider,
} from '../../../domains/identity/auth';
import {
  DB_SCHEMA_VERSION,
  clearLocalActivityData,
  exportLocalData,
  pendingSelfLoggedActivitySyncCount,
} from '../../../services/storage/localDatabase';
import { syncPendingSelfLoggedActivities } from '../../../services/supabase/activitySync';
import { communityMode } from '../../../services/supabase/client';
import { requestAccountDeletion } from '../../../services/supabase/community';
import { useAppState } from '../../state/AppStateProvider';
import { useRaceState } from '../../state/RaceStateProvider';
import { ManualActivityCard } from './ManualActivityCard';

const PRIVACY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://robom.kr/privacy/runningbom';
const SUPPORT_URL = process.env.EXPO_PUBLIC_SUPPORT_URL ?? 'https://robom.kr/support';

export function MyScreen() {
  const {
    preferences,
    activities,
    streak,
    badges,
    updatePreferences,
    completeActivity,
    refreshActivities,
  } = useAppState();
  const { feed } = useRaceState();
  const selectedBadge =
    badges.find((badge) => badge.id === preferences.featuredBadgeId) ?? badges.at(0);
  const currentShoe = shoes.find((shoe) => shoe.id === preferences.currentShoeId);
  const latestActivities = useMemo(() => activities.slice(0, 5), [activities]);
  const appVersion = Constants.expoConfig?.version ?? Application.nativeApplicationVersion ?? 'unknown';
  const buildVersion = Application.nativeBuildVersion ?? 'dev';
  const releaseChannel =
    typeof Constants.expoConfig?.extra?.releaseChannel === 'string'
      ? Constants.expoConfig.extra.releaseChannel
      : 'local / candidate';
  const sourceSha =
    typeof Constants.expoConfig?.extra?.sourceSha === 'string'
      ? Constants.expoConfig.extra.sourceSha
      : 'local';
  const providers = providerMatrix();
  const enabledProviders = providers.filter((provider) => provider.enabled);
  const [session, setSession] = useState<Session | null>(null);
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [accountMessage, setAccountMessage] = useState('');
  const [neighborhoodDraft, setNeighborhoodDraft] = useState(
    preferences.neighborhoodLabel ?? '',
  );
  const [nicknameDraft, setNicknameDraft] = useState(preferences.nickname);
  const [bioDraft, setBioDraft] = useState(preferences.profileBio);
  const [profileMessage, setProfileMessage] = useState('');

  useEffect(() => {
    let active = true;
    void currentSession()
      .then((next) => {
        if (!active) return;
        setSession(next);
        setIdentities(next?.user.identities ?? []);
      })
      .catch(() => {
        if (active) setAccountMessage('로그인 상태를 확인하지 못했어요.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void pendingSelfLoggedActivitySyncCount()
      .then((count) => {
        if (active) setPendingSyncCount(count);
      })
      .catch(() => {
        if (active) setPendingSyncCount(0);
      });
    return () => {
      active = false;
    };
  }, [activities, session]);

  async function shareExport() {
    const data = await exportLocalData();
    await Share.share({
      title: '러닝봄 로컬 데이터',
      message: JSON.stringify(data, null, 2),
    });
  }

  function confirmLocalDelete() {
    Alert.alert(
      '기기 기록을 삭제할까요?',
      '이 기기의 활동·스트릭·배지 진행을 삭제합니다. 이 작업은 되돌릴 수 없어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => void clearLocalActivityData().then(refreshActivities),
        },
      ],
    );
  }

  async function login(provider: LoginProvider) {
    setAccountMessage('');
    try {
      const next = await signIn(provider);
      setSession(next);
      setIdentities(next.user.identities ?? []);
      setAccountMessage('로그인했어요. 이 기기의 기록은 자동 병합하지 않습니다.');
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : '로그인하지 못했어요.');
    }
  }

  async function logout() {
    try {
      await signOut();
      setSession(null);
      setIdentities([]);
      setAccountMessage('로그아웃했어요. 기기 기록은 그대로 유지됩니다.');
    } catch {
      setAccountMessage('로그아웃하지 못했어요.');
    }
  }

  function confirmAccountDeletion() {
    Alert.alert(
      '계정 삭제를 요청할까요?',
      '서버 계정과 동기화 데이터를 삭제 요청합니다. 기기 활동 기록은 별도로 삭제할 수 있어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제 요청',
          style: 'destructive',
          onPress: () => {
            void requestAccountDeletion()
              .then(signOut)
              .then(() => {
                setSession(null);
                setIdentities([]);
                setAccountMessage('계정 삭제 요청을 접수했어요.');
              })
              .catch(() => setAccountMessage('계정 삭제 요청을 접수하지 못했어요.'));
          },
        },
      ],
    );
  }

  async function connectProvider(provider: LoginProvider) {
    setAccountMessage('');
    try {
      const next = await linkIdentity(provider);
      setIdentities(next);
      setAccountMessage(`${provider.toUpperCase()} 로그인 수단을 연결했어요.`);
    } catch (error) {
      setAccountMessage(
        error instanceof Error ? error.message : '로그인 수단을 연결하지 못했어요.',
      );
    }
  }

  function confirmUnlink(identity: UserIdentity) {
    Alert.alert(
      '로그인 수단을 해제할까요?',
      `${identity.provider.toUpperCase()} 연결을 해제합니다. 마지막 로그인 수단은 해제할 수 없어요.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '연결 해제',
          style: 'destructive',
          onPress: () => {
            void unlinkIdentity(identity, identities)
              .then(currentIdentities)
              .then((next) => {
                setIdentities(next);
                setAccountMessage('로그인 수단 연결을 해제했어요.');
              })
              .catch((error: unknown) =>
                setAccountMessage(
                  error instanceof Error ? error.message : '연결을 해제하지 못했어요.',
                ),
              );
          },
        },
      ],
    );
  }

  function confirmActivitySync() {
    Alert.alert(
      '기기 기록을 계정에 저장할까요?',
      `직접 입력한 기록 ${pendingSyncCount}건만 현재 계정에 저장합니다. 코치 기록은 서버 검증 전까지 기기에만 남겨요.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '저장',
          onPress: () => {
            void syncPendingSelfLoggedActivities()
              .then(async (result) => {
                setPendingSyncCount(result.remaining);
                await refreshActivities();
                setAccountMessage(
                  result.synced > 0
                    ? `직접 입력 기록 ${result.synced}건을 계정에 저장했어요.`
                    : '새로 저장할 직접 입력 기록이 없어요.',
                );
              })
              .catch((error: unknown) =>
                setAccountMessage(
                  error instanceof Error ? error.message : '기록을 동기화하지 못했어요.',
                ),
              );
          },
        },
      ],
    );
  }

  function saveSelectedNeighborhood() {
    const normalized = neighborhoodDraft.trim().replace(/\s+/g, ' ');
    void updatePreferences({
      neighborhoodLabel: normalized || undefined,
      neighborhoodCode: normalized ? `selected:${normalized}` : undefined,
    });
  }

  function saveProfile() {
    const nickname = nicknameDraft.normalize('NFKC').trim().replace(/\s+/g, ' ');
    const bio = bioDraft.normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (nickname.length < 2 || nickname.length > 16) {
      setProfileMessage('닉네임은 2자부터 16자까지 입력해 주세요.');
      return;
    }
    if (/^(운영자|관리자|로봄|runningbom|러닝봄)$/iu.test(nickname)) {
      setProfileMessage('운영 주체로 오해할 수 있는 닉네임은 사용할 수 없어요.');
      return;
    }
    void updatePreferences({ nickname, profileBio: bio.slice(0, 120) });
    setNicknameDraft(nickname);
    setBioDraft(bio.slice(0, 120));
    setProfileMessage('이 기기의 프로필을 저장했어요.');
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Wordmark compact />
        <Text style={styles.heading}>나의 러닝 리듬</Text>

        <Card style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{preferences.nickname.slice(0, 1)}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.nickname}>{preferences.nickname}</Text>
            <Text style={styles.bio}>{preferences.profileBio || '꾸준한 움직임을 쌓는 중'}</Text>
            <View style={styles.chips}>
              <Chip label={streak.tier} tone="accent" />
              {selectedBadge ? <Chip label={selectedBadge.title} tone="positive" /> : null}
              {preferences.neighborhoodLabel ? <Chip label={preferences.neighborhoodLabel} /> : null}
            </View>
          </View>
        </Card>

        <Card style={styles.profileEditor}>
          <Text style={styles.editorTitle}>프로필 편집</Text>
          <TextInput
            accessibilityLabel="닉네임"
            autoCapitalize="none"
            maxLength={16}
            onChangeText={setNicknameDraft}
            placeholder="닉네임"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={nicknameDraft}
          />
          <TextInput
            accessibilityLabel="소개"
            maxLength={120}
            multiline
            onChangeText={setBioDraft}
            placeholder="나의 러닝 리듬을 짧게 소개해 주세요."
            placeholderTextColor={palette.muted}
            style={[styles.input, styles.bioInput]}
            value={bioDraft}
          />
          <Button label="프로필 저장" onPress={saveProfile} tone="secondary" />
          {profileMessage ? (
            <Text accessibilityLiveRegion="polite" style={styles.statusText}>
              {profileMessage}
            </Text>
          ) : null}
        </Card>

        <View style={styles.metrics}>
          <Metric label="현재 스트릭" value={`${streak.current}일`} style={styles.metric} />
          <Metric label="최고 스트릭" value={`${streak.best}일`} style={styles.metric} />
          <Metric label="이번 주 러닝" value={`${streak.weeklyRunDays}/3`} style={styles.metric} />
        </View>

        <SectionHeader title="배지 보관함" subtitle={`규칙 ${BADGE_RULE_VERSION}`} />
        <ScrollView horizontal contentContainerStyle={styles.badgeRow} showsHorizontalScrollIndicator={false}>
          {badgeDefinitions.map((badge) => {
            const unlocked = badges.some((item) => item.id === badge.id);
            return (
              <Card key={badge.id} style={[styles.badge, !unlocked && styles.locked]}>
                <Text style={styles.badgeTitle}>{badge.title}</Text>
                <Text style={styles.badgeBody}>{badge.description}</Text>
                <Button
                  disabled={!unlocked}
                  label={preferences.featuredBadgeId === badge.id ? '대표 배지' : unlocked ? '대표로 설정' : '진행 중'}
                  onPress={() => void updatePreferences({ featuredBadgeId: badge.id })}
                  tone="quiet"
                  style={styles.badgeButton}
                />
              </Card>
            );
          })}
        </ScrollView>

        <SectionHeader title="최근 활동" />
        <ManualActivityCard
          onSave={async (input) => {
            await completeActivity({ ...input, source: 'SELF_LOGGED' });
          }}
        />
        <Card style={styles.listCard}>
          {latestActivities.length > 0 ? (
            latestActivities.map((activity) => (
              <View key={activity.id} style={styles.listRow}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>
                    {activity.kind === 'run' ? '러닝' : activity.kind === 'walk' ? '걷기' : '회복'} · {activity.durationMinutes}분
                  </Text>
                  <Text style={styles.rowMeta}>
                    {activitySourceLabels[activity.source]} · {activity.completedAt.slice(0, 10)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>아직 완료한 활동이 없어요.</Text>
          )}
        </Card>

        <SectionHeader title="내 러닝화" />
        <Card>
          <Text style={styles.rowTitle}>{currentShoe ? `${currentShoe.brand} ${currentShoe.model}` : '선택한 러닝화 없음'}</Text>
          <Text style={styles.rowMeta}>러닝화 탐색에서 공식 확인 제품을 비교할 수 있어요.</Text>
        </Card>

        <SectionHeader
          title="내 동네"
          subtitle="현재 위치 인증이 아니라 사용자가 직접 선택하는 표시입니다."
        />
        <Card style={styles.actions}>
          <TextInput
            accessibilityLabel="표시할 동네"
            autoCapitalize="none"
            maxLength={30}
            onChangeText={setNeighborhoodDraft}
            placeholder="예: 서울 성동구"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={neighborhoodDraft}
          />
          <Button
            label={neighborhoodDraft.trim() ? '선택한 동네 저장' : '동네 표시 지우기'}
            onPress={saveSelectedNeighborhood}
            tone="secondary"
          />
        </Card>

        <SectionHeader title="연결된 로그인" subtitle="핵심 기능은 로그인 없이 사용할 수 있어요." />
        <Card style={styles.listCard}>
          {providerMatrix().map((provider) => (
            <View key={provider.provider} style={styles.providerRow}>
              <Text style={styles.rowTitle}>{provider.provider.toUpperCase()}</Text>
              <Chip
                label={provider.enabled ? '사용 가능' : '비활성'}
                tone={provider.enabled ? 'positive' : 'neutral'}
              />
            </View>
          ))}
          <Text style={styles.rowMeta}>현재 커뮤니티 모드 · {communityMode()}</Text>
          {session ? (
            <View style={styles.accountActions}>
              <Text style={styles.rowMeta}>
                로그인됨 · {session.user.email ?? session.user.id.slice(0, 8)}
              </Text>
              {identities.map((identity) => (
                <View key={identity.id} style={styles.identityRow}>
                  <Text style={styles.rowMeta}>{identity.provider.toUpperCase()} 연결됨</Text>
                  <Button
                    disabled={identities.length <= 1}
                    label="연결 해제"
                    onPress={() => confirmUnlink(identity)}
                    tone="quiet"
                  />
                </View>
              ))}
              {enabledProviders
                .filter(
                  (provider) =>
                    !identities.some((identity) => identity.provider === provider.provider),
                )
                .map((provider) => (
                  <Button
                    key={`connect:${provider.provider}`}
                    label={`${provider.provider.toUpperCase()} 추가 연결`}
                    onPress={() => void connectProvider(provider.provider)}
                    tone="secondary"
                  />
                ))}
              {pendingSyncCount > 0 ? (
                <Button
                  label={`직접 입력 기록 ${pendingSyncCount}건 계정에 저장`}
                  onPress={confirmActivitySync}
                  tone="secondary"
                />
              ) : (
                <Text style={styles.rowMeta}>계정에 저장할 직접 입력 기록이 없어요.</Text>
              )}
              <Button label="로그아웃" onPress={() => void logout()} tone="secondary" />
              <Button label="계정 삭제 요청" onPress={confirmAccountDeletion} tone="danger" />
            </View>
          ) : enabledProviders.length > 0 ? (
            <View style={styles.accountActions}>
              {enabledProviders.map((provider) => (
                <Button
                  key={provider.provider}
                  label={`${provider.provider.toUpperCase()}로 로그인`}
                  onPress={() => void login(provider.provider)}
                  tone="secondary"
                />
              ))}
            </View>
          ) : (
            <Text style={styles.rowMeta}>
              외부 OAuth 설정이 검증되기 전에는 로그인 버튼을 노출하지 않아요.
            </Text>
          )}
          {accountMessage ? (
            <Text accessibilityLiveRegion="polite" style={styles.statusText}>
              {accountMessage}
            </Text>
          ) : null}
        </Card>

        <SectionHeader title="데이터와 계정" />
        <Card style={styles.actions}>
          <Button label="기기 데이터 내보내기" onPress={() => void shareExport()} tone="secondary" />
          <Button label="기기 활동 기록 삭제" onPress={confirmLocalDelete} tone="danger" />
          <Button
            label="개인정보처리방침"
            onPress={() => void Linking.openURL(PRIVACY_URL)}
            tone="quiet"
          />
          <Button label="문의하기" onPress={() => void Linking.openURL(SUPPORT_URL)} tone="quiet" />
        </Card>

        <SectionHeader title="앱 정보" />
        <Card style={styles.info}>
          <InfoRow label="설치 채널" value={releaseChannel} />
          <InfoRow label="앱 버전" value={appVersion} />
          <InfoRow label="versionCode" value={buildVersion} />
          <InfoRow label="source SHA" value={sourceSha} />
          <InfoRow label="대회 데이터" value={feed.revision} />
          <InfoRow label="러닝화 데이터" value={SHOE_DATA_VERSION} />
          <InfoRow label="코칭 데이터" value={COACH_CONTENT_VERSION} />
          <InfoRow label="배지 규칙" value={BADGE_RULE_VERSION} />
          <InfoRow label="DB schema" value={String(DB_SCHEMA_VERSION)} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text selectable style={styles.infoValue}>{value}</Text>
    </View>
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
  heading: { color: palette.ink, fontSize: typeScale.display, fontWeight: '900', marginTop: spacing.md },
  profile: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  profileEditor: { gap: spacing.sm, marginTop: spacing.sm },
  editorTitle: { color: palette.ink, fontSize: typeScale.body, fontWeight: '900' },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: palette.white, fontSize: 26, fontWeight: '900' },
  profileCopy: { flex: 1, minWidth: 0 },
  nickname: { color: palette.ink, fontSize: typeScale.title, fontWeight: '900' },
  bio: { color: palette.muted, fontSize: typeScale.bodySmall, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  metrics: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  metric: {
    flex: 1,
    minWidth: 0,
    backgroundColor: palette.surface,
    borderRadius: 18,
    padding: spacing.md,
  },
  badgeRow: { gap: spacing.sm },
  badge: { width: 190, minHeight: 150 },
  locked: { opacity: 0.48 },
  badgeTitle: { color: palette.ink, fontSize: typeScale.body, fontWeight: '900' },
  badgeBody: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 18, marginTop: spacing.xs },
  badgeButton: { marginTop: 'auto' },
  listCard: { paddingVertical: spacing.xs },
  listRow: { minHeight: 64, justifyContent: 'center', borderBottomColor: palette.line, borderBottomWidth: StyleSheet.hairlineWidth },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: palette.ink, fontSize: typeScale.body, fontWeight: '800' },
  rowMeta: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 18, marginTop: 4 },
  emptyText: { color: palette.muted, fontSize: typeScale.bodySmall, paddingVertical: spacing.md },
  providerRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  identityRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actions: { gap: spacing.sm },
  accountActions: { gap: spacing.sm, marginTop: spacing.md },
  input: {
    minHeight: 48,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 16,
    color: palette.ink,
    backgroundColor: palette.surface,
    fontSize: 16,
    paddingHorizontal: spacing.md,
  },
  bioInput: {
    minHeight: 84,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  statusText: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  info: { paddingVertical: spacing.xs },
  infoRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomColor: palette.line, borderBottomWidth: StyleSheet.hairlineWidth },
  infoLabel: { width: 112, color: palette.muted, fontSize: typeScale.caption, fontWeight: '700' },
  infoValue: { flex: 1, minWidth: 0, color: palette.ink, fontSize: typeScale.bodySmall, fontWeight: '700' },
});
