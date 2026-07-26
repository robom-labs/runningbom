// 도움말과 문의 화면입니다. 지금 되는 것과 아직 안 되는 것을 그대로 적습니다.
import { useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  Disclosure,
  EmptyState,
  SearchField,
  SectionHeader,
  screenStyles,
} from '../../design-system/components';
import {
  fontWeight,
  lineHeight,
  palette,
  spacing,
  typeScale,
} from '../../design-system/theme';

const PRIVACY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://robom.kr/privacy/runningbom';
const SUPPORT_URL = process.env.EXPO_PUBLIC_SUPPORT_URL ?? 'https://robom.kr/support';

type FaqCategory = '시작하기' | '기록·데이터' | '대회·러닝화' | '계정·연동';

const faqCategories: Array<FaqCategory | '전체'> = [
  '전체',
  '시작하기',
  '기록·데이터',
  '대회·러닝화',
  '계정·연동',
];

type Faq = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
};

const faqs: Faq[] = [
  {
    id: 'no-login',
    category: '시작하기',
    question: '로그인 없이 써도 되나요?',
    answer:
      '네. 러닝 코칭, 캘린더, 대회, 러닝화는 로그인 없이 모두 쓸 수 있어요. 기록은 이 기기에 저장됩니다.',
  },
  {
    id: 'first-run',
    category: '시작하기',
    question: '처음인데 무엇부터 하면 되나요?',
    answer:
      '홈 맨 위의 "러닝 시작"을 누르면 시간과 유형을 고른 뒤 음성 코치와 바로 달릴 수 있어요. 오늘은 걷기·가벼운 조깅으로 시작해도 기록으로 남습니다.',
  },
  {
    id: 'change-voice',
    category: '시작하기',
    question: '코치 목소리와 말하기 속도를 바꾸고 싶어요.',
    answer:
      '설정 > 코치·음성에서 남성·여성 음성, 말하기 속도, 안내 정도를 언제든 바꿀 수 있어요. 기기에 한국어 음성이 없으면 기본 음성으로 안내하고 그 사실을 알려 드려요.',
  },
  {
    id: 'change-goal',
    category: '시작하기',
    question: '주간 목표를 다시 정하고 싶어요.',
    answer:
      '기록·통계 화면의 "이번 주 목표"에서 횟수·시간·거리 중 하나를 고르거나 자동 추천을 받을 수 있어요. 추천은 최근 4주 평균을 크게 넘지 않게 계산합니다.',
  },
  {
    id: 'social-login',
    category: '계정·연동',
    question: '소셜 로그인 버튼이 왜 안 보이나요?',
    answer:
      '운영 인증 정보(OAuth 자격증명)가 아직 연결되지 않아 이 빌드에서 꺼져 있어요. 설정 화면에서 지금 상태를 확인할 수 있어요.',
  },
  {
    id: 'integrations',
    category: '계정·연동',
    question: '삼성 헬스·Garmin·Nike 기록을 가져올 수 있나요?',
    answer:
      '아직이에요. 각 서비스의 공식 승인과 자격증명이 필요해 지금은 연동 준비 중으로 표시하고 있어요. 그동안은 캘린더에서 직접 입력할 수 있어요.',
  },
  {
    id: 'race-count',
    category: '대회·러닝화',
    question: '같은 대회의 5K·10K가 왜 하나로 보이나요?',
    answer:
      '같은 날 같은 지역의 같은 대회는 한 건으로 세고, 종목은 카드 안 칩으로 보여줘요. 개수도 대회 기준입니다.',
  },
  {
    id: 'race-alert',
    category: '대회·러닝화',
    question: '대회 접수 알림은 어떻게 받나요?',
    answer:
      '대회 화면에서 원하는 대회를 열고 접수 알림을 켜면, 공식 접수 시각이 확인된 대회에 한해 알림을 예약해요. 알림을 꺼도 대회 탐색과 공식 링크는 그대로 쓸 수 있어요.',
  },
  {
    id: 'device-change',
    category: '기록·데이터',
    question: '기기를 바꾸면 기록이 옮겨지나요?',
    answer:
      '자동으로 옮겨지지 않아요. 설정 > 계정·데이터에서 기기 데이터를 내보낸 뒤 보관해 주세요.',
  },
  {
    id: 'privacy',
    category: '기록·데이터',
    question: '내 기록이 밖으로 나가나요?',
    answer:
      '기본은 이 기기 저장이에요. 직접 입력한 기록을 계정에 저장하는 것도 사용자가 눌러야 실행되고, 코칭을 마쳐도 자동으로 게시하지 않습니다.',
  },
];

