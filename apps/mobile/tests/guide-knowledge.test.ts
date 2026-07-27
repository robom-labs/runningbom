// "러닝 궁금증"(app/screens/guide) 안내 글의 순수 규칙을 검증합니다.
// 예전에는 이 내용이 커뮤니티 안에 있었지만, 사람이 올리는 곳과 앱이 알려 주는 곳을 나눴습니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
} from '../app/screens/guide/knowledge';
import { knowledgeCards as legacyExport } from '../app/screens/community/knowledge';

const root = join(import.meta.dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

/** 화면에 그대로 보이는 글자만 모읍니다. 검색 낱말(keywords)은 화면에 안 보여 제외합니다. */
function visibleText(): string {
  return knowledgeCards
    .map((card) => `${card.question} ${card.answer.join(' ')} ${card.link?.hint ?? ''}`)
    .join(' ');
}

describe('러닝 궁금증 안내 글', () => {
  it('30개 이상을 6개 분류로 제공한다', () => {
    assert.ok(knowledgeCards.length >= 30, `글이 ${knowledgeCards.length}개뿐입니다`);
    const topics = new Set(knowledgeCards.map((card) => card.category));
    assert.equal(topics.size, 6);
    assert.equal(knowledgeCategories.length, 7); // 전체 + 6개
  });

  it('모든 분류에 글이 최소 3개씩 있다', () => {
    const counts = knowledgeCountsByCategory();
    assert.equal(counts['전체'], knowledgeCards.length);
    for (const category of knowledgeCategories) {
      if (category === '전체') continue;
      assert.ok(counts[category] >= 3, `${category} 글이 ${counts[category]}개뿐입니다`);
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
      assert.ok(card.keywords.length > 0, `${card.id} 검색 낱말이 없습니다`);
    }
  });

  it('모든 글의 답변을 5줄로 보강했다', () => {
    const short = knowledgeCards.filter((card) => card.answer.length < 5);
    assert.equal(short.length, 0, `아직 짧은 글: ${short.map((card) => card.id).join(', ')}`);
  });

  it('앱 안에 있는 화면만 관련 화면으로 연결한다', () => {
    const allowed = new Set(Object.keys(knowledgeLinkLabels));
    for (const card of knowledgeCards) {
      if (!card.link) continue;
      assert.ok(allowed.has(card.link.target), `${card.id}가 없는 화면을 가리킵니다`);
      assert.ok(card.link.hint.trim().length > 0, `${card.id} 안내 문구가 비었습니다`);
    }
  });

  it('아픈 곳을 다루는 글은 전문가 상담 안내를 넣고 단정 표현을 쓰지 않는다', () => {
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
    // 진단·치료를 단정하는 표현은 어떤 글에도 두지 않습니다.
    const banned = /(진단합니다|치료됩니다|낫습니다|병입니다|틀림없이|무조건)/;
    for (const card of knowledgeCards) {
      assert.ok(!banned.test(card.answer.join(' ')), `${card.id}에 단정 표현이 있습니다`);
    }
  });

  it('화면에 보이는 문구에 어려운 용어를 쓰지 않는다', () => {
    const text = visibleText();
    for (const word of ['스트릭', 'RPE', '인터벌', '파틀렉', '세션', '액티비티', '템포', '피드']) {
      assert.equal(text.includes(word), false, `화면 문구에 "${word}"가 남아 있습니다`);
    }
  });

  it('어려운 용어는 검색 낱말로 남겨 두어 검색은 계속 된다', () => {
    assert.ok(searchKnowledge('인터벌').some((card) => card.id === 'training-interval-start'));
    assert.ok(searchKnowledge('템포').some((card) => card.id === 'training-tempo-easy'));
    assert.ok(searchKnowledge('케이던스').some((card) => card.id === 'training-cadence'));
  });
});

describe('궁금증 검색과 분류 거르기', () => {
  it('질문 본문과 검색 낱말 양쪽에서 찾는다', () => {
    assert.ok(searchKnowledge('러닝화').length >= 2);
    assert.ok(searchKnowledge('무릎').some((card) => card.id === 'injury-knee'));
  });

  it('빈 검색어는 전체를 돌려주고, 없는 말은 0건이다', () => {
    assert.equal(searchKnowledge('').length, knowledgeCards.length);
    assert.equal(searchKnowledge('   ').length, knowledgeCards.length);
    assert.equal(searchKnowledge('존재하지않는검색어zzz').length, 0);
  });

  it('여러 단어는 모두 포함된 글만 남긴다', () => {
    const results = searchKnowledge('러닝화 교체');
    assert.ok(results.every((card) => /러닝화/.test(`${card.question}${card.keywords.join('')}`)));
    assert.ok(results.length <= searchKnowledge('러닝화').length);
  });

  it('분류와 검색을 함께 적용한다', () => {
    const results = findKnowledgeCards('장비', '러닝화');
    assert.ok(results.length >= 1);
    assert.ok(results.every((card) => card.category === '장비'));
    assert.equal(findKnowledgeCards('코스', '러닝화').length, 0);
  });
});

describe('화면 구성', () => {
  it('도움말 화면은 부모가 라우팅하도록 onBack·onNavigate만 받는다', () => {
    const screen = source('app/screens/guide/GuideScreen.tsx');
    assert.match(screen, /export function GuideScreen\(\{ onBack, onNavigate \}: Props\)/);
    assert.match(screen, /onBack\?: \(\) => void;/);
    assert.match(screen, /onNavigate\?: \(route: RouteKey\) => void;/);
    assert.match(screen, /screenStyles/);
  });

  it('검색·분류·펼치기를 모두 갖춘다', () => {
    const section = source('app/screens/guide/KnowledgeSection.tsx');
    assert.match(section, /<SearchField/);
    assert.match(section, /knowledgeCategories\.map/);
    assert.match(section, /<Disclosure/);
    assert.match(section, /onNavigate\(card\.link!\.target\)/);
  });

  it('"Q&A"라는 이름을 더 이상 쓰지 않는다', () => {
    for (const file of [
      'app/screens/guide/GuideScreen.tsx',
      'app/screens/guide/KnowledgeSection.tsx',
      'app/screens/guide/knowledge.ts',
      'app/screens/community/CommunityScreen.tsx',
    ]) {
      assert.equal(source(file).includes('Q&A'), false, `${file}에 옛 이름이 남아 있습니다`);
    }
  });

  it('옛 경로(app/screens/community/knowledge)도 같은 목록을 돌려준다', () => {
    // 홈 화면이 아직 옛 경로로 읽고 있어서 이음새를 남겨 뒀습니다.
    assert.equal(legacyExport, knowledgeCards);
  });
});
