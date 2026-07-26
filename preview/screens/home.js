// 홈 화면은 오늘의 한 가지 러닝과 짧은 진행 정보를 보여 줍니다.
import { sessions } from '../data/sessions.js';
import { html } from '../ui/helpers.js';

export function renderHome(state) {
  const current = sessions[state.selectedSession];
  return html`
    <section class="screen-heading"><span class="eyebrow">TODAY RUN</span><h1>오늘의 리듬을<br />가볍게 시작해요.</h1><p>시간·훈련 목적·안내 밀도를 내 컨디션에 맞게 고를 수 있어요.</p></section>
    <section class="card today-card"><div class="card-top"><span class="pill">오늘의 코칭</span><span>${state.selectedMinutes}분</span></div><div class="today-copy"><strong>${current.title}</strong><span>${current.subtitle}</span></div><div class="card-footer"><button class="secondary" data-tab="시작">세션 변경</button><button class="primary" data-tab="시작">코칭 시작</button></div></section>
    <section class="stat-strip"><div class="stat"><b>🔥 12일</b><span>개인 스트릭</span></div><div class="stat"><b>2 / 3회</b><span>이번 주 러닝</span></div></section>
    <section class="section"><div class="section-title"><h2>이번 주 기록</h2><button class="text-button" data-tab="마이" data-my-view="기록">캘린더 보기</button></div><div class="week-strip">${['월', '화', '수', '목', '금', '토', '일'].map((day, index) => `<div class="week-day ${[0, 2, 5].includes(index) ? 'done' : ''}"><span>${day}</span><b>${[0, 2, 5].includes(index) ? '●' : '·'}</b></div>`).join('')}</div></section>
    <section class="section"><div class="section-title"><h2>다가오는 대회</h2><button class="text-button" data-tab="탐색">모두 보기</button></div><div class="card stack"><div class="list-row"><span><b>한돈런</b><small>경기 · 미사 · 10K</small></span><span class="mini-tag">접수 중</span></div><div class="list-row"><span><b>2026 서울마라톤</b><small>서울 · 풀/10K</small></span><span class="mini-tag">D-2</span></div></div></section>
    <section class="section"><div class="section-title"><h2>러너들의 오늘</h2><button class="text-button" data-tab="커뮤니티">커뮤니티</button></div><div class="feed-card"><b>초보 러너 민지</b><p>오늘 20분, 멈추지 않고 달렸어요.</p><div class="reactions"><button>응원해요 12</button><button>꾸준해요 4</button></div></div></section>`;
}