export function HelpScreen() {
  const [category, setCategory] = useState<FaqCategory | '전체'>('전체');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string>();

  const results = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return faqs.filter((faq) => {
      const matchesCategory = category === '전체' || faq.category === category;
      if (!matchesCategory) return false;
      if (!keyword) return true;
      return `${faq.question} ${faq.answer}`.toLowerCase().includes(keyword);
    });
  }, [category, query]);

  return (
    <ScrollView
      contentContainerStyle={screenStyles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={screenStyles.root}
    >
      <SectionHeader
        title={`자주 묻는 질문 ${faqs.length}개`}
        subtitle="지금 되는 것과 아직 안 되는 것을 그대로 적어 뒀어요."
        compact
      />
      <SearchField
        accessibilityLabel="도움말 검색"
        onChangeText={(value) => {
          setQuery(value);
          setOpenId(undefined);
        }}
        placeholder="예: 로그인, 알림, 기록 옮기기"
        value={query}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {faqCategories.map((value) => (
          <Chip
            accessibilityRole="tab"
            key={value}
            label={value}
            onPress={() => {
              setCategory(value);
              setOpenId(undefined);
            }}
            selected={category === value}
            tone="accent"
          />
        ))}
      </ScrollView>

      {results.length > 0 ? (
        <View style={styles.list}>
          {results.map((faq) => (
            <Disclosure
              expanded={openId === faq.id}
              key={faq.id}
              meta={faq.category}
              onToggle={() => setOpenId((current) => (current === faq.id ? undefined : faq.id))}
              title={faq.question}
            >
              <Text style={styles.answer}>{faq.answer}</Text>
            </Disclosure>
          ))}
        </View>
      ) : (
        <EmptyState
          title="찾는 답이 없네요"
          body="검색어를 지우거나 다른 주제를 골라 보세요. 그래도 안 나오면 문의로 알려 주시면 답을 여기에 추가할게요."
          actionLabel="문의하기"
          onAction={() => void Linking.openURL(SUPPORT_URL)}
          secondaryActionLabel="검색어 지우기"
          onSecondaryAction={() => setQuery('')}
        />
      )}

      <SectionHeader title="문의" subtitle="오류·잘못된 대회 정보를 알려 주시면 확인 뒤 고쳐요." />
      <Card style={styles.card}>
        <Text style={styles.rowTitle}>문의할 때 이렇게 알려 주세요</Text>
        <Text style={styles.answer}>
          1) 어떤 화면에서 2) 무엇을 눌렀을 때 3) 무엇이 기대와 달랐는지 적어 주세요. 설정 &gt; 앱
          정보의 앱 버전과 source SHA를 함께 알려 주시면 더 빠르게 확인할 수 있어요.
        </Text>
        <View style={styles.actions}>
          <Button label="문의하기" onPress={() => void Linking.openURL(SUPPORT_URL)} />
          <Button
            label="개인정보처리방침"
            onPress={() => void Linking.openURL(PRIVACY_URL)}
            tone="secondary"
          />
        </View>
        <Text style={styles.note}>
          도움말과 Q&A는 일반적인 참고 정보예요. 통증이 이어지면 전문가의 진료를 권해요.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.xxs },
  list: { gap: spacing.xs },
  card: { gap: spacing.xs },
  rowTitle: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.heavy,
  },
  answer: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  actions: { gap: spacing.xs, marginTop: spacing.xs },
  note: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
});
