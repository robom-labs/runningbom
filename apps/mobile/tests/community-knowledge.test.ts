// 커뮤니티 Q&A 지식 카드와 로컬 임시 보관함의 순수 규칙을 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  filterKnowledgeByCategory,
  findKnowledgeCards,
  knowledgeCards,
  knowledgeCareNote,
  knowledgeCategories,
  knowledgeCountsByCategory,
  knowledgeLinkLabels,
  searchKnowledge,
  type KnowledgeTopic,
} from '../app/screens/community/knowledge';
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

function draft(id: string, overrides: Partial<CommunityDraft> = {}): CommunityDraft {
  return {
    id,
    topic: '초보질문',
    body: '무릎이 아플 때 어떻게 하나요',
    createdAt: '2026-07-26T09:00:00.000Z',
    ...overrides,
  };
}

describe('러닝 Q&A 지식 카드', () => {
  it('30개 이상을 6개 카테고리로 제공한다', () => {
    assert.ok(knowledgeCards.length >= 30, `카드가 ${knowledgeCards.length}개뿐입니다`);
    const topics = new Set(knowledgeCards.map((card) => card.category));
    assert.equal(topics.size, 6);
    assert.equal(knowledgeCategories.length, 7); // 전체 + 6개
  });

  it('모든 카테고리에 카드가 최소 3개씩 있다', () => {
    const counts = knowledgeCountsByCategory();
    assert.equal(counts['전체'], knowledgeCards.length);
    for (const category of knowledgeCategories) {
      if (category === '전체') continue;
      assert.ok(counts[category] >= 3, `${category} 카드가 ${counts[category]}개뿐입니다`);
    }
  });

  it('id가 중복되지 않고 답변은 3~5줄이다', () => {
    const ids = new Set(knowledgeCards.map((card) => card.id));
    assert.equal(ids.size, knowledgeCards.length);
    for (const card of knowledgeCards) {
      assert.ok(card.question.trim().length > 0, `${card.id} 질문이 비어 있습니다`);
      assert.ok(
        card.answer.length >= 3 && card.answer.length <= 5,
        `${card.id} 답변이 ${card.answer.length}줄입니다`,
      );
      for (const line of card.answer) {
        assert.ok(line.trim().length > 0, `${card.id} 답변에 빈 줄이 있습니다`);
      }
      assert.ok(card.keywords.length > 0, `${card.id} 키워드가 없습니다`);
    }
  });

  it('앱 안의 기능만 관련 기능으로 연결한다', () => {
    const allowed = new Set(Object.keys(knowledgeLinkLabels));
    for (const card of knowledgeCards) {
      if (!card.link) continue;
      assert.ok(allowed.has(card.link.target), `${card.id}가 없는 기능을 가리킵니다`);
      assert.ok(card.link.hint.trim().length > 0, `${card.id} 안내 문구가 비었습니다`);
    }
  });

  it('부상·통증 카드는 전문가 상담 안내를 포함하고 단정 표현을 쓰지 않는다', () => {
    const injuryCards = filterKnowledgeByCategory('부상예방·회복');
    assert.ok(injuryCards.length >= 5);
    const painCards = injuryCards.filter((card) => /아파|통증/.test(card.question));
    assert.ok(painCards.length >= 3);
    for (const card of painCards) {
      assert.ok(
        card.answer.includes(knowledgeCareNote),
        `${card.id}에 전문가 상담 안내가 없습니다`,
      );
    }
    // 진단·치료를 단정하는 표현은 어떤 카드에도 두지 않습니다.
    const banned = /(진단합니다|치료됩니다|낫습니다|병입니다|틀림없이|무조건)/;
    for (const card of knowledgeCards) {
      assert.ok(!banned.test(card.answer.join(' ')), `${card.id}에 단정 표현이 있습니다`);
    }
  });
});

describe('Q&A 검색과 카테고리 필터', () => {
  it('질문 본문과 키워드 양쪽에서 찾는다', () => {
    assert.ok(searchKnowledge('러닝화').length >= 2);
    assert.ok(searchKnowledge('무릎').some((card) => card.id === 'injury-knee'));
    assert.ok(searchKnowledge('케이던스').some((card) => card.id === 'training-cadence'));
    assert.ok(searchKnowledge('인터벌').some((card) => card.id === 'training-interval-start'));
  });

  it('빈 검색어는 전체를 돌려주고, 없는 말은 0건이다', () => {
    assert.equal(searchKnowledge('').length, knowledgeCards.length);
    assert.equal(searchKnowledge('   ').length, knowledgeCards.length);
    assert.equal(searchKnowledge('존재하지않는검색어zzz').length, 0);
  });

  it('여러 단어는 모두 포함된 카드만 남긴다', () => {
    const results = searchKnowledge('러닝화 교체');
    assert.ok(results.every((card) => /러닝화/.test(`${card.question}${card.keywords.join('')}`)));
    assert.ok(results.length <= searchKnowledge('러닝화').length);
  });

  it('카테고리와 검색을 함께 적용한다', () => {
    const results = findKnowledgeCards('장비', '러닝화');
    assert.ok(results.length >= 1);
    assert.ok(results.every((card) => card.category === '장비'));
    assert.equal(findKnowledgeCards('코스', '러닝화').length, 0);
  });
});

describe('로컬 임시 보관함', () => {
  it('새 저장 키만 쓰고 기존 키를 재사용하지 않는다', () => {
    assert.equal(COMMUNITY_DRAFT_KEY, 'runningbom:vnext:community-drafts:v1');
    assert.notEqual(COMMUNITY_DRAFT_KEY, 'runningbom:vnext:run-plans:v1');
    assert.notEqual(COMMUNITY_DRAFT_KEY, 'runningbom:vnext:weekly-goal:v1');
  });

  it('너무 짧거나 긴 글은 막고 공백을 정리한다', () => {
    assert.equal(parseDraft('초보질문', '짧음').ok, false);
    assert.equal(parseDraft('초보질문', 'ㄱ'.repeat(DRAFT_BODY_MAX + 1)).ok, false);
    const result = parseDraft('훈련법', '  인터벌은   언제부터 하나요?  ');
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.body, '인터벌은 언제부터 하나요?');
      assert.equal(result.value.topic, '훈련법');
    }
  });

  it('주제는 Q&A 카테고리와 같은 6종이다', () => {
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
});
