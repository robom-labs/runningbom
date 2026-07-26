// 도움말과 문의 화면입니다. 지금 되는 것과 아직 안 되는 것을 그대로 적습니다.
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, SectionHeader } from '../../design-system/components';
import { palette, spacing, typeScale } from '../../design-system/theme';

const PRIVACY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://robom.kr/privacy/runningbom';
const SUPPORT_URL = process.env.EXPO_PUBLIC_SUPPORT_URL ?? 'https://robom.kr/support';

const faqs = [
  {
    question: '로그인 없이 써도 되나요?',
    answer:
      '네. 러닝 코칭, 캘린더, 대회, 러닝화는 로그인 없이 모두 쓸 수 있어요. 기록은 이 기기에 저장됩니다.',
  },
  {
    question: '소셜 로그인 버튼이 왜 안 보이나요?',
    answer:
      '운영 인증 정보(OAuth 자격증명)가 아직 연결되지 않아 이 빌드에서 꺼져 있어요. 설정 화면에서 지금 상태를 확인할 수 있어요.',
  },
  {
    question: '삼성 헬스·Garmin·Nike 기록을 가져올 수 있나요?',
    answer:
      '아직이에요. 각 서비스의 공식 승인과 자격증명이 필요해 지금은 연동 준비 중으로 표시하고 있어요. 그동안은 캘린더에서 직접 입력할 수 있어요.',
  },
  {
    question: '같은 대회의 5K·10K가 왜 하나로 보이나요?',
    answer:
      '같은 날 같은 지역의 같은 대회는 한 건으로 세고, 종목은 카드 안 칩으로 보여줘요. 개수도 대회 기준입니다.',
  },
  {
    question: '기기를 바꾸면 기록이 옮겨지나요?',
    answer:
      '자동으로 옮겨지지 않아요. 설정에서 기기 데이터를 내보낸 뒤 보관해 주세요.',
  },
];

export function HelpScreen() {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
      <SectionHeader title="자주 묻는 질문" subtitle="지금 되는 것과 아직 안 되는 것을 적어 뒀어요." />
      {faqs.map((faq) => (
        <Card key={faq.question} style={styles.card}>
          <Text style={styles.question}>{faq.question}</Text>
          <Text style={styles.answer}>{faq.answer}</Text>
        </Card>
      ))}

      <SectionHeader title="문의" />
      <Card style={styles.card}>
        <Text style={styles.answer}>
          오류나 잘못된 대회 정보를 발견하면 알려 주세요. 확인 뒤 데이터를 고칩니다.
        </Text>
        <View style={styles.actions}>
          <Button label="문의하기" onPress={() => void Linking.openURL(SUPPORT_URL)} tone="secondary" />
          <Button
            label="개인정보처리방침"
            onPress={() => void Linking.openURL(PRIVACY_URL)}
            tone="quiet"
          />
        </View>
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
  card: { gap: spacing.xs },
  question: { color: palette.ink, fontSize: typeScale.bodySmall, fontWeight: '900' },
  answer: { color: palette.inkSoft, fontSize: typeScale.bodySmall, lineHeight: 21 },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
});
