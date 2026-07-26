// 러닝봄 vNext의 현재 작업 방향을 웹에서 빠르게 확인하는 임시 미리보기입니다.
const races = [
  { id: 'seoul', name: '2026 서울마라톤', area: '서울 · 광화문', distance: '풀/10K', days: 'D-2', status: '접수 예정' },
  { id: 'handuri', name: '한돈런', area: '경기 · 미사', distance: '10K', days: 'D-4', status: '접수 중' },
  { id: 'gyeongnam', name: '경남마라톤', area: '경남 · 창원', distance: '하프/10K', days: 'D-7', status: '접수 예정' },
  { id: 'trail', name: '설악 트레일런', area: '강원 · 속초', distance: '트레일', days: 'D-11', status: '접수 중' },
];

let tab = '홈';
let distance = '전체';
let status = '전체';

const screen = document.querySelector('#screen');
const tabbar = document.querySelector('.tabbar');

function showToast(message) {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 2200);
}

function html(strings, ...values) {
  return strings.reduce((result, part, index) => result + part + (values[index] ?? ''), '');
}

function renderHome() {
  return html`
    <section class="screen-heading"><span class="eyebrow">TODAY RUN</span><h1>오늘은 가볍게<br />리듬을 만들어요.</h1><p>기록보다 몸의 감각을 먼저 챙기는 러닝봄의 시작 화면입니다.</p></section>
    <section class="card today-card"><div class="card-top"><span class="pill">오늘의 코칭</span><span>30분</span></div><div class="today-copy"><strong>편안한 지속주</strong><span>호흡을 고르고, 발걸음은 가볍게.</span></div><div class="card-footer"><button class="secondary" data-action="change-run">변경</button><button class="primary" data-tab="시작">러닝 시작</button></div></section>
    <section class="stat-strip"><div class="stat"><b>🔥 12일</b><span>개인 스트릭</span></div><div class="stat"><b>2 / 3회</b><span>이번 주 러닝</span></div></section>
    <section class="section"><div class="section-title"><h2>다가오는 대회</h2><button class="text-button" data-tab="탐색">모두 보기</button></div><div class="card stack"><div class="list-row"><span><b>한돈런</b><small>경기 · 미사 · 10K</small></span><span class="mini-tag">접수 중</span></div><div class="list-row"><span><b>2026 서울마라톤</b><small>서울 · 풀/10K</small></span><span class="mini-tag">D-2</span></div></div></section>
    <section class="section"><div class="section-title"><h2>러너들의 오늘</h2><button class="text-button" data-tab="커뮤니티">커뮤니티</button></div><div class="feed-card"><b>초보 러너 민지</b><p>오늘 20분, 멈추지 않고 달렸어요.</p><div class="reactions"><button>응원해요 12</button><button>꾸준해요 4</button></div></div></section>`;
}

function filterButton(label, current, value, kind) {
  return `<button class="filter ${current === value ? 'active' : ''}" data-filter-kind="${kind}" data-filter="${value}">${label}</button>`;
}

function renderExplore() {
  const distanceRows = [
    ['전체', 'Full', 'Half'],
    ['10K', '5K', 'Trail'],
  ];
  const distanceLabels = { Full: '풀', Half: '하프', Trail: '트레일' };
  const filtered = races.filter((race) => {
    const selectedDistance = distanceLabels[distance] || distance;
    const distanceMatch = distance === '전체' || race.distance.includes(selectedDistance);
    const statusMatch = status === '전체' || race.status === status;
    return distanceMatch && statusMatch;
  });
  const cards = filtered.map((race) => html`<article class="race-card"><div class="race-day">${race.status === '접수 중' ? '접수<br />중' : race.days}</div><div class="race-body"><h2>${race.name}</h2><p>${race.area} · ${race.distance}</p><div class="race-actions"><button data-action="details">자세히 보기</button><button data-action="alert">알림</button></div></div></article>`).join('');
  return html`
    <section class="screen-heading"><span class="eyebrow">EXPLORE</span><h1>대회 하나를<br />한 장으로 봐요.</h1><p>종목 수가 아니라 실제 대회 기준으로 ${races.length}개를 보여줍니다.</p></section>
    <section class="switcher" aria-label="탐색 대상"><button class="filter active">대회</button><button class="filter" data-action="shoes">러닝화는 다음 작업에서 보강</button></section>
    <section class="card"><div class="section-title"><h2>대회 찾기</h2><span class="mini-tag">${filtered.length}개</span></div><div class="filter-line filters">${distanceRows[0].map((value) => filterButton(value, distance, value, 'distance')).join('')}</div><div class="filter-line filters">${distanceRows[1].map((value) => filterButton(value, distance, value, 'distance')).join('')}</div><div class="filter-line filters">${['전체', '접수 중', '접수 예정'].map((value) => filterButton(value, status, value, 'status')).join('')}</div></section>
    <section class="section stack">${cards || '<div class="card"><b>맞는 대회를 찾지 못했어요.</b><p>필터를 바꿔 보세요.</p></div>'}</section>
    <p class="notice">이 화면은 이전의 카드형 대회 탐색 구조를 복원한 미리보기입니다. 실제 공식 링크와 알림은 운영 앱에서 계속 검증합니다.</p>`;
}

