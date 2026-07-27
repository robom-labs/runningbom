// 로그인 체험 화면입니다. 라우팅은 부모가 하고, 이 화면은 onDone·onSkip만 받습니다.
//
// 지켜야 할 선:
// - 실제 로그인 자격증명이 없어서 진짜 로그인은 할 수 없습니다. 그래서 "체험 모드"로만 보여 줍니다.
// - 체험 흐름은 Preview 빌드에서만 열립니다. 판정은 previewGate.trialLoginEnabled()가 하고,
//   실제 진입은 beginTrialLogin()을 반드시 거칩니다(정식 빌드에서는 언제나 막힙니다).
// - 화면 어디에나 "체험 모드 · 실제 계정과 연결되지 않아요"가 보입니다.
// - 각 회사 로고나 공식 색을 흉내 내지 않고, 이름만 글자로 쓰고 러닝봄 색을 씁니다.
// - 네트워크로 나가는 호출이 하나도 없습니다.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
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
import { providerMatrix } from '../../../domains/identity/auth';
import { trialLoginEnabled } from '../../../domains/identity/previewGate';
import { saveTrialProfile } from '../../../domains/identity/trialProfileStore';
import {
  beginTrialLogin,
  buildTrialProfile,
  noLoginHint,
  noLoginLabel,
  trialConsentApproveLabel,
  trialConsentBody,
  trialConsentCancelLabel,
  trialConsentItems,
  trialConsentTitle,
  trialLoadingMessage,
  trialModeDetail,
  trialModeNotice,
  trialProfileSummary,
  trialProviderButtonLabel,
  trialProviderNames,
  trialProviders,
  type TrialProfile,
  type TrialProvider,
} from '../../../domains/identity/trialLogin';
import { ProfileSetupForm, type ProfileSetupValue } from './ProfileSetupForm';

export type AuthScreenProps = {
  /** 체험 프로필을 다 만들었을 때 부모가 다음 화면으로 보냅니다. */
  onDone: (profile: TrialProfile) => void;
  /** "로그인 없이 시작"입니다. 사실상 주 경로예요. */
  onSkip: () => void;
};

type Step = 'providers' | 'loading' | 'consent' | 'profile' | 'welcome';

/** 가짜 로그인 화면이 뜨기까지 기다리는 시간입니다(1초 안팎). */
const LOADING_MS = 900;

