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
  shareCardLandingUrl,
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

  it('공유 글은 실제 기록값과 고정된 러닝봄 유입 주소만 사용한다', () => {
    const text = shareCardText(buildShareCard(activity()), '봄이');
    const lines = text.split('\n');
    assert.equal(lines[0], shareCardTitle);
    assert.match(text, /2026년 7월 26일/);
    assert.match(text, /달리기 · 5\.2km · 30분/);
    assert.match(text, /1km당 5'46"/);
    assert.ok(text.includes('봄이의 기록'));
    assert.ok(text.includes('러닝봄에서 함께 기록하기'));
    assert.equal(lines.at(-1), shareCardLandingUrl);
    assert.equal(text.split(shareCardLandingUrl).length - 1, 1);
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

  it('준비 중 구획은 언제 열리는지 지어내지 않는다', () => {
    const screen = source('app/screens/community/CommunityScreen.tsx');
    assert.match(screen, /아직 정해지지 않았어요/);
    assert.equal(/\d{4}년 \d{1,2}월에? (열|공개)/.test(screen), false);
  });
});

describe('커뮤니티 화면 구성', () => {
  const screen = source('app/screens/community/CommunityScreen.tsx');

  it('맨 위가 내 프로필 요약이고 누르면 프로필로 간다', () => {
    assert.match(screen, /프로필/);
    assert.match(screen, /onOpenProfile/);
  });

  it('정보 공유와 궁금증 해결은 서로 다른 구획이다', () => {
    assert.notEqual(
      communitySections.find((section) => section.key === 'feed')?.key,
      communitySections.find((section) => section.key === 'questions')?.key,
    );
  });

  it('내 기록으로 카드 만들기와 내 글 보관함이 실제로 존재한다', () => {
    assert.match(screen, /ShareCardComposer/);
    assert.match(screen, /CommunityDrafts/);
  });
});

describe('내 글 보관함', () => {
  it('저장 키는 기존 설정 키와 겹치지 않는 전용 키다', () => {
    assert.equal(COMMUNITY_DRAFT_KEY, 'runningbom:vnext:community-drafts:v1');
  });

  it('입력값을 정리하고 너무 긴 글을 자른다', () => {
    const value = parseDraft({
      id: ' draft-1 ',
      topic: '초보질문',
      body: `  ${'가'.repeat(DRAFT_BODY_MAX + 20)}  `,
      createdAt: '2026-07-26T09:00:00.000Z',
    });
    assert.equal(value?.id, 'draft-1');
    assert.equal(value?.body.length, DRAFT_BODY_MAX);
  });

  it('깨진 항목은 버리고 최대 개수까지만 최근 순으로 유지한다', () => {
    const values = Array.from({ length: DRAFT_LIMIT + 3 }, (_, index) =>
      draft(`draft-${index}`, {
        createdAt: new Date(Date.UTC(2026, 6, index + 1)).toISOString(),
      }),
    );
    const parsed = parseDraftList([...values, { id: '', body: '' }]);
    assert.equal(parsed.length, DRAFT_LIMIT);
    assert.equal(parsed[0]?.id, `draft-${DRAFT_LIMIT + 2}`);
  });

  it('같은 글을 다시 저장하면 중복 없이 최신값으로 바꾼다', () => {
    const updated = withDraft([draft('one'), draft('two')], draft('one', { body: '바뀐 내용' }));
    assert.equal(updated.length, 2);
    assert.equal(updated[0]?.body, '바뀐 내용');
  });

  it('지운 글만 정확히 뺀다', () => {
    assert.deepEqual(
      withoutDraft([draft('one'), draft('two')], 'one').map((item) => item.id),
      ['two'],
    );
  });

  it('주제 선택지는 모두 쉬운 이름이고 중복이 없다', () => {
    assert.equal(new Set(draftTopics).size, draftTopics.length);
    for (const topic of draftTopics) assert.ok(topic.length >= 2);
  });
});

describe('궁금증 지식 자료', () => {
  it('카테고리는 사용자가 이해할 수 있는 한국어 이름이다', () => {
    const categories = knowledgeCategories as readonly KnowledgeTopic[];
    assert.ok(categories.includes('처음 달리기'));
    assert.ok(categories.includes('통증과 부상'));
    assert.equal(new Set(categories).size, categories.length);
  });
});
