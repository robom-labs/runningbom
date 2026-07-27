// 화면에 보여 주는 글과 소리 내어 읽어 주는 글을 분리합니다.
//
// 왜 필요한가:
// 화면에서는 "5:42 · 2.4km"가 읽기 편하지만, 그대로 읽으면 "오 사이 사십이" "이 점 사 케이엠"처럼
// 사람이 하지 않는 말이 나옵니다. 코치 목소리가 어색하게 들리는 큰 원인이 목소리 자체가 아니라
// "읽히는 글"에 있습니다. 그래서 원문은 손대지 않고, 말하기 직전에만 아래 함수로 바꿔서 읽힙니다.
//
// 여기 있는 함수는 전부 순수 함수입니다. 같은 글을 넣으면 언제나 같은 글이 나옵니다.

/** 한 문장이 이보다 길면 쉼표로 숨 쉴 자리를 하나 만들어 줍니다. */
export const longSentenceLength = 24;

/** 문장을 끊어 읽게 만들 수 있는 한국어 연결 어미들입니다. 긴 것부터 확인합니다. */
const breathMarkers = [
  '으면서 ',
  '면서 ',
  '으니까 ',
  '니까 ',
  '는데 ',
  '지만 ',
  '으면 ',
  '이면 ',
  '으려면 ',
  '려면 ',
  '어서 ',
  '아서 ',
  '다가 ',
  '하고 ',
  '이고 ',
  '고 ',
  '며 ',
  // "아프면", "결리면"처럼 조건을 말하는 자리입니다. 여기서 한 번 쉬면 훨씬 사람처럼 들립니다.
  '면 ',
];

/** 영어 약어는 그대로 읽으면 뭉개집니다. 한글 소리로 바꿔 읽힙니다. */
const abbreviations: Array<[RegExp, string]> = [
  [/(?<![A-Za-z])VO2\s*max(?![A-Za-z])/gi, '최대 산소 섭취량'],
  [/(?<![A-Za-z])GPS(?![A-Za-z])/gi, '지피에스'],
  [/(?<![A-Za-z])TTS(?![A-Za-z])/gi, '음성'],
  [/(?<![A-Za-z])BPM(?![A-Za-z])/gi, '분당 심박수'],
  [/(?<![A-Za-z])RPE(?![A-Za-z])/gi, '힘든 정도'],
  [/(?<![A-Za-z])LSD(?![A-Za-z])/g, '천천히 오래 달리기'],
  [/(?<![A-Za-z])PB(?![A-Za-z])/g, '개인 최고 기록'],
  [/(?<![A-Za-z])HR(?![A-Za-z])/g, '심박수'],
  [/(?<![A-Za-z])OK(?![A-Za-z])/g, '오케이'],
  [/(?<![A-Za-z])D\s*-\s*day(?![A-Za-z])/gi, '디데이'],
  [/(?<![A-Za-z])D\s*-\s*(\d+)(?![A-Za-z])/g, '디데이 $1일 전'],
];

/** 숫자에 붙는 단위입니다. 긴 표기(km/h)를 먼저 처리해야 짧은 표기(km)에 먹히지 않습니다. */
const units: Array<[RegExp, string]> = [
  [/(\d+(?:\.\d+)?)\s*km\s*\/\s*h(?![a-zA-Z])/gi, '시속 $1 킬로미터'],
  [/(?<![A-Za-z])(?:분|min)\s*\/\s*km(?![a-zA-Z])/gi, '킬로미터당'],
  [/(?<![A-Za-z])km\s*\/\s*h(?![a-zA-Z])/gi, '시속'],
  [/(\d+(?:\.\d+)?)\s*kcal(?![a-zA-Z])/gi, '$1 킬로칼로리'],
  [/(\d+(?:\.\d+)?)\s*km(?![a-zA-Z])/gi, '$1 킬로미터'],
  [/(?<![A-Za-z0-9])km(?![a-zA-Z])/gi, '킬로미터'],
  [/(\d+(?:\.\d+)?)\s*m(?![a-zA-Z])/g, '$1 미터'],
  [/(\d+(?:\.\d+)?)\s*K(?![a-zA-Z])/g, '$1킬로미터'],
];

