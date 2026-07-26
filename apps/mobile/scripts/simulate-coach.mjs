// 러닝봄 코치를 실제로 돌려 보고(시뮬레이션) 말이 안 되는 발화를 찾아내는 스크립트입니다.
//
// 실행법 (apps/mobile 기준):
//   node --import ./node_modules/tsx/dist/loader.mjs scripts/simulate-coach.mjs
//     → 대표 5개 유형 × {보통, 자세히}를 한 번에 점검합니다(요약 + 경고만).
//   node --import ./node_modules/tsx/dist/loader.mjs scripts/simulate-coach.mjs --type interval --minutes 30
//     → 지정한 세션의 전체 발화 타임라인을 `분:초 [종류] 문장` 형태로 출력합니다.
//
// 옵션: --type <유형id 또는 이름> --minutes <분> --guidance <minimal|standard|detailed>
//       --timeline / --no-timeline (타임라인 출력 강제/생략), --all (전 유형 × 3밀도 점검)
// 이상 경고가 하나라도 있으면 종료 코드 1로 끝냅니다.

import { createCoachSession, cueDensityPerMinute } from '../domains/coaching/model.ts';
import {
  progressCuesByStage,
  progressStageFor,
  progressStageOfLine,
  progressStageRanges,
} from '../domains/coaching/cueLibrary.ts';
import {
  allowsEasyIntensityCues,
  allowsSpeedUpCues,
  resolveRunningType,
  runningTypes,
} from '../domains/coaching/sessionTypes.ts';

/** 대화 가능 강도(토크 테스트)를 전제로 하는 표현입니다. */
const EASY_INTENSITY_PATTERN =
  /대화가 가능|대화가 되는|대화할 수 있|이야기할 수 있|한 문장을 말할|이름과 오늘 날짜|말이 자꾸 끊긴|숨이 편한 정도가/u;
/** 속도를 올리라고 권하는 표현입니다. */
const SPEED_UP_PATTERN =
  /속도를 올리고|속도를 올릴 때|페이스를 올릴|템포만 살짝 올려|걸음 수를 조금 올릴|한 번만 더 밀어/u;
/** 이미 많이 왔다는 전제의 마무리성 표현입니다. */
const CLOSING_TONE_PATTERN =
  /마무리까지|끝이 보여|거의 다 왔|마지막까지|남은 건 차분히|마칠 시간|정리할 시간이 다가|얼마 남지 않|여기까지 (왔|온|의)|지금까지 온|끝까지 갈 수 있|오늘을 완성|이미 넘었|착실히 채우는/u;

const guidanceLabel = { minimal: '간단', standard: '보통', detailed: '자세히' };
const kindLabel = {
  safety: '안전',
  instruction: '안내',
  phase: '구간',
  encouragement: '응원',
  completion: '마무리',
  progress: '진행',
};

