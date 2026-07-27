// 로그인 체험(미리 보기) 흐름의 규칙을 회귀 검증합니다.
// 가장 중요한 것: 정식 빌드 판정일 때 체험 흐름에 절대 들어갈 수 없다는 점입니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  TRIAL_PROFILE_KEY,
  beginTrialLogin,
  buildTrialProfile,
  checkTrialNickname,
  isTrialProfile,
  noLoginLabel,
  trialBlockedMessage,
  trialConsentBody,
  trialConsentTitle,
  trialLoadingMessage,
  trialLoginAllowed,
  trialModeNotice,
  trialProfileSummary,
  trialProviderButtonLabel,
  trialProviderNames,
  trialProviders,
  trialWeeklySessionOptions,
} from '../domains/identity/trialLogin';

const root = join(import.meta.dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

const NOW = Date.parse('2026-07-26T03:00:00Z');

describe('Preview 전용 문지기', () => {
  it('Preview 표시가 정확히 true일 때만 연다', () => {
    assert.equal(trialLoginAllowed(true), true);
    for (const value of [false, undefined, null, 'true', 1, {}, 'preview']) {
      assert.equal(trialLoginAllowed(value), false, `${String(value)}가 통과했습니다`);
    }
  });

  it('정식 빌드 판정이면 어떤 방법으로도 체험 흐름에 들어갈 수 없다', () => {
    for (const provider of trialProviders) {
      const blocked = beginTrialLogin(provider, false);
      assert.equal(blocked.ok, false);
      if (!blocked.ok) assert.equal(blocked.message, trialBlockedMessage);
    }
  });

  it('Preview 빌드에서는 네 가지 방법 모두 열린다', () => {
    assert.deepEqual(trialProviders, ['kakao', 'naver', 'google', 'apple']);
    for (const provider of trialProviders) {
      const started = beginTrialLogin(provider, true);
      assert.equal(started.ok, true);
      if (started.ok) assert.equal(started.provider, provider);
    }
  });

  it('알 수 없는 공급자는 Preview에서도 막는다', () => {
    // @ts-expect-error 목록에 없는 값을 넣어도 통과하면 안 됩니다.
    assert.equal(beginTrialLogin('line', true).ok, false);
  });

  it('판정 방법이 GPS 추적과 똑같고 새 설정 키를 만들지 않는다', () => {
    const gate = source('domains/identity/previewGate.ts');
    const tracking = source('domains/tracking/availability.ts');
    const expression = 'Constants.expoConfig?.extra?.preview?.enabled';
    assert.ok(tracking.includes(expression), '기준이 되는 판정식이 바뀌었습니다');
    assert.ok(gate.includes(expression), '체험 로그인이 다른 방법으로 판정합니다');
    // extra 아래 다른 키를 새로 읽지 않습니다.
    const extraReads = gate.match(/extra\?\.[A-Za-z]+/g) ?? [];
    assert.deepEqual(Array.from(new Set(extraReads)), ['extra?.preview']);
  });

  it('화면은 반드시 문지기와 진입점을 거친다', () => {
    const screen = source('app/screens/auth/AuthScreen.tsx');
    assert.match(screen, /trialLoginEnabled\(\)/);
    assert.match(screen, /beginTrialLogin\(next, trialEnabled\)/);
    // 화면이 직접 설정을 읽어 우회하지 못하게 합니다.
    assert.equal(/expo-constants|expoConfig/.test(screen), false);
    // 네 가지 버튼은 Preview 판정이 참일 때만 그립니다.
    assert.match(screen, /trialEnabled && step === 'providers'/);
    // 정식 빌드에서는 기존 안내(왜 꺼져 있는지)와 "로그인 없이 시작"만 남습니다.
    assert.match(screen, /!trialEnabled \? \(/);
    assert.match(screen, /providerMatrix\(\)/);
  });
});

describe('기존 로그인 안내는 그대로 둔다', () => {
  it('providerMatrix와 공급자별 꺼진 이유가 살아 있다', () => {
    const auth = source('domains/identity/auth.ts');
    assert.match(auth, /export function providerMatrix/);
    for (const blocker of [
      'Supabase Google OAuth 설정 필요',
      'Kakao 앱과 Supabase provider 설정 필요',
      'Naver Custom OAuth2 UserInfo Adapter 검증 전 비활성',
      'Apple Developer 자격과 서비스 설정 확인 전 비활성',
    ]) {
      assert.ok(auth.includes(blocker), `${blocker} 설명이 사라졌습니다`);
    }
  });

  it('체험 흐름은 진짜 로그인 함수를 부르지 않는다', () => {
    const trial = source('domains/identity/trialLogin.ts');
    assert.equal(/signIn|linkIdentity|supabase|WebBrowser|fetch\(/.test(trial), false);
    const screen = source('app/screens/auth/AuthScreen.tsx');
    assert.equal(/signIn\(|linkIdentity\(|fetch\(/.test(screen), false);
  });
});

describe('사용자를 속이지 않는다', () => {
  it('체험 모드 표시 문구가 정해져 있다', () => {
    assert.equal(trialModeNotice, '체험 모드 · 실제 계정과 연결되지 않아요');
  });

  it('모든 체험 화면에 그 문구가 보인다', () => {
    const screen = source('app/screens/auth/AuthScreen.tsx');
    // 공급자 고르기·기다리는 중·가짜 동의·정보 입력·환영 다섯 곳입니다.
    assert.ok((screen.match(/trialModeNotice/g) ?? []).length >= 5);
    assert.match(screen, /trialModeDetail/);
  });

  it('가짜 동의 화면이 가짜라고 먼저 밝힌다', () => {
    assert.equal(trialConsentTitle, '체험용 로그인 화면');
    assert.equal(
      trialConsentBody('kakao'),
      '실제 카카오 로그인 화면이 아니에요. 진짜 계정 정보는 묻지 않고, 아무 정보도 밖으로 보내지 않아요.',
    );
    assert.equal(trialLoadingMessage('naver'), '네이버 체험 화면을 여는 중이에요');
  });

  it('가짜 이메일·가짜 이름을 만들지 않는다', () => {
    for (const file of [
      'domains/identity/trialLogin.ts',
      'app/screens/auth/AuthScreen.tsx',
      'app/screens/auth/ProfileSetupForm.tsx',
    ]) {
      const text = source(file);
      assert.equal(/@(gmail|naver|kakao|icloud|example)\./.test(text), false, `${file}에 가짜 메일 주소가 있습니다`);
    }
    // 닉네임은 반드시 사용자가 적어야 합니다.
    assert.equal(buildTrialProfile({ nickname: '', entry: 'trial-login', provider: 'kakao' }).ok, false);
  });

  it('상표를 흉내 내지 않고 이름만 글자로 쓴다', () => {
    assert.deepEqual(trialProviderNames, {
      kakao: '카카오',
      naver: '네이버',
      google: '구글',
      apple: '애플',
    });
    assert.equal(trialProviderButtonLabel('google'), '구글로 시작하기');
    for (const file of ['app/screens/auth/AuthScreen.tsx', 'app/screens/auth/ProfileSetupForm.tsx']) {
      const text = source(file);
      assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(text), false, `${file}에 브랜드 색으로 보이는 값이 있습니다`);
      assert.equal(/rgba?\(/.test(text), false, `${file}에 하드코딩된 색이 있습니다`);
      assert.equal(/FEE500|03C75A|#4285F4/i.test(text), false, `${file}에 브랜드 색이 있습니다`);
    }
  });

  it('"로그인 없이 시작"이 주 경로로 남는다', () => {
    assert.equal(noLoginLabel, '로그인 없이 시작');
    const screen = source('app/screens/auth/AuthScreen.tsx');
    assert.match(screen, /testID="auth-start-without-login"/);
    assert.match(screen, /onPress=\{onSkip\}/);
  });
});

describe('정보 입력은 세 가지만', () => {
  it('닉네임 규칙을 쉬운 말로 알려 준다', () => {
    assert.deepEqual(checkTrialNickname('  봄 이  '), { ok: true, value: '봄 이' });
    assert.deepEqual(checkTrialNickname(''), { ok: false, message: '앱에서 쓸 이름을 적어 주세요.' });
    assert.deepEqual(checkTrialNickname('가'), {
      ok: false,
      message: '이름은 2자부터 16자까지 적을 수 있어요.',
    });
    assert.deepEqual(checkTrialNickname('운영자'), {
      ok: false,
      message: '운영자로 오해할 수 있는 이름은 쓸 수 없어요.',
    });
  });

  it('주간 목표 선택지는 세 개뿐이다', () => {
    assert.deepEqual([...trialWeeklySessionOptions], [2, 3, 4]);
  });

  it('입력 칸이 셋을 넘지 않는다', () => {
    const form = source('app/screens/auth/ProfileSetupForm.tsx');
    const labels = form.match(/styles\.label\}>/g) ?? [];
    assert.equal(labels.length, 3, '물어보는 항목이 3개가 아닙니다');
  });
});

describe('프로필 생성 기록', () => {
  it('어떤 방법으로 들어왔는지와 체험 모드 표시를 남긴다', () => {
    const built = buildTrialProfile({
      nickname: '봄이',
      entry: 'trial-login',
      provider: 'kakao',
      experience: '1~3년',
      weeklySessions: 3,
      now: NOW,
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.value.nickname, '봄이');
    assert.equal(built.value.provider, 'kakao');
    assert.equal(built.value.entry, 'trial-login');
    assert.equal(built.value.trialMode, true);
    assert.equal(built.value.experience, '1~3년');
    assert.equal(built.value.weeklySessions, 3);
    assert.equal(built.value.createdAt, new Date(NOW).toISOString());
    assert.equal(
      trialProfileSummary(built.value),
      '카카오 체험 로그인으로 만들었어요. 실제 계정과 연결되지 않아요.',
    );
    assert.ok(isTrialProfile(built.value));
  });

  it('로그인 없이 시작한 프로필은 체험 표시를 달지 않는다', () => {
    const built = buildTrialProfile({ nickname: '봄이', entry: 'no-login', now: NOW });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.value.trialMode, false);
    assert.equal(built.value.provider, undefined);
    assert.equal(trialProfileSummary(built.value), '로그인 없이 시작했어요.');
  });

  it('선택 항목은 이상한 값이 들어오면 그냥 비워 둔다', () => {
    const built = buildTrialProfile({
      nickname: '봄이',
      entry: 'trial-login',
      provider: 'apple',
      weeklySessions: 9,
      now: NOW,
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.value.weeklySessions, undefined);
    assert.equal(built.value.experience, undefined);
  });

  it('새 저장 키만 쓴다', () => {
    assert.equal(TRIAL_PROFILE_KEY, 'runningbom:vnext:trial-profile:v1');
    for (const existing of [
      'runningbom:vnext:preferences:v1',
      'runningbom:vnext:onboarding:v1',
      'runningbom:vnext:goal-race:v1',
    ]) {
      assert.notEqual(TRIAL_PROFILE_KEY, existing);
    }
  });
});

describe('어려운 말을 쓰지 않는다', () => {
  it('화면 문구에 기술 용어가 없다', () => {
    for (const file of [
      'app/screens/auth/AuthScreen.tsx',
      'app/screens/auth/ProfileSetupForm.tsx',
    ]) {
      const text = source(file);
      // providerMatrix가 갖고 있는 기존 설명은 그대로 보여 주되, 화면이 새로 쓰는 문구에는 없어야 합니다.
      const written = text
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('//'))
        .join('\n');
      for (const word of ['스트릭', 'SSO', '세션']) {
        assert.equal(written.includes(word), false, `${file}에 "${word}"가 있습니다`);
      }
    }
  });
});