/** 기호는 소리로 읽히지 않거나 엉뚱하게 읽힙니다. 말로 풀거나 지웁니다. */
const symbols: Array<[RegExp, string]> = [
  [/\s*[%％]/g, '퍼센트'],
  [/\s*[℃]|(\d)\s*°\s*C(?![a-zA-Z])/g, '$1도'],
  [/\s*&\s*/g, ' 그리고 '],
  [/\s*·\s*/g, ', '],
  [/\s*…\s*/g, ', '],
  [/[“”"‘’]/g, ''],
  [/[*#_]/g, ''],
];

// 그림 문자는 읽는 목소리가 통째로 건너뛰거나 이름을 그대로 읽어 버립니다.
const emojiPattern =
  /[\u{1F300}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu;

function stripEmoji(text: string): string {
  return text.replace(emojiPattern, ' ');
}

/**
 * 괄호는 읽을 때 어디서 끊어야 할지 알 수 없어 뭉개집니다.
 * "빠르게(전력은 아니에요)" 처럼 쓴 글을 "빠르게, 전력은 아니에요," 로 풀어 줍니다.
 */
export function unwrapParentheses(text: string): string {
  return text
    .replace(/\s*[（(]\s*([^)）]*?)\s*[)）]/g, (_match, inner: string) =>
      inner.trim().length > 0 ? `, ${inner.trim()},` : '',
    )
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/,\s*,/g, ',');
}

/**
 * `1:05:30`, `5:42` 같은 시계 표기를 말로 바꿉니다.
 * 초의 앞자리 0은 지웁니다("5분 05초"는 사람이 하지 않는 말입니다).
 */
export function expandClockTimes(text: string): string {
  return text
    .replace(
      /(?<![\d:])(\d{1,2}):([0-5]\d):([0-5]\d)(?![\d:])/g,
      (_m, h: string, m: string, s: string) =>
        `${Number(h)}시간 ${Number(m)}분 ${Number(s)}초`,
    )
    .replace(/(?<![\d:])(\d{1,3}):([0-5]\d)(?![\d:])/g, (_m, m: string, s: string) => {
      const seconds = Number(s);
      return seconds === 0 ? `${Number(m)}분` : `${Number(m)}분 ${seconds}초`;
    });
}

/** `2.4km`, `500m`, `km/h` 같은 단위를 말로 바꿉니다. */
export function expandUnits(text: string): string {
  return units.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
}

/** 영어 약어를 한글 소리로 바꿉니다. */
export function expandAbbreviations(text: string): string {
  return abbreviations.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    text,
  );
}

/** `5~6분`처럼 물결로 쓴 범위를 "5에서 6분"으로 읽습니다. */
export function expandRanges(text: string): string {
  return text.replace(/(\d)\s*[~〜∼]\s*(\d)/g, '$1에서 $2');
}

/** 소리로 읽히지 않는 기호를 말로 풀거나 지웁니다. */
export function expandSymbols(text: string): string {
  return symbols.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
}

/**
 * 느낌표는 읽는 목소리에서 부자연스럽게 튀어 오릅니다.
 * 연속 느낌표는 하나로 줄이고, 한 글에 느낌표는 최대 하나만 남깁니다.
 */
export function tameExclamations(text: string): string {
  const collapsed = text.replace(/!{2,}/g, '!').replace(/\?{2,}/g, '?');
  let seen = false;
  return collapsed.replace(/!/g, () => {
    if (seen) return '.';
    seen = true;
    return '!';
  });
}

function insertBreath(sentence: string): string {
  const core = sentence.replace(/[.!?]+$/, '');
  if (core.length < longSentenceLength) return sentence;
  if (core.includes(',')) return sentence;

  const middle = core.length / 2;
  let best: { index: number; distance: number } | undefined;
  for (const marker of breathMarkers) {
    let from = 0;
    for (;;) {
      const found = core.indexOf(marker, from);
      if (found < 0) break;
      from = found + 1;
      // 쉼표는 어미 바로 뒤(공백 앞)에 넣습니다.
      const index = found + marker.length - 1;
      if (index < core.length * 0.25 || index > core.length * 0.8) continue;
      const distance = Math.abs(index - middle);
      if (!best || distance < best.distance) best = { index, distance };
    }
  }
  if (!best) return sentence;
  return `${core.slice(0, best.index)},${core.slice(best.index)}${sentence.slice(core.length)}`;
}

/** 긴 문장에 숨 쉴 자리(쉼표)를 하나 만들어 줍니다. 짧은 문장은 그대로 둡니다. */
export function addBreathingPauses(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => insertBreath(sentence))
    .join(' ');
}

function tidy(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/,{2,}/g, ',')
    .replace(/^[,\s]+/, '')
    .trim();
}

/**
 * 화면에 쓴 글을 "읽어 줄 글"로 바꿉니다. 원문은 절대 바뀌지 않습니다.
 * 말하기 직전에 한 번만 부르면 됩니다.
 */
export function toSpeech(text: string): string {
  if (typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed.length === 0) return '';
  let result = stripEmoji(trimmed);
  result = unwrapParentheses(result);
  result = expandClockTimes(result);
  result = expandRanges(result);
  result = expandUnits(result);
  result = expandAbbreviations(result);
  result = expandSymbols(result);
  result = tameExclamations(result);
  result = tidy(result);
  result = addBreathingPauses(result);
  return tidy(result);
}

/** 여러 줄을 한 번에 바꿉니다. 빈 줄은 버립니다. */
export function toSpeechLines(lines: string[]): string[] {
  return lines.map((line) => toSpeech(line)).filter((line) => line.length > 0);
}
