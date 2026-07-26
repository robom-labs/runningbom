// 공식 출처가 확인된 러닝화를 검색하고 최대 세 개까지 비교하는 탐색 화면입니다.
import * as Linking from 'expo-linking';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Card, Chip } from '../../app/design-system/components';
import { palette, radius, spacing, typeScale } from '../../app/design-system/theme';
import { useAppState } from '../../app/state/AppStateProvider';
import {
  recommendShoes,
  shoes,
  type Shoe,
  type ShoeFinderAnswers,
  type ShoePriority,
  type ShoeSurface,
} from './catalog';

type Mode = 'browse' | 'finder';

const surfaceLabels: Record<ShoeSurface, string> = {
  road: '도로',
  treadmill: '러닝머신',
  mixed: '여러 환경',
};
const priorityLabels: Record<ShoePriority, string> = {
  comfort: '편안함',
  balanced: '균형',
  speed: '속도',
};

export function ShoeScreen({
  upcomingOnly = false,
  focusedShoeId,
}: {
  upcomingOnly?: boolean;
  focusedShoeId?: string;
}) {
  const { preferences, updatePreferences } = useAppState();
  const [mode, setMode] = useState<Mode>('browse');
  const [query, setQuery] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [answers, setAnswers] = useState<ShoeFinderAnswers>({
    surface: 'road',
    distance: 'daily',
    priority: 'balanced',
    budget: 'open',
  });

  const visible = useMemo(() => {
    const base = upcomingOnly ? shoes.filter((shoe) => shoe.status !== 'available') : shoes;
    const normalized = query.trim().toLocaleLowerCase('ko-KR');
    const filtered = !normalized ? base : base.filter((shoe) =>
      `${shoe.brand} ${shoe.model}`.toLocaleLowerCase('ko-KR').includes(normalized),
    );
    if (!focusedShoeId) return filtered;
    return [...filtered].sort((left, right) => {
      if (left.id === focusedShoeId) return -1;
      if (right.id === focusedShoeId) return 1;
      return 0;
    });
  }, [focusedShoeId, query, upcomingOnly]);
  const recommendations = useMemo(() => recommendShoes(answers), [answers]);
  const compared = shoes.filter((shoe) => compareIds.includes(shoe.id));

  useEffect(() => {
    if (!focusedShoeId) return;
    setMode('browse');
    setQuery('');
  }, [focusedShoeId]);

  function toggleInterest(shoe: Shoe) {
    const next = preferences.interestedShoeIds.includes(shoe.id)
      ? preferences.interestedShoeIds.filter((id) => id !== shoe.id)
      : [...preferences.interestedShoeIds, shoe.id];
    void updatePreferences({ interestedShoeIds: next });
  }

  function setCurrentShoe(shoe: Shoe) {
    void updatePreferences({
      currentShoeId: preferences.currentShoeId === shoe.id ? undefined : shoe.id,
    });
  }

  function toggleCompare(shoe: Shoe) {
    setCompareIds((current) => {
      if (current.includes(shoe.id)) return current.filter((id) => id !== shoe.id);
      if (current.length >= 3) {
        Alert.alert('최대 3개까지 비교할 수 있어요', '먼저 비교함에서 하나를 빼 주세요.');
        return current;
      }
      return [...current, shoe.id];
    });
  }

  async function openOfficial(shoe: Shoe) {
    try {
      if (!shoe.officialUrl.startsWith('https://') || !(await Linking.canOpenURL(shoe.officialUrl))) {
        throw new Error('unsupported');
      }
      await Linking.openURL(shoe.officialUrl);
    } catch {
      Alert.alert('공식 페이지를 열 수 없어요', '네트워크 연결을 확인해 주세요.');
    }
  }

  if (mode === 'finder') {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>나에게 맞는 신발</Text>
            <Text style={styles.subtitle}>의료 진단이 아닌 사용 조건 비교예요.</Text>
          </View>
          <Button label="목록으로" onPress={() => setMode('browse')} tone="quiet" />
        </View>
        <FinderChoice
          title="어디서 달리나요"
          values={[
            ['road', '도로'],
            ['treadmill', '러닝머신'],
            ['mixed', '여러 환경'],
          ]}
          selected={answers.surface}
          onSelect={(surface) => setAnswers((current) => ({ ...current, surface }))}
        />
        <FinderChoice
          title="한 번에 얼마나 달리나요"
          values={[
            ['short', '5km 안팎'],
            ['daily', '일상 훈련'],
            ['long', '긴 거리'],
          ]}
          selected={answers.distance}
          onSelect={(distance) => setAnswers((current) => ({ ...current, distance }))}
        />
        <FinderChoice
          title="무엇이 가장 중요한가요"
          values={[
            ['comfort', '편안함'],
            ['balanced', '균형'],
            ['speed', '속도'],
          ]}
          selected={answers.priority}
          onSelect={(priority) => setAnswers((current) => ({ ...current, priority }))}
        />
        <FinderChoice
          title="예산은 어느 정도인가요"
          values={[
            ['under-150', '15만원 아래'],
            ['under-200', '20만원 아래'],
            ['open', '제한 없음'],
          ]}
          selected={answers.budget}
          onSelect={(budget) => setAnswers((current) => ({ ...current, budget }))}
        />
        {answers.budget !== 'open' ? (
          <Text style={styles.priceNotice}>
            공식 국내 가격이 확인된 제품에만 예산 조건을 적용해요. 가격이 미확인인 제품은
            조건 비교 후보로 남겨 두고 구매 전에 공식 페이지에서 확인해 주세요.
          </Text>
        ) : null}
        <Text style={styles.sectionTitle}>조건에 가까운 비교 후보</Text>
        <View style={styles.list}>
          {recommendations.map((shoe) => (
            <ShoeCard
              key={shoe.id}
              shoe={shoe}
              selected={compareIds.includes(shoe.id)}
              current={preferences.currentShoeId === shoe.id}
              interested={preferences.interestedShoeIds.includes(shoe.id)}
              focused={focusedShoeId === shoe.id}
              onCompare={() => toggleCompare(shoe)}
              onCurrent={() => setCurrentShoe(shoe)}
              onInterest={() => toggleInterest(shoe)}
              onOfficial={() => void openOfficial(shoe)}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!upcomingOnly ? (
        <View style={styles.searchRow}>
          <TextInput
            accessibilityLabel="러닝화 검색"
            onChangeText={setQuery}
            placeholder="브랜드 또는 모델"
            placeholderTextColor={palette.muted}
            style={styles.search}
            value={query}
          />
          <Button label="맞춤 찾기" onPress={() => setMode('finder')} />
        </View>
      ) : (
        <Card style={styles.upcomingIntro}>
          <Text style={styles.title}>공식 발표만 모았어요</Text>
          <Text style={styles.subtitle}>
            국내 일정이 확인되지 않은 제품은 그대로 표시하고, 루머는 싣지 않아요.
          </Text>
        </Card>
      )}

      {compared.length > 0 ? (
        <Card style={styles.compareBox}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>비교함 {compared.length}/3</Text>
            <Button label="비우기" onPress={() => setCompareIds([])} tone="quiet" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.compareRow}>
              {compared.map((shoe) => (
                <Pressable key={shoe.id} onPress={() => toggleCompare(shoe)} style={styles.compareItem}>
                  <Text style={styles.compareBrand}>{shoe.brand}</Text>
                  <Text style={styles.compareModel}>{shoe.model}</Text>
                  <Text style={styles.compareMeta}>{shoe.officialFacts[0]}</Text>
                  <Text style={styles.remove}>비교에서 빼기</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </Card>
      ) : null}

      <View style={styles.list}>
        {visible.map((shoe) => (
          <ShoeCard
            key={shoe.id}
            shoe={shoe}
            selected={compareIds.includes(shoe.id)}
            current={preferences.currentShoeId === shoe.id}
            interested={preferences.interestedShoeIds.includes(shoe.id)}
            focused={focusedShoeId === shoe.id}
            onCompare={() => toggleCompare(shoe)}
            onCurrent={() => setCurrentShoe(shoe)}
            onInterest={() => toggleInterest(shoe)}
            onOfficial={() => void openOfficial(shoe)}
          />
        ))}
      </View>
    </View>
  );
}

type FinderChoiceProps<T extends string> = {
  title: string;
  values: readonly (readonly [T, string])[];
  selected: T;
  onSelect: (value: T) => void;
};

function FinderChoice<T extends string>({
  title,
  values,
  selected,
  onSelect,
}: FinderChoiceProps<T>) {
  return (
    <Card style={styles.finder}>
      <Text style={styles.finderTitle}>{title}</Text>
      <View style={styles.choiceWrap}>
        {values.map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            selected={selected === value}
            onPress={() => onSelect(value)}
          />
        ))}
      </View>
    </Card>
  );
}

function ShoeCard({
  shoe,
  selected,
  current,
  interested,
  focused,
  onCompare,
  onCurrent,
  onInterest,
  onOfficial,
}: {
  shoe: Shoe;
  selected: boolean;
  current: boolean;
  interested: boolean;
  focused: boolean;
  onCompare: () => void;
  onCurrent: () => void;
  onInterest: () => void;
  onOfficial: () => void;
}) {
  return (
    <Card style={[styles.shoeCard, focused && styles.shoeCardFocused]}>
      <View style={styles.shoeTop}>
        <View accessibilityLabel={`${shoe.brand} 러닝화 실루엣`} style={styles.silhouette}>
          <Text style={styles.silhouetteText}>RUN</Text>
        </View>
        <View style={styles.shoeCopy}>
          <Text style={styles.brand}>{shoe.brand}</Text>
          <Text style={styles.model}>{shoe.model}</Text>
          <Text style={styles.verified}>공식 확인 {shoe.verifiedAt}</Text>
        </View>
        <Chip
          label={shoe.status === 'available' ? '국내 확인' : '국내 미확인'}
          tone={shoe.status === 'available' ? 'positive' : 'warning'}
        />
      </View>
      <View style={styles.choiceWrap}>
        {shoe.surfaces.map((surface) => (
          <Chip key={surface} label={surfaceLabels[surface]} />
        ))}
        {shoe.priorities.map((priority) => (
          <Chip key={priority} label={priorityLabels[priority]} tone="accent" />
        ))}
      </View>
      <Text style={styles.editorial}>{shoe.editorialSummary}</Text>
      <Text style={styles.consideration}>고려할 점 · {shoe.consideration}</Text>
      <Text style={styles.fact}>공식 사실 · {shoe.officialFacts.join(' · ')}</Text>
      <Text style={styles.status}>{shoe.koreaStatus}</Text>
      <View style={styles.preferenceActions}>
        <Chip
          label={current ? '현재 러닝화' : '내 러닝화로 설정'}
          selected={current}
          onPress={onCurrent}
          tone="accent"
        />
        <Chip
          label={interested ? '관심 저장됨' : '관심 저장'}
          selected={interested}
          onPress={onInterest}
          tone="positive"
        />
      </View>
      <View style={styles.actions}>
        <Button
          label={selected ? '비교에서 빼기' : '비교하기'}
          onPress={onCompare}
          tone={selected ? 'quiet' : 'secondary'}
          style={styles.action}
        />
        <Button label="공식 페이지" onPress={onOfficial} style={styles.action} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xxl, gap: spacing.md },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: { color: palette.ink, fontSize: typeScale.title, fontWeight: '900' },
  subtitle: { color: palette.muted, fontSize: typeScale.bodySmall, lineHeight: 20, marginTop: 4 },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  search: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderRadius: radius.md,
    borderColor: palette.line,
    borderWidth: 1,
    backgroundColor: palette.surface,
    color: palette.ink,
    paddingHorizontal: spacing.md,
    fontSize: typeScale.body,
  },
  upcomingIntro: { backgroundColor: palette.surfaceWarm },
  compareBox: { gap: spacing.md, backgroundColor: palette.surfaceWarm },
  sectionTitle: { color: palette.ink, fontSize: typeScale.titleSmall, fontWeight: '900' },
  compareRow: { flexDirection: 'row', gap: spacing.sm },
  compareItem: {
    width: 190,
    minHeight: 144,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    padding: spacing.md,
  },
  compareBrand: { color: palette.muted, fontSize: typeScale.caption, fontWeight: '800' },
  compareModel: { color: palette.ink, fontSize: typeScale.body, fontWeight: '900', marginTop: 4 },
  compareMeta: { color: palette.inkSoft, fontSize: typeScale.caption, lineHeight: 17, marginTop: 8 },
  remove: { color: palette.accentDark, fontSize: typeScale.caption, fontWeight: '800', marginTop: 12 },
  list: { gap: spacing.md },
  finder: { gap: spacing.md },
  finderTitle: { color: palette.ink, fontSize: typeScale.body, fontWeight: '900' },
  priceNotice: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: 18,
  },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  shoeCard: { gap: spacing.md },
  shoeCardFocused: { borderColor: palette.accent, borderWidth: 2 },
  shoeTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  silhouette: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  silhouetteText: { color: palette.white, fontSize: typeScale.caption, fontWeight: '900', letterSpacing: 1 },
  shoeCopy: { flex: 1, minWidth: 0 },
  brand: { color: palette.muted, fontSize: typeScale.caption, fontWeight: '800' },
  model: { color: palette.ink, fontSize: typeScale.titleSmall, fontWeight: '900', marginTop: 2 },
  verified: { color: palette.muted, fontSize: typeScale.caption, marginTop: 4 },
  editorial: { color: palette.ink, fontSize: typeScale.body, lineHeight: 24, fontWeight: '700' },
  consideration: { color: palette.inkSoft, fontSize: typeScale.bodySmall, lineHeight: 20 },
  fact: { color: palette.inkSoft, fontSize: typeScale.caption, lineHeight: 18 },
  status: { color: palette.warning, fontSize: typeScale.caption, fontWeight: '700' },
  preferenceActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
});