export function AuthScreen({ onDone, onSkip }: AuthScreenProps) {
  const trialEnabled = trialLoginEnabled();
  const [step, setStep] = useState<Step>('providers');
  const [provider, setProvider] = useState<TrialProvider | undefined>(undefined);
  const [profile, setProfile] = useState<TrialProfile | undefined>(undefined);
  const [message, setMessage] = useState('');

  const blockedProviders = useMemo(
    () => providerMatrix().filter((item) => !item.enabled),
    [],
  );

  useEffect(() => {
    if (step !== 'loading') return undefined;
    const timer = setTimeout(() => setStep('consent'), LOADING_MS);
    return () => clearTimeout(timer);
  }, [step]);

  const chooseProvider = useCallback(
    (next: TrialProvider) => {
      const started = beginTrialLogin(next, trialEnabled);
      if (!started.ok) {
        setMessage(started.message);
        return;
      }
      setMessage('');
      setProvider(started.provider);
      setStep('loading');
    },
    [trialEnabled],
  );

  const cancel = useCallback(() => {
    setProvider(undefined);
    setMessage('');
    setStep('providers');
  }, []);

  const submitProfile = useCallback(
    (value: ProfileSetupValue) => {
      const built = buildTrialProfile({
        nickname: value.nickname,
        entry: 'trial-login',
        ...(provider ? { provider } : {}),
        ...(value.experience ? { experience: value.experience } : {}),
        ...(value.weeklySessions ? { weeklySessions: value.weeklySessions } : {}),
      });
      if (!built.ok) {
        setMessage(built.message);
        return;
      }
      setMessage('');
      setProfile(built.value);
      void saveTrialProfile(built.value);
      setStep('welcome');
    },
    [provider],
  );

  return (
    <ScrollView contentContainerStyle={screenStyles.content} style={screenStyles.root}>
      <SectionHeader
        subtitle="로그인 없이도 다 쓸 수 있어요. 원하면 아래 방법으로 시작해도 돼요."
        title="러닝봄 시작하기"
      />

      {trialEnabled ? (
        <Banner body={trialModeDetail} title={trialModeNotice} tone="warning" />
      ) : (
        <Banner
          body="계정 연결 준비가 끝나면 다시 열어 드릴게요. 그동안에도 모든 기능을 쓸 수 있어요."
          title="지금은 다른 서비스 계정으로 시작할 수 없어요"
          tone="info"
        />
      )}

      {trialEnabled && step === 'providers' ? (
        <Card style={styles.block}>
          <Text accessibilityRole="header" style={styles.blockTitle}>
            어떤 방법으로 시작할까요
          </Text>
          {trialProviders.map((item) => (
            <Button
              accessibilityHint={`${trialProviderNames[item]} 체험 화면을 열어요. 실제 계정과 연결되지 않아요.`}
              key={item}
              label={trialProviderButtonLabel(item)}
              onPress={() => chooseProvider(item)}
              size="lg"
              tone="secondary"
            />
          ))}
          <Text style={styles.note}>{trialModeNotice}</Text>
        </Card>
      ) : null}

      {!trialEnabled ? (
        <Card style={styles.block}>
          <Text accessibilityRole="header" style={styles.blockTitle}>
            왜 지금 꺼져 있나요
          </Text>
          {blockedProviders.map((item) => (
            <View key={item.provider} style={styles.reasonRow}>
              <Text style={styles.reasonName}>{trialProviderNames[item.provider]}</Text>
              <Text style={styles.reasonBody}>{item.blocker}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {step === 'loading' && provider ? (
        <Card accessibilityLabel={trialLoadingMessage(provider)} style={styles.loadingCard}>
          <ActivityIndicator color={palette.accentStrong} size="large" />
          <Text style={styles.loadingText}>{trialLoadingMessage(provider)}</Text>
          <Text style={styles.note}>{trialModeNotice}</Text>
        </Card>
      ) : null}

      {step === 'consent' && provider ? (
        <Card style={styles.block} tone="warm">
          <Text accessibilityRole="header" style={styles.blockTitle}>
            {trialConsentTitle}
          </Text>
          <Text style={styles.noticeStrong}>{trialModeNotice}</Text>
          <Text style={styles.body}>{trialConsentBody(provider)}</Text>
          <Text style={styles.listTitle}>실제 서비스라면 이런 걸 물어봐요</Text>
          {trialConsentItems.map((item) => (
            <Text key={item} style={styles.listItem}>
              · {item}
            </Text>
          ))}
          <Button
            label={trialConsentApproveLabel}
            onPress={() => setStep('profile')}
            size="lg"
          />
          <Button label={trialConsentCancelLabel} onPress={cancel} tone="quiet" />
        </Card>
      ) : null}

      {step === 'profile' ? (
        <>
          <ProfileSetupForm onBack={cancel} onSubmit={submitProfile} {...(message ? { message } : {})} />
          <Text style={styles.note}>{trialModeNotice}</Text>
        </>
      ) : null}

      {step === 'welcome' && profile ? (
        <Card style={styles.block} tone="warm">
          <Text accessibilityRole="header" style={styles.blockTitle}>
            {`환영해요, ${profile.nickname}님`}
          </Text>
          <Text style={styles.body}>{trialProfileSummary(profile)}</Text>
          <Text style={styles.noticeStrong}>{trialModeNotice}</Text>
          <Button label="러닝봄 시작하기" onPress={() => onDone(profile)} size="lg" />
        </Card>
      ) : null}

      {step === 'providers' ? (
        <Card style={styles.block} tone="navy">
          <Text accessibilityRole="header" style={styles.navyTitle}>
            가장 빠른 길
          </Text>
          <Text style={styles.navyBody}>{noLoginHint}</Text>
          <Button
            accessibilityHint="계정을 만들지 않고 바로 러닝봄을 씁니다."
            label={noLoginLabel}
            onPress={onSkip}
            size="lg"
            testID="auth-start-without-login"
          />
        </Card>
      ) : null}

      {message && step === 'providers' ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {message}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.sm,
  },
  blockTitle: {
    color: palette.ink,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
  },
  body: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  noticeStrong: {
    color: palette.accentDark,
    fontSize: typeScale.label,
    lineHeight: lineHeight.label,
    fontWeight: fontWeight.heavy,
  },
  note: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.medium,
  },
  listTitle: {
    color: palette.inkSoft,
    fontSize: typeScale.label,
    lineHeight: lineHeight.label,
    fontWeight: fontWeight.bold,
  },
  listItem: {
    color: palette.inkSoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  loadingCard: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: palette.ink,
    fontSize: typeScale.body,
    lineHeight: lineHeight.body,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  reasonRow: {
    gap: spacing.xxs,
  },
  reasonName: {
    color: palette.ink,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.bold,
  },
  reasonBody: {
    color: palette.muted,
    fontSize: typeScale.caption,
    lineHeight: lineHeight.caption,
  },
  navyTitle: {
    color: palette.onNavy,
    fontSize: typeScale.titleSmall,
    lineHeight: lineHeight.titleSmall,
    fontWeight: fontWeight.heavy,
  },
  navyBody: {
    color: palette.onNavySoft,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  error: {
    color: palette.danger,
    fontSize: typeScale.bodySmall,
    lineHeight: lineHeight.bodySmall,
    fontWeight: fontWeight.medium,
  },
});