function renderStart() {
  return html`
    <section class="screen-heading"><span class="eyebrow">START</span><h1>나에게 맞는 속도로<br />시작해요.</h1><p>세션을 단순하게 고르고, 안내는 필요한 순간에 이어집니다.</p></section>
    <section class="card coach-card"><span class="pill">오늘의 세션</span><h2>30분 · 편안한 지속주</h2><p>시작 전 호흡과 자세를 짧게 맞추고, 달리는 동안에는 리듬을 끊지 않도록 안내합니다.</p><div class="coach-steps"><div class="coach-step"><b>시작</b>호흡과 어깨</div><div class="coach-step"><b>중간</b>보폭과 리듬</div><div class="coach-step"><b>마무리</b>속도 낮추기</div></div><button class="primary" data-action="start-session">30분 코칭 시작</button></section>
    <section class="section"><div class="section-title"><h2>세션 변경</h2><button class="text-button" data-action="session-options">직접 입력</button></div><div class="card stack"><div class="list-row"><span><b>편안한 지속주</b><small>처음부터 끝까지 고른 리듬</small></span><span class="mini-tag">추천</span></div><div class="list-row"><span><b>걷고 달리기</b><small>부담 없이 다시 시작할 때</small></span></div><div class="list-row"><span><b>조금 빠르게</b><small>짧고 분명한 자극이 필요할 때</small></span></div></div></section>`;
}

function renderCommunity() {
  return html`
    <section class="screen-heading"><span class="eyebrow">COMMUNITY</span><h1>혼자 달려도<br />함께 이어져요.</h1><p>기록을 자랑하기보다, 다음 한 번을 응원하는 공간입니다.</p></section>
    <section class="switcher"><button class="filter active">피드</button><button class="filter">크루</button><button class="filter">리그</button></section>
    <section class="stack"><article class="feed-card"><b>러닝크루 성수</b><p>토요일 7시, 한강에서 5K 가볍게 함께 뛰어요.</p><div class="reactions"><button>응원해요 8</button><button>함께해요 3</button></div></article><article class="feed-card"><b>오늘의 러너</b><p>처음 3K를 완주했습니다. 다음 주에도 이어갈게요.</p><div class="reactions"><button>멋져요 22</button><button>꾸준해요 9</button></div></article></section>
    <p class="notice">게시·응원·크루 가입은 실제 앱에서 로그인 후 열립니다. 이 미리보기에는 개인 계정이나 글 작성 기능이 연결되지 않습니다.</p>`;
}

function renderMy() {
  return html`
    <section class="card profile-hero"><div class="avatar">JP</div><div><h1>준필 러너</h1><p>이번 주도 한 번 더 달려요.</p></div></section>
    <section class="stat-strip"><div class="stat"><b>꾸준러너</b><span>현재 티어</span></div><div class="stat"><b>배지 7개</b><span>대표 배지 1개 표시</span></div></section>
    <section class="section"><div class="section-title"><h2>내 기록</h2><button class="text-button" data-action="profile-save">프로필 저장</button></div><div class="card stack"><div class="list-row"><span><b>이번 주 러닝</b><small>서로 다른 2일 · 목표 3일</small></span><span class="mini-tag">2/3</span></div><div class="list-row"><span><b>내 러닝화</b><small>선택한 러닝화를 여기에 저장</small></span><span>›</span></div><div class="list-row"><span><b>관심 대회</b><small>접수 알림을 켠 대회</small></span><span>›</span></div><div class="list-row"><span><b>연결된 로그인</b><small>Google·Kakao는 실제 키 연결 전 비활성 상태</small></span><span>›</span></div></div></section>
    <p class="notice">연결된 로그인이 비활성인 것은 오류가 아니라 OAuth 사업자 키를 실제로 연결하기 전의 안전한 상태입니다.</p>`;
}

function render() {
  const templates = { 홈: renderHome, 탐색: renderExplore, 시작: renderStart, 커뮤니티: renderCommunity, 마이: renderMy };
  screen.innerHTML = templates[tab]();
  tabbar.querySelectorAll('button').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.dataset.tab) {
    tab = target.dataset.tab;
    render();
    screen.focus({ preventScroll: true });
    return;
  }
  if (target.dataset.filterKind === 'distance') {
    distance = target.dataset.filter;
    render();
    return;
  }
  if (target.dataset.filterKind === 'status') {
    status = target.dataset.filter;
    render();
    return;
  }
  const messages = {
    'change-run': '시작 화면에서 시간과 세션을 바꿀 수 있어요.',
    details: '상세 화면은 다음 구현 단계에서 실제 공식 데이터와 연결합니다.',
    alert: '미리보기에서는 알림을 예약하지 않습니다.',
    shoes: '러닝화는 한국 공식 판매처와 데이터 기준을 정리한 뒤 추가합니다.',
    'start-session': '미리보기에서는 음성 코칭을 시작하지 않습니다.',
    'session-options': '직접 시간 입력 화면은 네이티브 앱에서 구현 중입니다.',
    'profile-save': '미리보기에는 개인 데이터를 저장하지 않습니다.',
  };
  if (target.dataset.action) showToast(messages[target.dataset.action] || '이 기능은 미리보기에서 동작하지 않습니다.');
});

render();
