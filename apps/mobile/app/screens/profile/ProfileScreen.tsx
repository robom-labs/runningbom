// 드로어 최상단에서 여는 프로필 화면입니다. 닉네임·목표·러닝 경력·보유 러닝화를 저장합니다.
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Chip, SectionHeader } from '../../design-system/components';
import { palette, radius, spacing, typeScale } from '../../design-system/theme';
import { shoes } from '../../../domains/shoes/catalog';
import {
  currentWeekProgress,
  goalMetricLabels,
  goalMetricUnits,
} from '../../../domains/badges/goals';
import { useAppState } from '../../state/AppStateProvider';

const experienceChoices = ['이제 시작', '1년 미만', '1~3년', '3년 이상'];

export function ProfileScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { preferences, updatePreferences, streak, badges, activities, weeklyGoal } = useAppState();
  const [nicknameDraft, setNicknameDraft] = useState(preferences.nickname);
  const [bioDraft, setBioDraft] = useState(preferences.profileBio);
  const [neighborhoodDraft, setNeighborhoodDraft] = useState(preferences.neighborhoodLabel ?? '');
  const [message, setMessage] = useState('');

  const featuredBadge =
    badges.find((badge) => badge.id === preferences.featuredBadgeId) ?? badges.at(0);
  const currentShoe = shoes.find((shoe) => shoe.id === preferences.currentShoeId);
  const progress = useMemo(
    () => currentWeekProgress(activities, weeklyGoal),
    [activities, weeklyGoal],
  );

  const experience = experienceChoices.find((choice) => preferences.profileBio.startsWith(choice));

  function saveProfile() {
    const nickname = nicknameDraft.normalize('NFKC').trim().replace(/\s+/g, ' ');
    const bio = bioDraft.normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (nickname.length < 2 || nickname.length > 16) {
      setMessage('닉네임은 2자부터 16자까지 입력해 주세요.');
      return;
    }
    if (/^(운영자|관리자|로봄|runningbom|러닝봄)$/iu.test(nickname)) {
      setMessage('운영 주체로 오해할 수 있는 닉네임은 사용할 수 없어요.');
      return;
    }
    void updatePreferences({ nickname, profileBio: bio.slice(0, 120) });
    setNicknameDraft(nickname);
    setBioDraft(bio.slice(0, 120));
    setMessage('이 기기의 프로필을 저장했어요.');
  }

  function saveNeighborhood() {
    const normalized = neighborhoodDraft.trim().replace(/\s+/g, ' ');
    void updatePreferences({
      neighborhoodLabel: normalized || undefined,
      neighborhoodCode: normalized ? `selected:${normalized}` : undefined,
    });
    setMessage(normalized ? '표시할 동네를 저장했어요.' : '동네 표시를 지웠어요.');
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
      <Card style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{preferences.nickname.slice(0, 1)}</Text>
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.nickname}>{preferences.nickname}</Text>
          <Text style={styles.bio}>{preferences.profileBio || '꾸준한 움직임을 쌓는 중'}</Text>
          <View style={styles.chips}>
            <Chip label={streak.tier} tone="accent" />
            {featuredBadge ? <Chip label={featuredBadge.title} tone="positive" /> : null}
            {preferences.neighborhoodLabel ? <Chip label={preferences.neighborhoodLabel} /> : null}
          </View>
          <Text style={styles.summary}>
            이번 주 {goalMetricLabels[weeklyGoal.metric]} 목표 {weeklyGoal.target}
            {goalMetricUnits[weeklyGoal.metric]} · {progress.label}
          </Text>
        </View>
      </Card>

      <SectionHeader title="프로필" subtitle="이 기기에만 저장되며 자동으로 공개되지 않아요." />
      <Card style={styles.card}>
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
          accessibilityLabel="소개와 목표"
          maxLength={120}
          multiline
          onChangeText={setBioDraft}
          placeholder="목표나 러닝 경력을 짧게 적어 주세요."
          placeholderTextColor={palette.muted}
          style={[styles.input, styles.bioInput]}
          value={bioDraft}
        />
        <View style={styles.chips}>
          {experienceChoices.map((choice) => (
            <Chip
              key={choice}
              label={choice}
              onPress={() =>
                setBioDraft((current) =>
                  current.startsWith(choice) ? current : `${choice} · ${current}`.slice(0, 120),
                )
              }
              selected={experience === choice}
            />
          ))}
        </View>
        <Button label="프로필 저장" onPress={saveProfile} tone="secondary" />
        {message ? (
          <Text accessibilityLiveRegion="polite" style={styles.message}>
            {message}
          </Text>
        ) : null}
      </Card>

      <SectionHeader title="보유 러닝화" subtitle="지금 신는 러닝화를 하나 골라 둘 수 있어요." />
      <Card style={styles.card}>
        <Text style={styles.rowTitle}>
          {currentShoe ? `${currentShoe.brand} ${currentShoe.model}` : '선택한 러닝화 없음'}
        </Text>
        <View style={styles.chips}>
          {shoes.slice(0, 8).map((shoe) => (
            <Chip
              key={shoe.id}
              label={`${shoe.brand} ${shoe.model}`}
              onPress={() =>
                void updatePreferences({
                  currentShoeId: preferences.currentShoeId === shoe.id ? undefined : shoe.id,
                })
              }
              selected={preferences.currentShoeId === shoe.id}
            />
          ))}
        </View>
      </Card>

      <SectionHeader
        title="내 동네"
        subtitle="위치 인증이 아니라 사용자가 직접 고르는 표시입니다."
      />
      <Card style={styles.card}>
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
          label={neighborhoodDraft.trim() ? '동네 저장' : '동네 표시 지우기'}
          onPress={saveNeighborhood}
          tone="secondary"
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.rowMeta}>
          계정 연결과 데이터 관리는 설정 화면에서 확인할 수 있어요.
        </Text>
        <Button label="설정 열기" onPress={onOpenSettings} tone="quiet" />
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
  header: { flexDirection: 'row', gap: spacing.md },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.navy,
  },
  avatarText: { color: palette.white, fontSize: 26, fontWeight: '900' },
  headerCopy: { flex: 1, minWidth: 0 },
  nickname: { color: palette.ink, fontSize: typeScale.title, fontWeight: '900' },
  bio: { color: palette.muted, fontSize: typeScale.bodySmall, marginTop: 4 },
  summary: { color: palette.inkSoft, fontSize: typeScale.caption, marginTop: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  card: { gap: spacing.sm },
  rowTitle: { color: palette.ink, fontSize: typeScale.bodySmall, fontWeight: '800' },
  rowMeta: { color: palette.muted, fontSize: typeScale.caption, lineHeight: 18 },
  input: {
    minHeight: 48,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    color: palette.ink,
    fontSize: 16,
    paddingHorizontal: spacing.md,
  },
  bioInput: { minHeight: 84, paddingTop: spacing.sm, textAlignVertical: 'top' },
  message: { color: palette.accentDark, fontSize: typeScale.caption, lineHeight: 18 },
});
