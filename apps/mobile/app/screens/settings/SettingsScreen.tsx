// 설정 화면입니다. 음성·알림·외부 연동·계정과 앱 정보를 모으고, 로그인 비활성 사유를 그대로 알립니다.
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import type { Session, UserIdentity } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Banner, Button, Card, Chip, SectionHeader } from '../../design-system/components';
import { palette, spacing, typeScale } from '../../design-system/theme';
import { BADGE_RULE_VERSION } from '../../../domains/badges/rules';
import { COACH_CONTENT_VERSION } from '../../../domains/coaching/model';
import { SHOE_DATA_VERSION } from '../../../domains/shoes/catalog';
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

const PRIVACY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://robom.kr/privacy/runningbom';
const SUPPORT_URL = process.env.EXPO_PUBLIC_SUPPORT_URL ?? 'https://robom.kr/support';

const speechRates: Array<[number, string]> = [
  [0.85, '느리게'],
  [1, '보통'],
  [1.15, '빠르게'],
];

const guidanceLevels: Array<[string, string]> = [
  ['minimal', '최소'],
  ['standard', '표준'],
  ['detailed', '자세히'],
];

const integrations = [
  { id: 'samsung-health', name: '삼성 헬스', requirement: 'Samsung Health Data SDK 파트너 승인 필요' },
  { id: 'garmin', name: 'Garmin Connect', requirement: 'Garmin Developer Program 승인과 OAuth 키 필요' },
  { id: 'nike-run-club', name: 'Nike Run Club', requirement: '공개 API 없음 · 별도 데이터 제휴 필요' },
];

export function SettingsScreen({ onOpenProfile }: { onOpenProfile: () => void }) {
  const { preferences, updatePreferences, refreshActivities } = useAppState();
  const { feed } = useRaceState();
  const [session, setSession] = useState<Session | null>(null);
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [accountMessage, setAccountMessage] = useState('');

  const providers = providerMatrix();
  const enabledProviders = providers.filter((provider) => provider.enabled);
  const appVersion =
    Constants.expoConfig?.version ?? Application.nativeApplicationVersion ?? 'unknown';
  const buildVersion = Application.nativeBuildVersion ?? 'dev';
  const releaseChannel =
    typeof Constants.expoConfig?.extra?.releaseChannel === 'string'
      ? Constants.expoConfig.extra.releaseChannel
      : 'local / candidate';
  const sourceSha =
    typeof Constants.expoConfig?.extra?.sourceSha === 'string'
      ? Constants.expoConfig.extra.sourceSha
      : 'local';

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
  }, [session]);

  async function shareExport() {
    const data = await exportLocalData();
    await Share.share({ title: '러닝봄 로컬 데이터', message: JSON.stringify(data, null, 2) });
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

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
      <SectionHeader title="음성 코칭" subtitle="말하기 속도와 안내 자세히 정도를 고를 수 있어요." />
      <Card style={styles.card}>
        <Text style={styles.rowTitle}>말하기 속도</Text>
        <View style={styles.chips}>
          {speechRates.map(([value, label]) => (
            <Chip
              key={label}
              label={label}
              onPress={() => void updatePreferences({ speechRate: value })}
              selected={Math.abs(preferences.speechRate - value) < 0.01}
              tone="accent"
            />
          ))}
        </View>
        <Text style={styles.rowTitle}>안내 정도</Text>
        <View style={styles.chips}>
          {guidanceLevels.map(([value, label]) => (
            <Chip
              key={value}
              label={label}
              onPress={() =>
                void updatePreferences({
                  coachGuidance: value as typeof preferences.coachGuidance,
                })
              }
              selected={preferences.coachGuidance === value}
              tone="accent"
            />
          ))}
        </View>
      </Card>

      <SectionHeader title="알림" subtitle="대회 접수 알림은 대회 화면에서 대회별로 예약해요." />
      <Card style={styles.card}>
        <Text style={styles.rowMeta}>
          알림 권한을 거부해도 대회 탐색과 공식 링크는 그대로 사용할 수 있어요. 러닝봄은 마케팅
          알림을 보내지 않습니다.
        </Text>
      </Card>

      <SectionHeader title="외부 기록 연동" subtitle="연결되지 않은 것은 연결되지 않았다고 적어요." />
      <Card style={styles.card}>
        <Banner
          title="연동 준비 중"
          body="삼성 헬스·Garmin·Nike Run Club 가져오기는 각 서비스의 공식 승인과 자격증명이 연결된 뒤에 열립니다. 지금은 코치 기록과 직접 입력만 저장돼요."
          tone="warning"
        />
        {integrations.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.rowMeta}>{item.requirement}</Text>
            </View>
            <Chip label="준비 중" />
          </View>
        ))}
      </Card>

      <SectionHeader title="연결된 로그인" subtitle="핵심 기능은 로그인 없이 사용할 수 있어요." />
      <Card style={styles.card}>
        <Banner
          title="지금 소셜 로그인이 꺼져 있는 이유"
          body="구글·카카오·네이버·애플 로그인은 운영 인증 정보(OAuth 자격증명)가 아직 연결되지 않아 이 빌드에서 꺼져 있어요. 그래서 현재는 로그인 없이 기기 저장 방식으로 기록을 보관합니다. 자격증명이 연결되고 검증이 끝나면 이 화면에서 바로 켜집니다."
          tone="info"
        />
        {providers.map((provider) => (
          <View key={provider.provider} style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{provider.provider.toUpperCase()}</Text>
              {!provider.enabled && provider.blocker ? (
                <Text style={styles.rowMeta}>{provider.blocker}</Text>
              ) : null}
            </View>
            <Chip
              label={provider.enabled ? '사용 가능' : '비활성'}
              tone={provider.enabled ? 'positive' : 'neutral'}
            />
          </View>
        ))}
        <Text style={styles.rowMeta}>현재 커뮤니티 모드 · {communityMode()}</Text>
        {session ? (
          <View style={styles.actions}>
            <Text style={styles.rowMeta}>
              로그인됨 · {session.user.email ?? session.user.id.slice(0, 8)}
            </Text>
            {identities.map((identity) => (
              <View key={identity.id} style={styles.row}>
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
                (provider) => !identities.some((identity) => identity.provider === provider.provider),
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
            ) : null}
            <Button label="로그아웃" onPress={() => void logout()} tone="secondary" />
            <Button label="계정 삭제 요청" onPress={confirmAccountDeletion} tone="danger" />
          </View>
        ) : enabledProviders.length > 0 ? (
          <View style={styles.actions}>
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
            사용할 수 있는 로그인 수단이 없어 로그인 버튼을 노출하지 않아요.
          </Text>
        )}
        {accountMessage ? (
          <Text accessibilityLiveRegion="polite" style={styles.statusText}>
            {accountMessage}
          </Text>
        ) : null}
      </Card>

      <SectionHeader title="프로필과 데이터" />
      <Card style={styles.card}>
        <Button label="프로필 편집" onPress={onOpenProfile} tone="secondary" />
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
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text selectable style={styles.infoValue}>
        {value}
      </Text>
    </View>
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
  card: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: palette.ink, fontSize: typeScale.bodySmall, fontWeight: '800' },
  rowMeta: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 18 },
  actions: { gap: spacing.sm },
  statusText: { color: palette.accentDark, fontSize: typeScale.caption, lineHeight: 18 },
  info: { paddingVertical: spacing.xs },
  infoRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoLabel: { width: 112, color: palette.muted, fontSize: typeScale.caption, fontWeight: '700' },
  infoValue: {
    flex: 1,
    minWidth: 0,
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    fontWeight: '700',
  },
});
