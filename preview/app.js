// 미리보기 화면 상태와 사용자 상호작용, 기기 음성 예시를 연결합니다.
import { sessions, coachPreviewCues } from './data/sessions.js';
import { renderHome } from './screens/home.js';
import { renderExplore } from './screens/explore.js';
import { renderStart } from './screens/start.js';
import { renderCommunity } from './screens/community.js';
import { renderMy } from './screens/my.js';

const state = {
  tab: '홈',
  exploreView: '대회',
  distance: '전체',
  status: '전체',
  shoeGroup: '추천',
  shoeGoal: '전체',
  selectedSession: 'easy',
  selectedMinutes: sessions.easy.duration,
  myView: '프로필',
  communityView: '피드',
};

const screen = document.querySelector('#screen');
const tabbar = document.querySelector('.tabbar');

function showToast(message) {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 2800);
}

function render() {
  const templates = { 홈: renderHome, 탐색: renderExplore, 시작: renderStart, 커뮤니티: renderCommunity, 마이: renderMy };
  screen.innerHTML = templates[state.tab](state);
  tabbar.querySelectorAll('button').forEach((button) => button.classList.toggle('active', button.dataset.tab === state.tab));
}

function selectNaturalKoreanVoice() {
  const voices = window.speechSynthesis.getVoices();
  const rank = (voice) => {
    const name = voice.name.toLowerCase();
    let score = voice.lang.toLowerCase().startsWith('ko') ? 50 : 0;
    if (voice.localService) score += 20;
    if (/sunhi|sora|yuna|seoyeon|jiyoon|google.*한국|microsoft.*korean|samsung.*korean/.test(name)) score += 15;
    if (/compact|espeak|robot/.test(name)) score -= 100;
    return score;
  };
  return voices.filter((voice) => voice.lang.toLowerCase().startsWith('ko')).sort((a, b) => rank(b) - rank(a))[0];
}

function speakDemo() {
  if (!('speechSynthesis' in window)) {
    showToast('이 브라우저에서는 음성 예시를 지원하지 않아요.');
    return;
  }
  window.speechSynthesis.cancel();
  const cues = coachPreviewCues(state.selectedSession);
  const voice = selectNaturalKoreanVoice();
  let index = 0;
  const speakNext = () => {
    if (index >= cues.length) {
      showToast('코칭 예시가 끝났어요.');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(cues[index]);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.96;
    utterance.pitch = 1;
    if (voice) utterance.voice = voice;
    utterance.onend = () => window.setTimeout(speakNext, 650);
    window.speechSynthesis.speak(utterance);
    index += 1;
  };
  speakNext();
  showToast(voice ? `${voice.name} 음성으로 코칭 예시를 들려드려요.` : '기기의 기본 한국어 음성으로 코칭 예시를 들려드려요.');
}

const actionMessages = {
  details: '대회 상세와 공식 접수처는 기존 대회 화면에서 바로 확인할 수 있어요.',
  alert: '미리보기에서는 알림을 예약하지 않습니다.',
  'shoe-finder': '맞춤 추천은 거리·훈련 목적·예산·착화감 우선순위를 순서대로 묻는 화면으로 이어집니다.',
  'direct-time': '실제 앱에서는 10분부터 120분까지 직접 입력할 수 있어요.',
  'start-session': () => `${state.selectedMinutes}분 ${sessions[state.selectedSession].title} 코칭을 시작하는 흐름입니다. 미리보기에서는 실제 장시간 세션을 시작하지 않아요.`,
  'coach-detail': '안내 문구는 단계 전환과 45~90초 간격의 짧은 자세·리듬 큐로 구성합니다.',
  'profile-save': '미리보기에는 개인 프로필을 저장하지 않습니다.',
  'badge-all': '배지는 코칭·거리·스트릭·주간 달성·크루 활동처럼 서로 다른 기준으로 쌓이게 설계합니다.',
  'manual-record': '실제 앱에서는 직접 기록을 추가할 수 있고, 출처가 수동 기록임을 분명히 표시합니다.',
  'health-connect': 'Samsung Health 기록은 Android Health Connect 권한을 연결한 뒤에만 가져옵니다.',
  'garmin-connect': 'Garmin Connect 연동에는 Garmin Health API 파트너 승인과 사용자 동의가 필요합니다.',
  'nike-connect': 'Nike Run Club 기록은 공식 사용자 데이터 연동 가능 여부를 먼저 확인해야 합니다.',
};

document.addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target) return;

  if (target.dataset.tab) {
    state.tab = target.dataset.tab;
    if (target.dataset.myView) state.myView = target.dataset.myView;
    render();
    screen.focus({ preventScroll: true });
    return;
  }

  const kind = target.dataset.filterKind;
  if (kind === 'distance') state.distance = target.dataset.filter;
  else if (kind === 'status') state.status = target.dataset.filter;
  else if (kind === 'explore') state.exploreView = target.dataset.filter;
  else if (kind === 'shoe-group') state.shoeGroup = target.dataset.filter;
  else if (kind === 'shoe-goal') state.shoeGoal = target.dataset.filter;
  else if (kind === 'community') state.communityView = target.dataset.filter;
  else if (kind === 'my') state.myView = target.dataset.filter;
  else if (target.dataset.session) {
    state.selectedSession = target.dataset.session;
    state.selectedMinutes = sessions[state.selectedSession].duration;
  } else if (target.dataset.minutes) state.selectedMinutes = Number(target.dataset.minutes);
  else if (target.dataset.action) {
    if (target.dataset.action === 'voice-demo') speakDemo();
    else if (target.dataset.calendarDay) showToast(`${target.dataset.calendarDay}일 기록을 불러오는 구조입니다.`);
    else {
      const message = actionMessages[target.dataset.action];
      showToast(typeof message === 'function' ? message() : message || '이 기능은 미리보기에서 아직 연결하지 않았습니다.');
    }
    return;
  } else if (target.dataset.calendarDay) {
    showToast(`${target.dataset.calendarDay}일 기록을 불러오는 구조입니다.`);
    return;
  }
  render();
});

window.speechSynthesis?.addEventListener?.('voiceschanged', () => undefined);
render();
