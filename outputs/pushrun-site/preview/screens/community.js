// 커뮤니티 화면은 피드, 크루, 꾸준함 리그의 정보 구조를 검토합니다.
import { html, switchButtons } from '../ui/helpers.js';

export function renderCommunity(state) {
  const body = state.communityView === '피드'
    ? '<div class="stack"><article class="feed-card"><b>러닝크루 성수</b><p>토요일 7시, 한강에서 5K 가볍게 함께 뛰어요.</p><div class="reactions"><button>응원해요 8</button><button>함께해요 3</button><button>꾸준해요 5</button></div></article><article class="feed-card"><b>오늘의 러너</b><p>처음 3K를 완주했습니다. 다음 주에도 이어갈게요.</p><div class="reactions"><button>멋져요 22</button><button>꾸준해요 9</button></div></article></div>'
    : state.communityView === '크루'
      ? '<div class="card stack"><div class="list-row"><span><b>성수 이지런</b><small>일요일 07:00 · 한강 5K</small></span><span class="mini-tag">참석 8</span></div><div class="list-row"><span><b>주말 마라톤 준비반</b><small>토요일 08:00 · 장거리 페이스</small></span><span class="mini-tag">승인제</span></div></div>'
      : '<div class="card"><span class="pill">참여는 선택</span><h2>이번 주 꾸준함 리그</h2><p>하루 한 번, 주 5일 상한으로 일관된 움직임을 응원합니다. 세계 순위나 꼴찌 표시를 하지 않아요.</p><div class="stat-strip"><div class="stat"><b>2 / 3회</b><span>내 주간 러닝</span></div><div class="stat"><b>62점</b><span>이번 주 진행</span></div></div></div>';
  return html`<section class="screen-heading"><span class="eyebrow">COMMUNITY</span><h1>혼자 달려도<br />함께 이어져요.</h1><p>응원·크루 일정·꾸준함을 한곳에서 이어가는 공간입니다.</p></section><section class="switcher">${switchButtons(['피드', '크루', '리그'], state.communityView, 'community')}</section>${body}<p class="notice">이 미리보기의 글과 숫자는 화면 예시입니다. 실제 게시·댓글·크루 가입은 로그인과 신고·차단 체계가 연결된 뒤에만 열립니다.</p>`;
}
