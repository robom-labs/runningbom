// 디자인 토큰의 일관성과 접근성(대비·터치 대상·빈 상태 문구)을 회귀 검증합니다.
// 화면을 렌더링하지 않고, 토큰 값과 소스 텍스트만 검사해 새 의존성 없이 돌아갑니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  borderWidth,
  elevation,
  fontWeight,
  layout,
  lineHeight,
  motion,
  palette,
  pressedOpacity,
  radius,
  spacing,
  typeScale,
} from '../app/design-system/theme';

const root = join(import.meta.dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

/** WCAG 상대 휘도입니다. */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

// 실제 화면에서 쓰는 글자색과 배경색 조합입니다.
const textPairs: Array<[string, string, string]> = [
  ['본문 ink / 흰 카드', palette.ink, palette.surface],
  ['본문 ink / 캔버스', palette.ink, palette.canvas],
  ['보조 inkSoft / 흰 카드', palette.inkSoft, palette.surface],
  ['보조 inkSoft / 조용한 면', palette.inkSoft, palette.surfaceMuted],
  ['보조 inkSoft / 강조 면', palette.inkSoft, palette.surfaceWarm],
  ['설명 muted / 흰 카드', palette.muted, palette.surface],
  ['설명 muted / 캔버스', palette.muted, palette.canvas],
  ['설명 muted / 조용한 면', palette.muted, palette.surfaceMuted],
  ['설명 muted / 강조 면', palette.muted, palette.surfaceWarm],
  ['기본 버튼 글자 / 기본 버튼 면', palette.white, palette.accentStrong],
  ['선택 칩 글자 / 선택 칩 면', palette.white, palette.ink],
  ['강조 글자 / 흰 카드', palette.accentDark, palette.surface],
  ['강조 칩 글자 / 강조 칩 면', palette.accentDark, palette.accentSoft],
  ['성공 글자 / 성공 면', palette.positive, palette.positiveSoft],
  ['주의 글자 / 주의 면', palette.warning, palette.warningSoft],
  ['위험 글자 / 위험 면', palette.danger, palette.dangerSoft],
  ['남색 카드 제목', palette.onNavy, palette.navy],
  ['남색 카드 본문', palette.onNavySoft, palette.navy],
  ['남색 카드 보조', palette.onNavyMuted, palette.navy],
  ['남색 카드 라벨', palette.onNavyAccent, palette.navy],
];

describe('색 대비(WCAG AA 근사)', () => {
  it('본문·보조 글자 조합이 모두 4.5:1을 넘는다', () => {
    for (const [name, foreground, background] of textPairs) {
      const ratio = contrast(foreground, background);
      assert.ok(ratio >= 4.5, `${name} 대비 ${ratio.toFixed(2)}:1`);
    }
  });

  it('의미 있는 그래픽(진행률·막대)이 배경과 3:1 이상 구분된다', () => {
    assert.ok(contrast(palette.accentStrong, palette.surfaceMuted) >= 3);
    assert.ok(contrast(palette.accentStrong, palette.surface) >= 3);
    assert.ok(contrast(palette.positive, palette.surfaceMuted) >= 3);
  });
});

describe('디자인 토큰', () => {
  it('간격·글자 크기·줄 간격이 오름차순 척도를 유지한다', () => {
    const ascending = (values: number[]) =>
      values.every((value, index) => index === 0 || value > (values[index - 1] as number));
    assert.ok(ascending(Object.values(spacing)));
    assert.ok(ascending(Object.values(typeScale)));
    assert.ok(ascending(Object.values(lineHeight)));
  });

  it('글자 크기마다 같은 이름의 줄 간격이 있다', () => {
    for (const key of Object.keys(typeScale)) {
      assert.ok(
        lineHeight[key as keyof typeof lineHeight] > typeScale[key as keyof typeof typeScale],
        `${key} 줄 간격 누락`,
      );
    }
  });

  it('터치 대상 하한과 공통 레이아웃 값을 토큰으로 갖는다', () => {
    assert.equal(layout.touchTarget, 48);
    assert.equal(layout.gutter, spacing.md);
    assert.ok(layout.screenMaxWidth >= 720);
    assert.ok(pressedOpacity > 0 && pressedOpacity < 1);
  });

  it('그림자·테두리·모션 규칙이 두세 단계로만 정의된다', () => {
    assert.deepEqual(Object.keys(elevation), ['card', 'raised']);
    assert.deepEqual(Object.keys(borderWidth), ['thin', 'emphasis']);
    assert.deepEqual(Object.keys(motion), ['fast', 'base', 'slow']);
    assert.deepEqual(Object.keys(radius).sort(), ['lg', 'md', 'pill', 'sm']);
    assert.ok(Object.values(fontWeight).every((weight) => /^[1-9]00$/.test(weight)));
  });

  it('기존 화면이 쓰던 토큰 이름을 그대로 유지한다', () => {
    for (const key of ['canvas', 'surface', 'ink', 'inkSoft', 'muted', 'accent', 'navy', 'white']) {
      assert.ok(key in palette, `${key} 토큰 삭제됨`);
    }
    for (const key of ['caption', 'bodySmall', 'body', 'titleSmall', 'title', 'display']) {
      assert.ok(key in typeScale, `${key} 글자 크기 삭제됨`);
    }
  });
});

// 이 화면들은 색·글자 크기를 토큰으로만 지정해야 합니다.
const tokenOnlyFiles = [
  'app/design-system/components.tsx',
  'app/navigation/AppHeader.tsx',
  'app/navigation/DrawerMenu.tsx',
  'app/screens/onboarding/OnboardingScreen.tsx',
  'app/screens/home/HomeScreen.tsx',
  'app/screens/my/MyScreen.tsx',
  'app/screens/my/ManualActivityCard.tsx',
  'app/screens/community/CommunityScreen.tsx',
  'app/screens/community/DraftBox.tsx',
  'app/screens/community/ProfileSummaryCard.tsx',
  'app/screens/community/ShareCardComposer.tsx',
  'app/screens/guide/GuideScreen.tsx',
  'app/screens/guide/KnowledgeSection.tsx',
  'app/screens/calendar/CalendarScreen.tsx',
  'app/screens/calendar/MonthGrid.tsx',
  'app/screens/calendar/PlanForm.tsx',
  'app/screens/profile/ProfileScreen.tsx',
  'app/screens/settings/SettingsScreen.tsx',
  'app/screens/help/HelpScreen.tsx',
];

describe('디자인 일관성', () => {
  it('화면에 색상 리터럴을 직접 쓰지 않는다', () => {
    for (const file of tokenOnlyFiles) {
      const text = source(file);
      assert.equal(
        /#[0-9a-fA-F]{3,8}\b/.test(text.replace(/https?:\/\/\S+/g, '')),
        false,
        `${file}에 하드코딩된 색상이 있습니다`,
      );
      assert.equal(/rgba?\(/.test(text), false, `${file}에 하드코딩된 rgba 색상이 있습니다`);
    }
  });

  it('화면에 글자 크기·굵기 숫자를 직접 쓰지 않는다', () => {
    for (const file of tokenOnlyFiles) {
      const text = source(file);
      assert.equal(/fontSize: \d/.test(text), false, `${file}에 하드코딩된 글자 크기가 있습니다`);
      assert.equal(/fontWeight: '\d/.test(text), false, `${file}에 하드코딩된 굵기가 있습니다`);
    }
  });

  it('공통 버튼·칩·입력의 터치 높이를 토큰으로 잡는다', () => {
    const components = source('app/design-system/components.tsx');
    assert.match(components, /button: \{\s*minHeight: layout\.touchTarget/);
    assert.match(components, /chipTouchable: \{\s*minHeight: layout\.touchTarget/);
    assert.match(components, /searchInput: \{[\s\S]*?minHeight: layout\.touchTarget/);
  });

  it('화면들이 같은 스크롤 레이아웃(screenStyles)을 공유한다', () => {
    for (const file of tokenOnlyFiles.filter((path) => path.includes('Screen.tsx'))) {
      if (file.includes('onboarding')) continue;
      assert.match(source(file), /screenStyles/, `${file}이 공통 레이아웃을 쓰지 않습니다`);
    }
  });
});

describe('빈 상태와 로딩 상태', () => {
  it('주요 화면이 무엇을 하면 되는지 알려 주는 빈 상태를 갖는다', () => {
    for (const file of [
      'app/screens/home/HomeScreen.tsx',
      'app/screens/my/MyScreen.tsx',
      'app/screens/community/CommunityScreen.tsx',
      'app/screens/community/ShareCardComposer.tsx',
      'app/screens/guide/KnowledgeSection.tsx',
      'app/screens/calendar/CalendarScreen.tsx',
      'app/screens/help/HelpScreen.tsx',
    ]) {
      assert.match(source(file), /<EmptyState/, `${file}에 빈 상태 안내가 없습니다`);
    }
  });

  it('빈 상태 컴포넌트는 제목·설명과 행동 버튼 자리를 갖는다', () => {
    const components = source('app/design-system/components.tsx');
    assert.match(components, /export function EmptyState/);
    assert.match(components, /actionLabel/);
    assert.match(components, /export function SkeletonCard/);
  });

  it('불러오는 동안 스켈레톤이나 안내를 보여 준다', () => {
    assert.match(source('app/screens/home/HomeScreen.tsx'), /Skeleton/);
    assert.match(source('app/screens/community/CommunityScreen.tsx'), /SkeletonCard/);
  });
});

describe('스크린리더 라벨', () => {
  it('공통 컴포넌트가 라벨과 역할을 넘긴다', () => {
    const components = source('app/design-system/components.tsx');
    assert.match(components, /accessibilityLabel=\{accessibilityLabel \?\? label\}/);
    assert.match(components, /accessibilityRole="progressbar"/);
    assert.match(components, /accessibilityRole="header"/);
  });

  it('온보딩 선택지는 라디오 역할과 선택 상태를 알린다', () => {
    const screen = source('app/screens/onboarding/OnboardingScreen.tsx');
    assert.match(screen, /accessibilityRole="radiogroup"/);
    assert.match(screen, /accessibilityRole="radio"/);
    assert.match(screen, /accessibilityState=\{\{ selected, checked: selected \}\}/);
  });

  it('홈의 대회 탐색 대표 행동에 힌트와 테스트 아이디가 있다', () => {
    const home = source('app/screens/home/HomeScreen.tsx');
    assert.match(home, /testID="home-open-races"/);
    assert.match(home, /accessibilityHint="접수 중인 대회를 지역과 거리로 찾아봐요"/);
  });
});

describe('설정 정보구조', () => {
  it('코치·음성 / 알림 / 계정·데이터 / 앱 정보로 묶고 미지원 연동은 상시 노출하지 않는다', () => {
    const settings = source('app/screens/settings/SettingsScreen.tsx');
    for (const title of ['코치·음성', '알림', '계정·데이터', '앱 정보']) {
      assert.ok(settings.includes(`title="${title}"`), `${title} 묶음이 없습니다`);
    }
    assert.ok(!settings.includes('title="연동"'), '쓸 수 없는 연동 묶음이 상시 노출됩니다');
    assert.ok(!settings.includes('title="연동 준비 중"'), '준비 중 플레이스홀더가 남았습니다');
  });

  it('항목마다 한 줄 설명을 붙인다', () => {
    const settings = source('app/screens/settings/SettingsScreen.tsx');
    assert.match(settings, /function SettingLabel/);
    assert.ok((settings.match(/<SettingLabel/g) ?? []).length >= 6);
  });

  it('온보딩에서 고른 음성 성별을 설정에서 다시 바꿀 수 있다', () => {
    const settings = source('app/screens/settings/SettingsScreen.tsx');
    assert.match(settings, /saveCoachVoicePreference/);
    assert.match(settings, /voiceGenderLabels/);
  });
});