function clock(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function phaseAt(session, offset) {
  return (
    session.phases.find(
      (phase) => offset >= phase.startSeconds && offset < phase.endSeconds,
    ) ?? session.phases[session.phases.length - 1]
  );
}

/** 세션 하나의 요약 지표입니다. */
function summarize(session) {
  const texts = session.cues.map((cue) => cue.text);
  const counts = new Map();
  for (const text of texts) counts.set(text, (counts.get(text) ?? 0) + 1);
  let top = { text: '', count: 0 };
  for (const [text, count] of counts) {
    if (count > top.count) top = { text, count };
  }
  let maxSilence = session.cues.length > 0 ? session.cues[0].offsetSeconds : 0;
  for (let index = 1; index < session.cues.length; index += 1) {
    maxSilence = Math.max(
      maxSilence,
      session.cues[index].offsetSeconds - session.cues[index - 1].offsetSeconds,
    );
  }
  return {
    total: texts.length,
    density: cueDensityPerMinute(session),
    unique: new Set(texts).size,
    maxSilence,
    top,
  };
}

/** 상황과 어긋나는 발화를 찾아냅니다. */
export function detectAnomalies(session) {
  const type = resolveRunningType(session.typeId);
  const easyOk = allowsEasyIntensityCues(type);
  const speedUpOk = allowsSpeedUpCues(type);
  const totalSeconds = session.durationMinutes * 60;
  const warnings = [];

  for (const cue of session.cues) {
    const ratio = cue.offsetSeconds / totalSeconds;
    const at = `${clock(cue.offsetSeconds)}`;

    // 1) 경과 비율과 어긋나는 진행 문장
    const stage = progressStageOfLine(cue.text);
    if (stage && stage !== progressStageFor(ratio)) {
      const range = progressStageRanges[stage];
      warnings.push(
        `${at} 진행 문장 불일치: "${cue.text}" (${stage} 전용 ${range.from}~${range.to}, 실제 비율 ${ratio.toFixed(2)})`,
      );
    }

    // 2) 유형에 안 맞는 강도 문장
    if (!easyOk && EASY_INTENSITY_PATTERN.test(cue.text)) {
      warnings.push(
        `${at} 강도 불일치: "${cue.text}" (RPE ${type.rpe.min}~${type.rpe.max} 유형에 대화 가능 강도 전제)`,
      );
    }
    if (!speedUpOk && SPEED_UP_PATTERN.test(cue.text)) {
      warnings.push(`${at} 속도 권유 부적합: "${cue.text}" (${type.title}은 속도를 올리는 유형이 아님)`);
    }

    // 3) 워밍업 구간의 마무리성 문장
    const phaseIndex = cue.phaseIndex ?? phaseAt(session, cue.offsetSeconds).index;
    if (phaseIndex === 0 && cue.kind !== 'phase' && CLOSING_TONE_PATTERN.test(cue.text)) {
      warnings.push(`${at} 워밍업에 마무리성 문장: "${cue.text}"`);
    }
  }
  return warnings;
}

function printTimeline(session) {
  let phaseIndex = -1;
  for (const cue of session.cues) {
    const phase = phaseAt(session, cue.offsetSeconds);
    if (phase.index !== phaseIndex) {
      phaseIndex = phase.index;
      console.log(`  ── ${clock(phase.startSeconds)} 구간 ${phase.index + 1}: ${phase.label} (${phase.kind})`);
    }
    console.log(`  ${clock(cue.offsetSeconds)} [${kindLabel[cue.kind] ?? cue.kind}] ${cue.text}`);
  }
}

function runOne(typeId, minutes, guidance, { timeline }) {
  const session = createCoachSession(typeId, minutes, guidance);
  const summary = summarize(session);
  const warnings = detectAnomalies(session);
  const head = `${session.title}(${session.typeId}) ${session.durationMinutes}분 / ${guidanceLabel[guidance]}`;

  console.log(`\n=== ${head} ===`);
  if (timeline) printTimeline(session);
  console.log(
    `  요약: 총 ${summary.total}마디 · 분당 ${summary.density.toFixed(2)}마디 · 고유 ${summary.unique}문장 · ` +
      `최대 침묵 ${summary.maxSilence}초 · 최다 반복 ${summary.top.count}회 "${summary.top.text}"`,
  );
  if (warnings.length === 0) {
    console.log('  이상 없음');
  } else {
    for (const warning of warnings) console.log(`  [경고] ${warning}`);
  }
  return { head, summary, warnings };
}

function parseArgs(argv) {
  const options = { type: undefined, minutes: undefined, guidance: undefined, timeline: undefined, all: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--type') options.type = argv[++index];
    else if (arg === '--minutes') options.minutes = Number(argv[++index]);
    else if (arg === '--guidance') options.guidance = argv[++index];
    else if (arg === '--timeline') options.timeline = true;
    else if (arg === '--no-timeline') options.timeline = false;
    else if (arg === '--all') options.all = true;
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const results = [];

  // 진행 문장 구간별 개수를 먼저 보여 줍니다.
  console.log('진행 문장 구간별 개수:');
  for (const [stage, lines] of Object.entries(progressCuesByStage)) {
    const range = progressStageRanges[stage];
    console.log(`  ${stage.padEnd(6)} ${range.from}~${range.to}  ${lines.length}문장`);
  }

  if (options.type) {
    const type = resolveRunningType(options.type);
    const minutes = options.minutes ?? type.defaultMinutes;
    const guidance = options.guidance ?? 'standard';
    results.push(runOne(type.id, minutes, guidance, { timeline: options.timeline ?? true }));
  } else if (options.all) {
    for (const type of runningTypes) {
      for (const guidance of ['minimal', 'standard', 'detailed']) {
        results.push(
          runOne(type.id, options.minutes ?? 40, guidance, { timeline: options.timeline ?? false }),
        );
      }
    }
  } else {
    // 인자가 없으면 대표 5개 유형 × {보통, 자세히}를 한 번에 점검합니다.
    for (const typeId of ['easy', 'interval', 'tempo', 'long', 'recoveryWalk']) {
      for (const guidance of ['standard', 'detailed']) {
        results.push(
          runOne(typeId, options.minutes ?? 30, guidance, { timeline: options.timeline ?? false }),
        );
      }
    }
  }

  const totalWarnings = results.reduce((sum, result) => sum + result.warnings.length, 0);
  console.log('\n요약 표');
  console.log('세션'.padEnd(34) + '마디  분당   고유  최대침묵  최다반복  경고');
  for (const result of results) {
    console.log(
      result.head.padEnd(34) +
        String(result.summary.total).padStart(4) +
        result.summary.density.toFixed(2).padStart(7) +
        String(result.summary.unique).padStart(6) +
        `${result.summary.maxSilence}초`.padStart(9) +
        `${result.summary.top.count}회`.padStart(9) +
        String(result.warnings.length).padStart(6),
    );
  }
  console.log(`\n총 이상 경고: ${totalWarnings}건`);
  if (totalWarnings > 0) process.exitCode = 1;
}

main();
