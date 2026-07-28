// 존댓말 문장을 반말로 옮깁니다. **순수합니다.**
//
// 왜 손으로 다시 쓰지 않고 규칙으로 옮기는가:
//   지금 코치 문장이 886개입니다. 반말 세트를 따로 손으로 쓰면 886개가 1772개가 되고,
//   그 뒤로 문장을 하나 고칠 때마다 두 군데를 고쳐야 합니다. 한쪽만 고치는 날이 반드시 옵니다.
//   그러면 존댓말 코치와 반말 코치가 서로 다른 말을 하게 됩니다.
//
// 왜 그런데도 "아무 문장이나 넣으면 되는 변환기"가 아닌가:
//   기계적으로 요를 떼면 한국어가 부서집니다. `구간이에요` → `구간이에` 같은 것들입니다.
//   그래서 **아는 어미만 옮기고, 모르는 어미는 옮기지 않고 신고합니다.**
//   테스트가 "신고된 문장 0개"를 지킵니다. 새 어미가 들어오면 그 자리에서 CI가 막습니다.
//   조용히 부서진 반말이 나가는 것보다, 빌드가 실패하는 편이 낫습니다.

/** 문장 끝을 바꾸는 규칙입니다. **긴 것부터** 봅니다. */
type EndingRule = { from: string; to: string };

const endingRules: EndingRule[] = [
  // 서술격 조사입니다. 요만 떼면 `구간이에`가 됩니다.
  { from: '아니에요', to: '아니야' },
  { from: '이에요', to: '이야' },
  { from: '예요', to: '야' },

  // 높임 명령입니다. 요만 떼면 `주세`가 됩니다.
  // 지금 문장 전체에 이 넷뿐입니다. 새 형태가 생기면 아래 fallback이 신고합니다.
  { from: '주세요', to: '줘' },
  { from: '두세요', to: '둬' },
  { from: '보세요', to: '봐' },
  { from: '고르세요', to: '골라' },
];

/**
 * 요만 떼면 되는 어미인지입니다.
 *
 * `볼게요`→`볼게`, `있어요`→`있어`, `좋아요`→`좋아`, `가져가요`→`가져가`,
 * `볼까요`→`볼까`, `가볍게요`→`가볍게` — 전부 맞는 반말이 됩니다.
 *
 * 위험한 것은 `~세요`와 서술격뿐이고, 그 둘은 이미 위에서 처리했습니다.
 * 남은 `~세요`가 여기까지 오면 그건 우리가 모르는 형태이므로 신고합니다.
 */
function plainDropYo(tail: string): string | undefined {
  if (!tail.endsWith('요')) return undefined;
  if (tail.endsWith('세요')) return undefined; // 모르는 높임 명령입니다. 손대지 않습니다.
  const dropped = tail.slice(0, -1);
  if (!dropped) return undefined;
  return dropped;
}

export type CasualResult = {
  text: string;
  /** 옮기지 못한 문장입니다. 비어 있어야 합니다. */
  unconverted: string[];
};

/** 문장 하나의 끝을 반말로 옮깁니다. 못 옮기면 undefined입니다. */
function convertSentence(sentence: string): string | undefined {
  const match = sentence.match(/^(.*?)([.!?…]*)$/s);
  if (!match) return undefined;
  const [, body, punctuation] = match;
  const trimmed = body.trimEnd();
  if (!trimmed) return undefined;

  for (const rule of endingRules) {
    if (trimmed.endsWith(rule.from)) {
      return `${trimmed.slice(0, -rule.from.length)}${rule.to}${punctuation}`;
    }
  }

  const dropped = plainDropYo(trimmed);
  if (dropped !== undefined) return `${dropped}${punctuation}`;

  // 애초에 존댓말이 아니었으면 그대로 둡니다(이미 반말인 문장).
  if (!trimmed.endsWith('요')) return `${trimmed}${punctuation}`;

  return undefined;
}

/**
 * 존댓말 대사를 반말로 옮깁니다.
 *
 * 한 큐에 문장이 여러 개 들어 있습니다. 문장마다 따로 옮깁니다.
 */
export function toCasual(text: string): CasualResult {
  const parts = text.split(/(?<=[.!?…])\s+/);
  const unconverted: string[] = [];
  const converted = parts.map((part) => {
    if (!part.trim()) return part;
    const next = convertSentence(part);
    if (next === undefined) {
      unconverted.push(part);
      return part;
    }
    return next;
  });
  return { text: converted.join(' '), unconverted };
}

/**
 * 말투에 맞는 문장을 돌려줍니다. **화면과 음성이 쓰는 입구입니다.**
 *
 * 옮기지 못한 문장이 있으면 **존댓말 원문을 그대로 씁니다.**
 * 부서진 반말을 들려주느니 존댓말이 낫습니다.
 * 그런 일이 실제로 생기지 않도록 테스트가 따로 막고 있습니다.
 */
export function speakAs(text: string, register: 'honorific' | 'casual'): string {
  if (register === 'honorific') return text;
  const result = toCasual(text);
  return result.unconverted.length > 0 ? text : result.text;
}
