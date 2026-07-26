// 드로어 최상단에서 여는 프로필 화면입니다. 닉네임·목표·러닝 경력·보유 러닝화를 저장합니다.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  SearchField,
  SectionHeader,
  screenStyles,
} from '../../design-system/components';
import {
  borderWidth,
  fontWeight,
  layout,
  lineHeight,
  palette,
  radius,
  spacing,
  typeScale,
} from '../../design-system/theme';
// 러닝화 정본(123종)은 읽기만 합니다. 이 화면에서 카탈로그를 바꾸지 않습니다.
import {
  findShoeEntry,
  shoeCatalog,
  shoes,
  shoeSearchText,
} from '../../../domains/shoes/catalog';
import {
  currentWeekProgress,
  experienceLevels,
  goalMetricLabels,
  goalMetricUnits,
  type ExperienceLevel,
} from '../../../domains/badges/goals';
import {
  experienceFromLegacyBio,
  stripLegacyExperiencePrefix,
} from '../../../services/storage/preferences';
import { useAppState } from '../../state/AppStateProvider';

/** 검색 결과는 한 번에 이만큼만 그립니다(123종을 한꺼번에 그리지 않기 위해서예요). */
const shoeResultLimit = 12;

export function ProfileScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { preferences, updatePreferences, streak, badges, activities, weeklyGoal } = useAppState();
  const [nicknameDraft, setNicknameDraft] = useState(preferences.nickname);
  const [bioDraft, setBioDraft] = useState(preferences.profileBio);
  const [neighborhoodDraft, setNeighborhoodDraft] = useState(preferences.neighborhoodLabel ?? '');
  const [shoeQuery, setShoeQuery] = useState('');
  const [message, setMessage] = useState('');

  const featuredBadge =
    badges.find((badge) => badge.id === preferences.featuredBadgeId) ?? badges.at(0);
  // 새 정본에서 먼저 찾고, 예전 8종 목록으로 저장된 id도 계속 이름으로 보여 줍니다.
  const currentShoeId = preferences.currentShoeId;
  const currentShoeEntry = currentShoeId ? findShoeEntry(currentShoeId) : undefined;
  const legacyShoe = currentShoeId
    ? shoes.find((shoe) => shoe.id === currentShoeId)
    : undefined;
  const currentShoeLabel = currentShoeEntry
    ? `${currentShoeEntry.brand} ${currentShoeEntry.model}`
    : legacyShoe
      ? `${legacyShoe.brand} ${legacyShoe.model}`
      : undefined;
  const progress = useMemo(
    () => currentWeekProgress(activities, weeklyGoal),
    [activities, weeklyGoal],
  );

  // 전용 필드가 비어 있으면 예전에 profileBio 접두어로 저장된 값을 그대로 읽어 옵니다.
  const experience: ExperienceLevel | undefined =
    preferences.experienceLevel ?? experienceFromLegacyBio(preferences.profileBio);

  const shoeResults = useMemo(() => {
    const query = shoeQuery.normalize('NFKC').trim().toLocaleLowerCase('ko-KR');
    const matched = query
      ? shoeCatalog.filter((entry) => shoeSearchText(entry).includes(query))
      : shoeCatalog;
    return { total: matched.length, entries: matched.slice(0, shoeResultLimit) };
  }, [shoeQuery]);

  // 경력은 전용 필드에 저장하고, 소개 글에 남아 있던 옛 접두어는 한 번만 걷어냅니다.
  function chooseExperience(choice: ExperienceLevel) {
    const next = experience === choice ? undefined : choice;
    const cleaned = stripLegacyExperiencePrefix(preferences.profileBio);
    setBioDraft((current) => stripLegacyExperiencePrefix(current));
    void updatePreferences({ experienceLevel: next, profileBio: cleaned });
    setMessage(
      next
        ? `러닝 경력을 "${next}"으로 저장했어요. 주간 목표 추천에 반영돼요.`
        : '러닝 경력 표시를 지웠어요.',
    );
  }

  function chooseShoe(shoeId: string) {
    void updatePreferences({
      currentShoeId: preferences.currentShoeId === shoeId ? undefined : shoeId,
    });
  }

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
      contentContainerStyle={screenStyles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={screenStyles.root}
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
            {experience ? <Chip label={`러닝 경력 ${experience}`} /> : null}
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
        <Text style={styles.rowTitle}>러닝 경력</Text>
        <Text style={styles.rowMeta}>
          주간 목표 추천의 기준으로만 써요. 실력 평가가 아니고 언제든 다시 고를 수 있어요.
        </Text>
        <View accessibilityLabel="러닝 경력 선택" style={styles.chips}>
          {experienceLevels.map((choice) => (
            <Chip
              accessibilityLabel={`러닝 경력 ${choice}`}
              key={choice}
              label={choice}
              onPress={() => chooseExperience(choice)}
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

      <SectionHeader
        title="보유 러닝화"
        subtitle={`러닝화 정본 ${shoeCatalog.length}종에서 검색해 하나 골라 둘 수 있어요.`}
      />
      <Card style={styles.card}>
        <Text style={styles.rowTitle}>{currentShoeLabel ?? '선택한 러닝화 없음'}</Text>
        {currentShoeLabel ? (
          <Button
            label="선택 해제"
            onPress={() => void updatePreferences({ currentShoeId: undefined })}
            tone="quiet"
          />
        ) : null}
        <SearchField
          accessibilityLabel="러닝화 검색"
          onChangeText={setShoeQuery}
          placeholder="브랜드나 모델명으로 검색 (예: 페가수스, nike)"
          value={shoeQuery}
        />
        <Text accessibilityLiveRegion="polite" style={styles.rowMeta}>
          검색 결과 {shoeResults.total}종 중 {shoeResults.entries.length}종을 보여 줘요.
        </Text>
        {shoeResults.entries.length === 0 ? (
          <Text style={styles.rowMeta}>
            검색어와 맞는 러닝화가 없어요. 브랜드명이나 모델명 일부만 넣어 보세요.
          </Text>
        ) : null}
        {shoeResults.entries.map((entry) => {
          const selected = preferences.currentShoeId === entry.id;
          return (
            <Pressable
              accessibilityHint={selected ? '다시 누르면 선택을 해제해요' : '지금 신는 러닝화로 골라요'}
              accessibilityLabel={`${entry.brand} ${entry.model}. ${entry.subCategory}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={entry.id}
              onPress={() => chooseShoe(entry.id)}
              style={({ pressed }) => [
                styles.shoeRow,
                selected && styles.shoeRowSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.shoeCopy}>
                <Text style={styles.rowTitle}>
                  {entry.brand} {entry.model}
                </Text>
                <Text style={styles.rowMeta}>
                  {entry.subCategory} · {entry.priceBand}
                </Text>
              </View>
              {selected ? <Chip label="선택함" tone="positive" /> : null}
            </Pressable>
          );
        })}
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
  header: { flexDirection: 'row', gap: spacing.md },
  avatar: {
    minWidth: 64,
    minHeight: 64,
    padding: spacing.xs,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.navy,
  },
  avatarText: {
    color: palette.onNavy,
    fontSize: typeScale.headline,
    lineHeight: lineHeight.headline,
    fontWeight: fontWeight.heavy,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  nickname: {
    color: palette.ink,
    fontSize: typeScale.title,
    lineHeight: lineHeight.title,
    fontWeight: fontWeight.heavy,
  },
  bio: {
    color: palette.muted,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    marginTop: spacing.xxs,
  },
  summary: {
    color: palette.inkSoft,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    marginTop: spacing.xs,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  card: { gap: spacing.sm },
  rowTitle: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.bold,
  },
  rowMeta: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  input: {
    minHeight: layout.touchTarget,
    borderColor: palette.line,
    borderWidth: borderWidth.thin,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    color: palette.ink,
    fontSize: typeScale.body,
    paddingHorizontal: spacing.md,
  },
  bioInput: { minHeight: 84, paddingTop: spacing.sm, textAlignVertical: 'top' },
  shoeRow: {
    minHeight: layout.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderColor: palette.line,
    borderWidth: borderWidth.thin,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  shoeRowSelected: { borderColor: palette.accentStrong, borderWidth: borderWidth.emphasis },
  shoeCopy: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
  message: {
    color: palette.accentDark,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
});
