// 마이 화면은 프로필, 배지, 운동 이력 캘린더를 나눠 보여 줍니다.
import { calendarDays } from '../data/records.js';
import { html, switchButtons } from '../ui/helpers.js';

function renderCalendar() {
  const monthLength = 31;
  const firstWeekdayBlankCount = 3;
  const blanks = Array.from({ length: firstWeekdayBlankCount }, () => '<span class="calendar-empty"></span>').join('');
  const days = Array.from({ length: monthLength }, (_, index) => {
    const day = index + 1;
    const item = calendarDays.find((record) => record.day === day);
    return `<button class="calendar-day ${item ? `recorded ${item.kind}` : ''}" data-calendar-day="${day}" aria-label="7월 ${day}일${item ? `, ${item.label}` : ''}"><span>${day}</span>${item ? `<strong>${item.kind === 'run' ? 'RUN' : item.kind === 'walk' ? 'WALK' : 'REST'}</strong><em>${item.label}</em>` : ''}</button>`;
  }).join('');
  return html`<section class="screen-heading"><span class="eyebrow">MY RECORDS</span><h1>달린 날이<br />한눈에 보여요.</h1><p>코칭 완주와 직접 기록한 운동을 출처와 함께 구분합니다.</p></section><section class="card calendar-card"><div class="calendar-heading"><div><span class="eyebrow">2026 JULY</span><h2>7월 기록 캘린더</h2><p>날짜를 누르면 그날의 운동 출처와 시간을 확인해요.</p></div><span class="calendar-legend">러닝 · 걷기 · 휴식</span></div><div class="calendar-weekdays"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div><div class="calendar-grid">${blanks}${days}</div></section><section class="section"><div class="section-title"><h2>기록 상세</h2><button class="text-button" data-action="manual-record">직접 기록</button></div><div class="card stack">${calendarDays.filter((item) => item.kind !== 'rest').map((item) => `<div class="list-row"><span><b>7월 ${item.day}일 · ${item.label}</b><small>${item.meta}</small></span><span class="mini-tag">${item.kind === 'run' ? '러닝' : '걷기'}</span></div>`).join('')}</div></section><section class="card"><div class="section-title"><h2>기록 저장 범위</h2><span class="mini-tag">이 기기</span></div><p>현재는 러닝봄에서 마친 코칭과 직접 입력한 기록만 이 기기에 저장합니다.</p></section>`;
}

function renderProfile() {
  const badges = [['●', '첫 코칭', '코칭 세션 첫 완주'], ['5K', '첫 5K', '첫 5km 러닝'], ['7', '7일 스트릭', '7일 연속 움직임'], ['3', '주 3회', '주간 러닝 달성'], ['◎', '대회 목표', '첫 대회 목표 저장'], ['♧', '첫 크루', '첫 크루 참여']];
  return html`<section class="card profile-hero"><div class="avatar">JP</div><div><h1>준필 러너</h1><p>이번 주도 한 번 더 달려요.</p></div><button class="text-button" data-action="profile-save">프로필 저장</button></section><section class="stat-strip"><div class="stat"><b>꾸준러너</b><span>현재 티어</span></div><div class="stat"><b>대표 배지 1개</b><span>배지 7개 보관</span></div></section><section class="section"><div class="section-title"><h2>내 배지</h2><button class="text-button" data-action="badge-all">모두 보기</button></div><div class="badge-grid">${badges.map(([mark, title, description]) => `<article class="badge-card"><span>${mark}</span><strong>${title}</strong><small>${description}</small></article>`).join('')}</div></section><section class="section"><div class="section-title"><h2>내 설정</h2></div><div class="card stack"><div class="list-row"><span><b>내 러닝화</b><small>선택한 러닝화를 여기에 저장</small></span><span>›</span></div><div class="list-row"><span><b>관심 대회</b><small>접수 알림을 켠 대회</small></span><span>›</span></div><div class="list-row"><span><b>연결된 로그인</b><small>Google·Kakao는 실제 사업자 키 연결 전 비활성 상태</small></span><span>›</span></div></div></section><p class="notice">로그인이 비활성인 것은 오류가 아닙니다. OAuth 사업자 키와 개인정보 동의 절차를 연결하기 전, 개인정보를 안전하게 받지 않도록 막아둔 상태입니다.</p>`;
}

export function renderMy(state) {
  return html`<section class="switcher my-switcher">${switchButtons(['프로필', '기록'], state.myView, 'my')}</section>${state.myView === '기록' ? renderCalendar() : renderProfile()}`;
}
