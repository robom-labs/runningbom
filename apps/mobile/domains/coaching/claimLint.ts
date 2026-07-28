// 코치가 **해서는 안 되는 말**을 잡아냅니다.
//
// 왜 이게 코드로 있어야 하는가:
//   문장은 앞으로 수천 개가 됩니다. 사람이 매번 다 읽을 수 없습니다.
//   그런데 딱 한 문장만 잘못 들어가도 앱 전체의 신뢰가 무너지는 종류가 있습니다.
//
//   - **본 적 없는 것을 봤다고 하는 말.** 우리는 카메라도 센서도 없습니다.
//     "지금 뒤꿈치로 착지했어"는 거짓말입니다. 사용자가 한 번 알아채면 나머지 말도 안 믿습니다.
//   - **모두에게 맞는 각도라고 단정하는 말.** "상체 15도"는 사람마다 다릅니다.
//   - **부상을 막아 준다는 말.** 우리는 의료기기가 아닙니다.
//   - **아파도 뛰라는 말.** 이건 사람을 다치게 합니다.
//
// 그래서 규칙을 테스트가 지키게 합니다. 사람의 성실함에 기대지 않습니다.
//
// 이 파일은 순수합니다.

export type ClaimIssueCode =
  /** 센서 없이 본 것처럼 말함 */
  | 'sensing-lie'
  /** 모두에게 맞는 각도·수치라고 단정 */
  | 'universal-angle'
  /** 착지 방식을 강요 */
  | 'forced-foot-strike'
  /** 180 같은 케이던스 정답 단정 */
  | 'cadence-dogma'
  /** 부상 예방·치료를 보장 */
  | 'medical-claim'
  /** 통증을 무시하라고 함 */
  | 'ignore-pain'
  /** 매운맛이 아닌데 욕설 */
  | 'profanity-outside-spicy'
  /** 실존 인물·캐릭터 흉내 */
  | 'impersonation';

export type ClaimIssue = {
  code: ClaimIssueCode;
  /** 걸린 부분입니다. */
  matched: string;
  /** 왜 안 되는지입니다. 고치는 사람이 바로 알아야 합니다. */
  why: string;
};

type Rule = {
  code: ClaimIssueCode;
  pattern: RegExp;
  why: string;
};

/**
 * 센서 없이 "봤다"고 하는 말입니다.
 *
 * 핵심은 **지금 사용자의 몸이 어떤 상태인지 단정하는 것**입니다.
 * 허용되는 말과의 차이는 이렇습니다.
 *   금지: `지금 어깨가 올라갔어`      ← 봤다고 주장
 *   허용: `어깨 올라갔으면 지금 내려`  ← 사용자가 확인하게 함
 */
const sensingRules: Rule[] = [
  {
    code: 'sensing-lie',
    pattern: /지금\s*(어깨|허리|무릎|발목|골반|상체|턱|손)[이가]?\s*[^.!?]{0,10}(올라갔|무너졌|들어갔|꺾였|기울었|벌어졌)/,
    why: '우리는 볼 수 없습니다. "…했으면 지금 …해"처럼 사용자가 확인하게 바꾸세요.',
  },
  {
    code: 'sensing-lie',
    pattern: /(뒤꿈치|앞꿈치|발뒤꿈치)로\s*착지(했|하고 있)/,
    why: '착지 방식을 볼 수 없습니다.',
  },
  {
    code: 'sensing-lie',
    pattern: /발아치[가는]?\s*(무너|내려앉)/,
    why: '발아치는 진단 영역이고, 우리는 보지 못합니다.',
  },
  {
    code: 'sensing-lie',
    pattern: /과내전|오버프로네이션/,
    why: '과내전은 진단입니다. 카메라 없이 말할 수 없습니다.',
  },
  {
    code: 'sensing-lie',
    pattern: /(왼쪽|오른쪽)\s*(무릎|발|어깨)[이가]\s*[^.!?]{0,8}(안으로|밖으로|들어갔|벌어졌)/,
    why: '좌우 정렬을 볼 수 없습니다.',
  },
];

/** 모두에게 맞는 각도는 없습니다. */
const angleRules: Rule[] = [
  {
    code: 'universal-angle',
    pattern: /(상체|몸통|허리)[를은는이가]?\s*\d+\s*도/,
    why: '상체 각도는 사람마다 다릅니다. "발목에서 아주 살짝" 같은 감각으로 바꾸세요.',
  },
  {
    code: 'universal-angle',
    pattern: /팔꿈치[를은는]?\s*(정확히\s*)?9?0\s*도/,
    why: '팔꿈치 각도를 모두에게 고정하지 않습니다.',
  },
  {
    code: 'universal-angle',
    pattern: /시선[을은는]?\s*\d+\s*도/,
    why: '시선 각도를 강제하면 시야가 좁아져 오히려 위험합니다.',
  },
];

const footStrikeRules: Rule[] = [
  {
    code: 'forced-foot-strike',
    pattern: /(뒤꿈치|앞꿈치|미드풋)[로으]로?\s*(착지해|착지하세요|디뎌|디디세요|바꿔)/,
    why: '착지 방식 교정은 강요하지 않습니다. 자기 자연 착지를 존중합니다.',
  },
];

