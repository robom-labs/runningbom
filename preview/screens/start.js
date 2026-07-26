// 시작 화면은 목적별 세션, 시간, 단계별 코칭 예시를 보여 줍니다.
import { sessions } from '../data/sessions.js';
import { html } from '../ui/helpers.js';

export function renderStart(state) {
  const current = sessions[state.selectedSession];
  return html`
    <section class="screen-heading"><span class="eyebrow">COACH</span><h1>훈련 방식에 맞춰<br />안내가 달라져요.</h1><p>단순한 시간 알림이 아니라, 준비·전환·자세·마무리 시점에 맞춰 코칭합니다.</p></section>
    <section class="session-picker">${Object.entries(sessions).map(([key, item]) => `<button class="session-option ${state.selectedSession === key ? 'active' : ''}" data-session="${key}"><strong>${item.title}</strong><span>${item.subtitle}</span></button>`).join('')}</section>
    <section class="card coach-card"><div class="coach-head"><span class="pill">${current.tone}</span><span>${state.selectedMinutes}분</span></div><h2>${current.title}</h2><p>${current.cue}</p><div class="phase-list">${current.phases.map((phase, index) => `<div><b>${String(index + 1).padStart(2, '0')}</b><span>${phase}</span></div>`).join('')}</div><div class="duration-row"><button class="filter" data-minutes="25">25분</button><button class="filter active" data-minutes="${current.duration}">${current.duration}분</button><button class="filter" data-minutes="60">60분</button><button class="filter" data-action="direct-time">직접 입력</button></div><div class="coach-actions"><button class="secondary" data-action="voice-demo">코칭 예시 듣기</button><button class="primary" data-action="start-session">${state.selectedMinutes}분 코칭 시작</button></div></section>
    <section class="section"><div class="section-title"><h2>코치가 말하는 방식</h2><button class="text-button" data-action="coach-detail">안내 기준</button></div><div class="card stack"><div class="list-row"><span><b>시작 1분</b><small>호흡·시선·어깨 힘을 짧게 맞춰요.</small></span></div><div class="list-row"><span><b>훈련 전환</b><small>인터벌의 빠른 구간·회복 구간, 종료 10초 전을 분명히 알려요.</small></span></div><div class="list-row"><span><b>주행 중</b><small>45~90초 간격으로 자세·리듬·호흡을 한 문장씩 안내해요.</small></span></div><div class="list-row"><span><b>마무리</b><small>속도를 낮추고 다음 날까지 이어갈 여유를 남겨요.</small></span></div></div></section>
    <p class="notice">웹에서는 기기 음성으로 짧은 예시만 들을 수 있어요. 화면 잠금·이어폰 조작·장시간 백그라운드 코칭은 실제 Android 앱에서 확인해야 합니다.</p>`;
}
