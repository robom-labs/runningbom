// 훈련 목적별 코칭 문구와 단계 구조를 관리하는 미리보기 세션 데이터입니다.
export const sessions = {
  easy: { title: '베이스 런', subtitle: '고른 리듬으로 달리는 기본 훈련', duration: 40, cue: '대화 가능한 편안한 강도로, 어깨 힘을 빼고 리듬을 지켜요.', phases: ['5분 준비', '30분 편안한 러닝', '5분 천천히 마무리'], tone: '기본 코칭' },
  interval: { title: '인터벌', subtitle: '빠르게 달리고, 충분히 회복하는 반복 훈련', duration: 30, cue: '빠른 구간은 짧고 가볍게. 회복 구간에서는 숨을 정리해요.', phases: ['5분 준비', '4분 러닝 · 1분 회복 × 4', '5분 정리'], tone: '전환 코칭' },
  tempo: { title: '템포 런', subtitle: '지속 가능한 빠른 리듬을 찾는 훈련', duration: 35, cue: '한 번에 폭발하지 말고, 끝까지 유지할 수 있는 단단한 리듬을 찾아요.', phases: ['8분 준비', '18분 템포', '9분 천천히 마무리'], tone: '리듬 코칭' },
  long: { title: '롱 런', subtitle: '시간을 쌓는 여유 있는 장거리 훈련', duration: 60, cue: '처음 10분은 의도적으로 느리게. 남은 거리를 위해 힘을 아껴요.', phases: ['10분 준비', '45분 편안한 거리', '5분 정리'], tone: '지구력 코칭' },
  recovery: { title: '회복 러닝', subtitle: '피로를 쌓지 않고 몸을 깨우는 날', duration: 25, cue: '속도는 낮추고, 몸이 편한 범위 안에서만 가볍게 움직여요.', phases: ['5분 걷기', '15분 아주 편한 러닝', '5분 정리'], tone: '회복 코칭' },
};

export function coachPreviewCues(sessionKey) {
  if (sessionKey === 'interval') {
    return [
      '5분 준비를 마치고 첫 빠른 구간을 시작해요.',
      '어깨 힘을 빼고, 짧고 가볍게 리듬을 올려요.',
      '10초 뒤 회복 구간이에요. 속도를 낮추고 호흡을 정리해요.',
    ];
  }
  return [
    '시작할게요. 시선은 멀리 두고 어깨 힘을 가볍게 내려요.',
    sessions[sessionKey].cue,
    '이제 속도를 조금 낮추고 오늘의 러닝을 편안하게 마무리해요.',
  ];
}
