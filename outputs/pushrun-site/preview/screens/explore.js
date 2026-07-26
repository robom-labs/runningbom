// 탐색 화면은 기존 대회 카드와 국내 판매처 중심 러닝화 구조를 분리해 렌더합니다.
import { races } from '../data/races.js';
import { shoes } from '../data/shoes.js';
import { html, switchButtons } from '../ui/helpers.js';

function renderRaceExplore(state) {
  const distanceRows = [['전체', 'Full', 'Half'], ['10K', '5K', 'Trail']];
  const labels = { Full: '풀', Half: '하프', Trail: '트레일' };
  const filtered = races.filter((race) => (state.distance === '전체' || race.distance.includes(labels[state.distance] || state.distance)) && (state.status === '전체' || race.status === state.status));
  const cards = filtered.map((race) => html`<article class="race-card"><div class="race-day">${race.status === '접수 중' ? '접수<br />중' : race.days}</div><div class="race-body"><h2>${race.name}</h2><p>${race.area} · ${race.distance}</p><div class="race-actions"><button data-action="details">자세히 보기</button><button data-action="alert">알림</button></div></div></article>`).join('');
  return html`
    <section class="legacy-link"><div><b>이전 대회 화면을 그대로 유지합니다.</b><span>공식 접수처·대회 캘린더·알림은 기존 러닝봄에서 계속 확인해요.</span></div><a href="../" target="_blank" rel="noopener noreferrer">기존 대회 화면 열기</a></section>
    <section class="card"><div class="section-title"><h2>대회 찾기</h2><span class="mini-tag">대회 ${filtered.length}개</span></div><div class="filter-line filters">${switchButtons(distanceRows[0], state.distance, 'distance')}</div><div class="filter-line filters">${switchButtons(distanceRows[1], state.distance, 'distance')}</div><div class="filter-line filters">${switchButtons(['전체', '접수 중', '접수 예정'], state.status, 'status')}</div></section>
    <section class="section stack">${cards || '<div class="card"><b>맞는 대회를 찾지 못했어요.</b><p>필터를 바꿔 보세요.</p></div>'}</section>`;
}

function shoeCard(shoe) {
  const naver = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(`${shoe.brand} ${shoe.model}`)}`;
  const coupang = `https://www.coupang.com/np/search?q=${encodeURIComponent(`${shoe.brand} ${shoe.model}`)}`;
  return html`<article class="shoe-card"><div class="shoe-top"><span class="shoe-brand">${shoe.brand}</span><span class="mini-tag">${shoe.use}</span></div><h2>${shoe.model}</h2><div class="tag-row">${shoe.tags.map((tag) => `<span>${tag}</span>`).join('')}</div><p>${shoe.fit}</p><small>${shoe.note}</small><details><summary>왜 이 신발을 보나요?</summary><p>러닝봄은 목적·거리·착화감 우선순위를 기준으로 비교 후보를 정리합니다. 의료적 발 분석이나 부상 진단은 제공하지 않습니다.</p></details><div class="shoe-actions"><a href="${naver}" target="_blank" rel="noopener noreferrer">네이버 가격 보기</a><a href="${coupang}" target="_blank" rel="noopener noreferrer">쿠팡 검색</a><a href="${shoe.official}" target="_blank" rel="noopener noreferrer">국내 공식몰</a></div></article>`;
}

function renderShoeExplore(state) {
  const groups = ['추천', '데일리', '장거리', '스피드', '출시 예정'];
  const goals = ['전체', '5~10km', '하프·풀', '입문', '기록'];
  const visible = shoes.filter((shoe) => (state.shoeGroup === '추천' || shoe.group === state.shoeGroup) && (state.shoeGoal === '전체' || (state.shoeGoal === '5~10km' && shoe.group === '데일리') || (state.shoeGoal === '하프·풀' && shoe.group === '장거리') || (state.shoeGoal === '입문' && shoe.tags.includes('입문')) || (state.shoeGoal === '기록' && shoe.tags.includes('카본'))));
  return html`
    <section class="shoe-intro"><span class="eyebrow">SHOES</span><h2>달리는 목적에 맞춰<br />한 켤레부터 비교해요.</h2><p>국내 공식몰·네이버 쇼핑·쿠팡 검색으로만 연결합니다. 가격·재고는 버튼을 누른 시점에 각 판매처에서 확인해요.</p></section>
    <section class="card"><div class="section-title"><h2>어떻게 달리나요?</h2><button class="text-button" data-action="shoe-finder">맞춤 찾기</button></div><div class="filter-line filters">${switchButtons(groups, state.shoeGroup, 'shoe-group')}</div><div class="filter-line filters">${switchButtons(goals, state.shoeGoal, 'shoe-goal')}</div></section>
    <section class="section"><div class="section-title"><h2>${state.shoeGroup === '출시 예정' ? '국내 출시 확인 중' : '비교할 러닝화'}</h2><span class="mini-tag">${visible.length}종</span></div>${state.shoeGroup === '출시 예정' ? '<p class="notice">출시 예정은 국내 공식 발표·국내 판매 일정이 동시에 확인된 제품만 넣습니다. 현재 이 미리보기에는 추측성 출시 예정 제품을 넣지 않았어요.</p>' : ''}<div class="shoe-grid">${visible.map(shoeCard).join('') || '<div class="card"><b>조건에 맞는 제품을 준비 중이에요.</b><p>필터를 바꾸거나 전체에서 비교해 보세요.</p></div>'}</div></section>
    <p class="notice">현재 8종은 화면 구조 검토용 초기 목록입니다. 실제 앱에는 브랜드별 국내 공식 사양·국내 판매 여부·확인일을 검증한 뒤 늘립니다.</p>`;
}

export function renderExplore(state) {
  const heading = state.exploreView === '대회' ? '대회 하나를<br />한 장으로 봐요.' : '러닝화는 목적에 맞춰<br />비교해요.';
  const subtitle = state.exploreView === '대회' ? '종목 수가 아니라 실제 대회 기준으로 셉니다.' : '출시 예정도 러닝화 안에서만 구분합니다.';
  return html`<section class="screen-heading"><span class="eyebrow">EXPLORE</span><h1>${heading}</h1><p>${subtitle}</p></section><section class="switcher" aria-label="탐색 대상">${switchButtons(['대회', '러닝화'], state.exploreView, 'explore')}</section>${state.exploreView === '대회' ? renderRaceExplore(state) : renderShoeExplore(state)}`;
}
