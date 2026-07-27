// 시작을 누른 뒤 3·2·1을 세고 출발하는 카운트다운의 순수 규칙입니다.
// 화면에 크게 띄울 글자와 음성으로 셀 말을 한곳에서 만듭니다.

export type CountdownStep = {
  /** 남은 초입니다. 0이면 지금 출발합니다. */
  remainingSeconds: number;
  /** 화면 한가운데 크게 띄우는 글자입니다. */
  screenText: string;
  /** 음성으로 셀 말입니다. */
  voiceText: string;
  /** 스크린리더가 읽을 문장입니다. */
  spokenLabel: string;
};

export function countdownStep(remainingSeconds: number): CountdownStep {
  const remaining = Math.max(0, Math.floor(remainingSeconds));
  if (remaining === 0) {
    return {
      remainingSeconds: 0,
      screenText: '출발!',
      voiceText: '출발!',
      spokenLabel: '지금 출발해요',
    };
  }
  return {
    remainingSeconds: remaining,
    screenText: String(remaining),
    voiceText: String(remaining),
    spokenLabel: `${remaining}초 뒤에 시작해요`,
  };
}

/** 정해 둔 초부터 0까지의 모든 단계입니다. 테스트와 미리보기에 씁니다. */
export function countdownSteps(seconds: number): CountdownStep[] {
  const total = Math.max(0, Math.floor(seconds));
  const steps: CountdownStep[] = [];
  for (let remaining = total; remaining >= 0; remaining -= 1) {
    steps.push(countdownStep(remaining));
  }
  return steps;
}

/** 카운트다운 안내 문구입니다. */
export function countdownHelpText(seconds: number): string {
  return `시작을 누르면 ${seconds}초를 세고 달리기 시작해요. 그 사이에 휴대폰을 편한 곳에 두세요.`;
}