const cadenceRules: Rule[] = [
  {
    code: 'cadence-dogma',
    pattern: /180\s*(이|가)?\s*(정답|이상적|최적|맞습니다|맞아)/,
    why: '180은 보편 정답이 아닙니다. 개인 기준에서 조금씩 실험하는 것으로 바꾸세요.',
  },
  {
    code: 'cadence-dogma',
    pattern: /(케이던스|보폭)[을는이가]?\s*[^.!?]{0,12}(부상[을이]?\s*(막|예방))/,
    why: '케이던스가 부상을 막는다고 보장할 수 없습니다.',
  },
];

const medicalRules: Rule[] = [
  {
    code: 'medical-claim',
    pattern: /(부상|무릎 통증|족저근막)[을이가]?\s*[^.!?]{0,14}(예방(합니다|해요|됩니다|돼요)|막아(줍니다|줘요|집니다))/,
    why: '우리는 의료기기가 아닙니다. 예방을 보장하지 않습니다.',
  },
  {
    code: 'medical-claim',
    pattern: /이 자세면\s*[^.!?]{0,10}안 다/,
    why: '자세만으로 부상을 막는다고 말하지 않습니다.',
  },
];

/**
 * 통증을 무시하라는 말입니다.
 *
 * 엄격한 코치·매운맛 코치라도 **이건 예외가 없습니다.**
 * "아프면 멈춰도 된다"가 언제나 가장 위에 있습니다.
 */
const painRules: Rule[] = [
  {
    code: 'ignore-pain',
    pattern: /아파도\s*(뛰|참|버텨|가)/,
    why: '통증을 참으라고 말하지 않습니다. 어떤 성격의 코치라도 예외가 없습니다.',
  },
  {
    code: 'ignore-pain',
    // 조사를 빠뜨리면 규칙이 조용히 새어 나갑니다. "통증은"이 실제로 빠져 있었습니다.
    pattern: /(고통|통증)[은는을를]?\s*(무시|참)/,
    why: '통증을 무시하라고 말하지 않습니다.',
  },
];

/** 실존 인물·캐릭터를 흉내 내면 저작권·퍼블리시티 문제가 됩니다. */
const impersonationRules: Rule[] = [
  {
    code: 'impersonation',
    pattern: /짱구|도라에몽|뽀로로|카카오프렌즈|펭수/,
    why: '실존 캐릭터를 흉내 내지 않습니다. 독창적인 코치 캐릭터만 씁니다.',
  },
];

const baseRules: Rule[] = [
  ...sensingRules,
  ...angleRules,
  ...footStrikeRules,
  ...cadenceRules,
  ...medicalRules,
  ...painRules,
  ...impersonationRules,
];

/**
 * 매운맛 코치에서만 허용되는 말입니다.
 *
 * **allowlist입니다.** 자유롭게 만들어 내지 않습니다.
 * 여기 없는 욕설은 어느 성격의 코치에서도 나오지 않습니다.
 */
export const spicyAllowlist = ['젠장', '아 씨', '아, 씨', '빡세', '정신 차려', '대충 하지 마'];

/** 어떤 성격의 코치에서도 절대 안 되는 말입니다. */
const alwaysForbiddenWords = [
  // 사람을 겨냥한 모욕
  '병신',
  '미친놈',
  '멍청이',
  '한심',
  // 외모·체중
  '뚱뚱',
  '살이나',
  // 위협·자해
  '죽어',
  '죽을',
  '뒤져',
];

export type LintContext = {
  /** 매운맛 코치인지입니다. 아니면 allowlist 단어도 안 됩니다. */
  spicy?: boolean;
};

/** 문장 하나를 검사합니다. */
export function lintCoachLine(line: string, context: LintContext = {}): ClaimIssue[] {
  const issues: ClaimIssue[] = [];
  const text = line.trim();

  for (const rule of baseRules) {
    const found = text.match(rule.pattern);
    if (found) issues.push({ code: rule.code, matched: found[0], why: rule.why });
  }

  for (const word of alwaysForbiddenWords) {
    if (text.includes(word)) {
      issues.push({
        code: 'profanity-outside-spicy',
        matched: word,
        why: '사람을 겨냥한 모욕·위협은 매운맛에서도 쓰지 않습니다.',
      });
    }
  }

  if (!context.spicy) {
    for (const word of spicyAllowlist) {
      if (text.includes(word)) {
        issues.push({
          code: 'profanity-outside-spicy',
          matched: word,
          why: '매운맛 코치에서만 쓸 수 있는 말입니다.',
        });
      }
    }
  }

  return issues;
}

/** 여러 문장을 한 번에 검사합니다. 테스트와 수집 스크립트가 씁니다. */
export function lintCoachLines(
  lines: string[],
  context: LintContext = {},
): { line: string; issues: ClaimIssue[] }[] {
  return lines
    .map((line) => ({ line, issues: lintCoachLine(line, context) }))
    .filter((entry) => entry.issues.length > 0);
}
