// 커뮤니티(사람이 올리는 곳)의 순수 규칙을 검증합니다.
// - 공유 카드: 저장된 내 기록만 쓰고, 없는 값을 지어내지 않는지
// - 구획 순서: 기본으로 열리는 곳이 "준비 중"이 되지 않는지
// - 내 글 보관함: 기기에만 저장하는 규칙이 그대로인지
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import type { ActivityRecord } from '../domains/activities/types';
import {
  buildShareCard,
  noDistanceLabel,
  shareableActivities,
  shareCardMinimumMinutes,
  shareCardPreviewLines,
  shareCardText,
  shareCardTitle,
} from '../domains/social/shareCard';
import {
  communitySections,
  defaultCommunitySection,
  firstReadySection,
  notReadySuffix,
  sectionAccessibilityLabel,
  sectionChipLabel,
} from '../app/screens/community/sections';
import {
  COMMUNITY_DRAFT_KEY,
  DRAFT_BODY_MAX,
  DRAFT_LIMIT,
  draftTopics,
  parseDraft,
  parseDraftList,
  withDraft,
  withoutDraft,
  type CommunityDraft,
} from '../app/screens/community/drafts';
import { knowledgeCategories, type KnowledgeTopic } from '../app/screens/guide/knowledge';

const root = join(import.meta.dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

function activity(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
  return {
    id: 'act-1',
    localUuid: 'local-test',
    kind: 'run',
    durationMinutes: 30,
    distanceKm: 5.2,
    source: 'COACH_COMPLETED',
    completedAt: '2026-07-26T09:00:00.000Z',
    timezoneId: 'Asia/Seoul',
    ...overrides,
  };
}

function draft(id: string, overrides: Partial<CommunityDraft> = {}): CommunityDraft {
  return {
    id,
    topic: '초보질문',
    body: '무릎이 아플 때 어떻게 하나요',
    createdAt: '2026-07-26T09:00:00.000Z',
    ...overrides,
  };
}

describe('내 기록 공유 카드', () => {
  it('저장된 값만으로 카드 문구를 만든다', () => {
    const card = buildShareCard(activity());
    assert.equal(card.activityId, 'act-1');
    assert.equal(card.kindLabel, '달리기');
    assert.equal(card.distanceLabel, '5.2km');
    assert.equal(card.durationLabel, '30분');
    assert.equal(card.paceLabel, `1km당 5'46"`);
    assert.equal(card.hasDistance, true);
    assert.match(card.dateLabel, /2026년 7월 26일/);
    assert.match(card.shortDateLabel, /7월 26일/);
    assert.equal(card.sourceLabel, '러닝봄 코치 완주');
  });

  it('거리를 재지 않은 기록은 0km라고 하지 않고 "안 쟀다"고 적는다', () => {
    const card = buildShareCard(activity({ distanceKm: undefined }));
    assert.equal(card.hasDistance, false);
    assert.equal(card.distanceLabel, noDistanceLabel);
    assert.equal(card.distanceLabel.includes('0'), false);
    assert.match(card.paceLabel, /계산할 수 없어요/);
    assert.deepEqual(shareCardPreviewLines(card), [
      noDistanceLabel,
      '30분',
      card.paceLabel,
    ]);
  });

  it('날짜가 깨진 기록도 지어내지 않고 모른다고 적는다', () => {
    const card = buildShareCard(activity({ completedAt: 'not-a-date' }));
    assert.equal(card.dateLabel, '날짜를 알 수 없는 기록');
    assert.equal(card.shortDateLabel, '날짜 모름');
  });

  it('공유 글에 카드에 있는 값만 들어간다', () => {
    const text = shareCardText(buildShareCard(activity()), '봄이');
    const lines = text.split('\n');
    assert.equal(lines[0], shareCardTitle);
    assert.match(text, /2026년 7월 26일/);
    assert.match(text, /달리기 · 5\.2km · 30분/);
    assert.match(text, /1km당 5'46"/);
    assert.equal(lines.at(-1), '봄이의 기록');
  });

  it('닉네임이 비어 있으면 사람 이름 줄을 넣지 않는다', () => {
    const text = shareCardText(buildShareCard(activity()), '   ');
    assert.equal(text.includes('의 기록'), false);
    assert.equal(shareCardText(buildShareCard(activity())).includes('의 기록'), false);
  });

  it('짧은 기록은 카드 목록에 올리지 않고 최근 순으로 정렬한다', () => {
    const list = shareableActivities([
      activity({ id: 'old', completedAt: '2026-07-01T09:00:00.000Z' }),
      activity({ id: 'tiny', durationMinutes: shareCardMinimumMinutes - 1 }),
      activity({ id: 'new', completedAt: '2026-07-26T09:00:00.000Z' }),
    ]);
    assert.deepEqual(
      list.map((item) => item.id),
      ['new', 'old'],
    );
    assert.equal(shareableActivities([], 10).length, 0);
    assert.equal(shareableActivities([activity(), activity({ id: 'b' })], 1).length, 1);
  });

  it('걷기·회복 운동도 그 이름 그대로 카드가 된다', () => {
    assert.equal(buildShareCard(activity({ kind: 'walk' })).kindLabel, '걷기');
    assert.equal(buildShareCard(activity({ kind: 'recovery' })).kindLabel, '회복 운동');
  });
});

describe('커뮤니티 구획 순서', () => {
  it('기본으로 열리는 곳은 절대 "준비 중"이 아니다', () => {
    const first = communitySections[0];
    assert.ok(first);
    assert.equal(first.ready, true);
    assert.equal(defaultCommunitySection, first.key);
    assert.equal(firstReadySection(), first.key);
    const target = communitySections.find((section) => section.key === defaultCommunitySection);
    assert.equal(target?.ready, true);
  });

  it('지금 쓸 수 있는 구획이 준비 중 구획보다 모두 앞에 온다', () => {
    const lastReady = communitySections.map((section) => section.ready).lastIndexOf(true);
    const firstNotReady = communitySections.map((section) => section.ready).indexOf(false);
    assert.ok(firstNotReady === -1 || lastReady < firstNotReady);
  });

  it('준비 중인 곳은 이름에서부터 준비 중이라고 밝힌다', () => {
    for (const section of communitySections) {
      const label = sectionChipLabel(section);
      assert.equal(label.includes(notReadySuffix), !section.ready, `${section.key} 표기 오류`);
      assert.equal(
        sectionAccessibilityLabel(section).includes(notReadySuffix),
        !section.ready,
        `${section.key} 스크린리더 표기 오류`,
      );
      assert.ok(section.hint.trim().length > 0, `${section.key} 설명이 비었습니다`);
    }
  });

  it('지원하지 않는 모임 기능을 화면에 계속 노출하지 않는다', () => {
    const screen = source('app/screens/community/CommunityScreen.tsx');
    assert.doesNotMatch(screen, /section === 'together'/);
    assert.doesNotMatch(screen, /나중에 열리면 참여할래요/);
    assert.equal(/\d{4}년 \d{1,2}월에? (열|공개)/.test(screen), false);
  });
});

describe('커뮤니티 화면 구성', () => {
  const screen = source('app/screens/community/CommunityScreen.tsx');

  it('맨 위가 내 프로필 요약이고 누르면 프로필로 간다', () => {
    const profileIndex = screen.indexOf('<ProfileSummaryCard');
    assert.ok(profileIndex > 0, '프로필 요약이 없습니다');
    assert.ok(profileIndex < screen.indexOf('visibleSections.map'), '프로필이 구획보다 뒤에 있습니다');
    assert.ok(profileIndex < screen.indexOf('<ShareCardComposer'), '프로필이 본문보다 뒤에 있습니다');
    assert.match(screen, /onOpenProfile: \(\) => onNavigate\('profile'\)/);
  });

  it('가짜 사용자·가짜 글을 만들지 않는다고 화면에 적어 둔다', () => {
    assert.match(screen, /가짜 사용자/);
    assert.equal(/authorNickname: '/.test(screen), false, '화면에 사람 이름을 박아 넣었습니다');
  });

  it('공유는 새 라이브러리 없이 React Native 내장 Share를 쓴다', () => {
    const composer = source('app/screens/community/ShareCardComposer.tsx');
    assert.match(composer, /import \{[^}]*Share[^}]*\} from 'react-native'/);
    assert.match(composer, /Share\.share\(\{ message, title: shareCardTitle \}\)/);
    const packageJson = source('package.json');
    for (const banned of ['view-shot', 'html-to-image', 'react-native-share']) {
      assert.equal(packageJson.includes(banned), false, `${banned} 의존성이 추가됐습니다`);
    }
  });

  it('화면 문구에 어려운 낱말을 쓰지 않는다', () => {
    for (const file of [
      'app/screens/community/CommunityScreen.tsx',
      'app/screens/community/ShareCardComposer.tsx',
      'app/screens/community/ProfileSummaryCard.tsx',
      'app/screens/community/DraftBox.tsx',
      'app/screens/community/sections.ts',
    ]) {
      const text = source(file);
      for (const banned of ['스트릭', 'RPE', '인터벌', '액티비티', '타임라인']) {
        assert.equal(text.includes(banned), false, `${file}에 "${banned}"가 있습니다`);
      }
    }
  });
});

describe('내 글 보관함', () => {
  it('새 저장 키만 쓰고 기존 키를 재사용하지 않는다', () => {
    assert.equal(COMMUNITY_DRAFT_KEY, 'runningbom:vnext:community-drafts:v1');
    assert.notEqual(COMMUNITY_DRAFT_KEY, 'runningbom:vnext:run-plans:v1');
    assert.notEqual(COMMUNITY_DRAFT_KEY, 'runningbom:vnext:weekly-goal:v1');
  });

  it('너무 짧거나 긴 글은 막고 공백을 정리한다', () => {
    assert.equal(parseDraft('초보질문', '짧음').ok, false);
    assert.equal(parseDraft('초보질문', 'ㄱ'.repeat(DRAFT_BODY_MAX + 1)).ok, false);
    const result = parseDraft('훈련법', '  빠르게   달리는 건 언제부터 하나요?  ');
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.body, '빠르게 달리는 건 언제부터 하나요?');
      assert.equal(result.value.topic, '훈련법');
    }
  });

  it('주제는 러닝 궁금증의 분류와 같은 6종이다', () => {
    assert.equal(draftTopics.length, 6);
    for (const topic of draftTopics) {
      const category: KnowledgeTopic = topic;
      assert.ok(knowledgeCategories.includes(category));
    }
    assert.equal(parseDraft('없는주제' as KnowledgeTopic, '이것은 충분히 긴 본문입니다').ok, false);
  });

  it('저장된 JSON이 깨져도 빈 목록으로 복구한다', () => {
    assert.deepEqual(parseDraftList(null), []);
    assert.deepEqual(parseDraftList('{not json'), []);
    assert.deepEqual(parseDraftList('{"a":1}'), []);
    assert.deepEqual(parseDraftList('[{"id":"x"}]'), []);
    assert.equal(parseDraftList(JSON.stringify([draft('a'), { id: 'bad' }])).length, 1);
  });

  it('최신 글이 위로 오고 상한을 넘지 않는다', () => {
    const many = Array.from({ length: DRAFT_LIMIT }, (_, index) => draft(`d${index}`));
    const next = withDraft(many, draft('new'));
    assert.equal(next.length, DRAFT_LIMIT);
    assert.equal(next[0]?.id, 'new');
    assert.equal(withDraft([draft('a')], draft('a', { body: '수정된 본문입니다' })).length, 1);
    assert.equal(withoutDraft([draft('a'), draft('b')], 'a').length, 1);
  });

  it('보관한 글이 서버로 전송되지 않는다고 분명히 알린다', () => {
    const box = source('app/screens/community/DraftBox.tsx');
    assert.match(box, /다른 사람에게 보이지 않아요/);
    assert.match(box, /저절로 밖으로\s*전송되지 않아요/);
    assert.doesNotMatch(box, /커뮤니티가 열리면/);
  });
});
