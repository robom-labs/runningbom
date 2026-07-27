// 옆에서 계속 말해 주는 연속 코칭 엔진의 밀도, 반복 방지, 구간 전환, 하위호환을 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createCoachSession,
  cueDensityPerMinute,
  cueScheduleForNative,
  currentPhase,
  guidanceIntervalSeconds,
  minimumCueDensityPerMinute,
  nextPhase,
  recentCues,
  runningTypes,
  sessionSummaries,
  type CoachSessionKind,
  type GuidanceLevel,
} from '../domains/coaching/model';
import { legacyKindMap, phaseGroups, resolveRunningType } from '../domains/coaching/sessionTypes';
import {
  categoryRotation,
  cueCategories,
  cuePoolFor,
  generalCues,
  minimumGeneralCueCount,
  minimumProgressStageCount,
  minimumTypeCueCount,
  notForWalkingCues,
  notForWarmupCues,
  phaseScripts,
  progressCuesByStage,
  progressLine,
  progressStageFor,
  progressStageOfLine,
  progressStageRanges,
  progressStages,
  requiresEasyIntensityCues,
  typeCueCount,
} from '../domains/coaching/cueLibrary';
import { allowsEasyIntensityCues, allowsSpeedUpCues } from '../domains/coaching/sessionTypes';
import { cooldownWindowFor, minimumCooldownWindow } from '../domains/coaching/model';
import {
  classifyVoiceGender,
  koreanVoiceAvailability,
  koreanVoices,
  normalizeVoicePreference,
  rankKoreanVoices,
  selectVoiceIdentifier,
  voiceTuning,
  type SpeechVoiceLike,
} from '../domains/coaching/voice';

const legacyKinds: CoachSessionKind[] = [
  '기본 지속주',
  '인터벌',
  '템포런',
  '롱런',
  '회복 걷기',
  '편안한 지속주',
  '걷고 달리기',
  '회복하며',
  '계속 달리기',
  '조금 빠르게',
  '러닝머신',
  '대회 전',
  '회복 루틴',
  '아침 깨우기',
  '걷기',
];

describe('연속 코칭 큐 밀도', () => {
  it('모든 유형에서 기본·자세히 안내는 분당 2.5개 이상 말한다', () => {
    for (const type of runningTypes) {
      for (const guidance of ['standard', 'detailed'] as GuidanceLevel[]) {
        const session = createCoachSession(type.id, 30, guidance);
        const density = cueDensityPerMinute(session);
        assert.ok(
          density >= minimumCueDensityPerMinute,
          `${type.id}/${guidance} 밀도가 낮습니다: ${density.toFixed(2)}`,
        );
      }
    }
  });

  it('간단 안내에서도 분당 2개 이상은 말한다', () => {
    for (const type of runningTypes) {
      const session = createCoachSession(type.id, 30, 'minimal');
      assert.ok(
        cueDensityPerMinute(session) >= 2,
        `${type.id} 간단 안내 밀도: ${cueDensityPerMinute(session).toFixed(2)}`,
      );
    }
  });

  it('짧은 세션과 긴 세션 모두 밀도 기준을 지킨다', () => {
    for (const minutes of [10, 20, 60, 120]) {
      const session = createCoachSession('이지런', minutes, 'standard');
      assert.ok(
        cueDensityPerMinute(session) >= minimumCueDensityPerMinute,
        `${minutes}분 밀도: ${cueDensityPerMinute(session).toFixed(2)}`,
      );
    }
  });

  it('안내 밀도 단계는 간단 22~30초, 보통 13~17초, 자세히 8~11초 범위다', () => {
    // "쉴 새 없이 옆에서 말해 주는 코치"가 기본이라 보통에서 분당 4마디가 나오게 촘촘히 유지합니다.
    assert.ok(guidanceIntervalSeconds.minimal >= 22 && guidanceIntervalSeconds.minimal <= 30);
    assert.ok(guidanceIntervalSeconds.standard >= 13 && guidanceIntervalSeconds.standard <= 17);
    assert.ok(guidanceIntervalSeconds.detailed >= 8 && guidanceIntervalSeconds.detailed <= 11);
  });

  it('세 안내 밀도 모두 분당 큐가 2.5개 이상이다', () => {
    for (const guidance of ['minimal', 'standard', 'detailed'] as const) {
      const session = createCoachSession('이지런', 30, guidance);
      assert.ok(
        cueDensityPerMinute(session) >= 2.5,
        `${guidance}: 분당 ${cueDensityPerMinute(session).toFixed(2)}개`,
      );
    }
  });

  it('기본 안내에서 큐 사이가 40초를 넘게 비지 않는다', () => {
    const session = createCoachSession('이지런', 60, 'standard');
    for (let index = 1; index < session.cues.length; index += 1) {
      const gap = session.cues[index].offsetSeconds - session.cues[index - 1].offsetSeconds;
      assert.ok(gap <= 40, `${gap}초 침묵이 발생했습니다`);
    }
  });
});

describe('반복 없는 멘트', () => {
  it('모든 유형에서 같은 문장이 연속으로 나오지 않는다', () => {
    for (const type of runningTypes) {
      for (const guidance of ['minimal', 'standard', 'detailed'] as GuidanceLevel[]) {
        const texts = createCoachSession(type.id, 60, guidance).cues.map((cue) => cue.text);
        for (let index = 2; index < texts.length; index += 1) {
          assert.ok(
            !(texts[index] === texts[index - 1] && texts[index] === texts[index - 2]),
            `${type.id}에서 3연속 반복: ${texts[index]}`,
          );
          assert.notEqual(texts[index], texts[index - 1]);
        }
      }
    }
  });

  it('최근 네 문장 안에서도 같은 문장을 되풀이하지 않는다', () => {
    const texts = createCoachSession('이지런', 60, 'detailed').cues.map((cue) => cue.text);
    for (let index = 0; index < texts.length; index += 1) {
      assert.equal(
        texts.slice(Math.max(0, index - 4), index).includes(texts[index]),
        false,
        `근접 반복: ${texts[index]}`,
      );
    }
  });

  it('유형마다 서로 다른 전용 멘트를 쓴다', () => {
    const interval = new Set(createCoachSession('인터벌', 40, 'standard').cues.map((cue) => cue.text));
    const long = new Set(createCoachSession('롱런', 40, 'standard').cues.map((cue) => cue.text));
    const tempo = new Set(createCoachSession('템포런', 40, 'standard').cues.map((cue) => cue.text));
    assert.ok([...interval].some((text) => !long.has(text) && !tempo.has(text)));
    assert.ok([...long].some((text) => !interval.has(text)));
    assert.ok([...tempo].some((text) => !interval.has(text)));
  });
});

describe('멘트 풀 규모', () => {
  it('카테고리별 공용 문장이 하한선을 넘는다', () => {
    for (const category of cueCategories) {
      assert.ok(
        generalCues[category].length >= minimumGeneralCueCount[category],
        `${category} 문장이 부족합니다: ${generalCues[category].length}`,
      );
    }
  });

  it('공용 멘트 풀 전체가 300문장 이상이고 중복이 없다', () => {
    const all = cueCategories.flatMap((category) => generalCues[category]);
    assert.ok(all.length >= 300, `공용 문장 총합: ${all.length}`);
    assert.equal(new Set(all).size, all.length, '중복된 공용 문장이 있습니다');
  });

  it('모든 문장이 음성으로 듣기 좋은 길이와 존댓말을 지킨다', () => {
    const all = [
      ...cueCategories.flatMap((category) => generalCues[category]),
      ...runningTypes.flatMap((type) =>
        cueCategories.flatMap((category) => cuePoolFor(type.id, category)),
      ),
      ...Object.values(phaseScripts).flatMap((script) => [
        ...script.pre,
        ...script.start,
        ...script.settle,
      ]),
    ];
    for (const line of all) {
      assert.ok(line.length >= 8 && line.length <= 48, `길이 이상: ${line} (${line.length}자)`);
      assert.match(line, /(요|다)[.?!]$/u, `존댓말·문장부호 이상: ${line}`);
    }
  });

  it('유형마다 전용 문장을 12개 이상 갖는다', () => {
    for (const type of runningTypes) {
      assert.ok(
        typeCueCount(type.id) >= minimumTypeCueCount,
        `${type.id} 전용 문장: ${typeCueCount(type.id)}`,
      );
    }
  });

  it('유형 전용 문장은 회전 카테고리 안에 있어 실제로 쓰인다', () => {
    for (const type of runningTypes) {
      const rotation = new Set(categoryRotation[type.id]);
      for (const category of cueCategories) {
        if (cuePoolFor(type.id, category).length > generalCues[category].length) {
          assert.ok(rotation.has(category), `${type.id}의 ${category} 전용 문장이 쓰이지 않아요`);
        }
      }
      // 여덟 카테고리를 모두 돌아야 결이 한쪽으로 몰리지 않습니다.
      assert.equal(rotation.size, cueCategories.length, `${type.id} 회전 카테고리 누락`);
    }
  });

  it('쿨다운 윈도는 카테고리 풀의 40퍼센트 또는 최소 15문장이다', () => {
    assert.equal(cooldownWindowFor(60), 24);
    assert.equal(cooldownWindowFor(30), minimumCooldownWindow);
    assert.equal(cooldownWindowFor(6), 5);
    for (const category of cueCategories) {
      const size = generalCues[category].length;
      assert.ok(cooldownWindowFor(size) >= Math.min(size - 1, minimumCooldownWindow));
    }
  });
});

describe('가장 빡센 조건에서의 반복 상한', () => {
  it('40분 자세히 세션에서 같은 문장이 3회를 넘지 않는다', () => {
    for (const type of runningTypes) {
      const texts = createCoachSession(type.id, 40, 'detailed').cues.map((cue) => cue.text);
      assert.ok(texts.length >= 160, `${type.id} 큐가 너무 적습니다: ${texts.length}`);
      const counts = new Map<string, number>();
      for (const text of texts) counts.set(text, (counts.get(text) ?? 0) + 1);
      for (const [text, count] of counts) {
        assert.ok(count <= 3, `${type.id}에서 ${count}회 반복: ${text}`);
      }
    }
  });

  it('60분 세션의 고유 문장 비율이 0.5 이상이다', () => {
    for (const guidance of ['standard', 'detailed'] as GuidanceLevel[]) {
      for (const type of runningTypes) {
        const texts = createCoachSession(type.id, 60, guidance).cues.map((cue) => cue.text);
        const ratio = new Set(texts).size / texts.length;
        assert.ok(
          ratio >= 0.5,
          `${type.id}/${guidance} 고유율: ${ratio.toFixed(2)} (${texts.length}마디)`,
        );
      }
    }
  });

  it('120분 롱런에서도 반복이 4회를 넘지 않는다', () => {
    const texts = createCoachSession('롱런', 120, 'standard').cues.map((cue) => cue.text);
    const counts = new Map<string, number>();
    for (const text of texts) counts.set(text, (counts.get(text) ?? 0) + 1);
    for (const [text, count] of counts) {
      assert.ok(count <= 4, `${count}회 반복: ${text}`);
    }
  });
});

describe('구간 전환 3단 안내', () => {
  it('인터벌은 예고, 전환, 전환 직후 순서로 큐를 만든다', () => {
    const session = createCoachSession('인터벌', 40, 'standard');
    const workPhase = session.phases.find((phase) => phase.kind === 'work');
    assert.ok(workPhase);

    const pre = session.cues.find(
      (cue) => cue.kind === 'phase' && cue.offsetSeconds === workPhase.startSeconds - 10,
    );
    const start = session.cues.find(
      (cue) => cue.kind === 'phase' && cue.offsetSeconds === workPhase.startSeconds,
    );
    const settle = session.cues.find(
      (cue) => cue.kind === 'phase' && cue.offsetSeconds === workPhase.startSeconds + 10,
    );

    assert.ok(pre, '10초 전 예고 큐가 없습니다');
    assert.ok(start, '전환 시점 큐가 없습니다');
    assert.ok(settle, '전환 직후 큐가 없습니다');
    assert.match(pre.text, /10초 뒤|곧/);
    assert.ok(pre.offsetSeconds < start.offsetSeconds);
    assert.ok(start.offsetSeconds < settle.offsetSeconds);
  });

  it('인터벌은 빠른 구간과 회복 구간을 번갈아 만든다', () => {
    const session = createCoachSession('인터벌', 40, 'standard');
    const kinds = session.phases.map((phase) => phase.kind);
    assert.ok(kinds.includes('work'));
    assert.ok(kinds.includes('recovery'));
    assert.ok(kinds.includes('warmup'));
    assert.ok(kinds.includes('cooldown'));
    const work = session.phases.filter((phase) => phase.kind === 'work');
    assert.ok(work.length >= 3);
  });

  it('경과 시간 기반 진행 안내를 넣는다', () => {
    const session = createCoachSession('이지런', 40, 'standard');
    const progress = session.cues.filter((cue) => cue.kind === 'progress');
    assert.ok(progress.length >= 4);
    assert.ok(progress.some((cue) => cue.text.includes('절반')));
    assert.ok(progress.every((cue) => /분/.test(cue.text)));
  });

  it('모든 구간이 러닝 중 화면에서 보여 줄 묶음 이름을 갖는다', () => {
    for (const type of runningTypes) {
      for (const phase of createCoachSession(type.id, 40, 'standard').phases) {
        assert.ok(
          ['워밍업', '본운동', '회복', '쿨다운'].includes(phaseGroups[phase.kind]),
          `${phase.kind} 묶음 이름 누락`,
        );
      }
    }
  });

  it('시작 안전 안내와 마무리 정리 안내가 항상 있다', () => {
    const session = createCoachSession('걷기', 10, 'minimal');
    assert.equal(session.cues[0].kind, 'safety');
    assert.equal(session.cues[session.cues.length - 1].kind, 'completion');
  });
});

describe('러닝 유형 기준과 하위호환', () => {
  it('구 CoachSessionKind 이름으로도 세션 생성에 성공한다', () => {
    for (const kind of legacyKinds) {
      const session = createCoachSession(kind, 30, 'standard');
      assert.equal(session.title, kind);
      assert.ok(session.cues.length > 0);
      assert.ok(session.summary.length > 0);
      assert.ok(cueDensityPerMinute(session) >= minimumCueDensityPerMinute);
    }
  });

  it('구 이름의 활동 종류(countsAs)가 그대로 유지된다', () => {
    assert.equal(createCoachSession('회복 루틴', 15).countsAs, 'recovery');
    assert.equal(createCoachSession('아침 깨우기', 15).countsAs, 'recovery');
    assert.equal(createCoachSession('회복 걷기', 20).countsAs, 'walk');
    assert.equal(createCoachSession('걷기', 20).countsAs, 'walk');
    assert.equal(createCoachSession('기본 지속주', 30).countsAs, 'run');
    assert.equal(createCoachSession('걷고 달리기', 30).countsAs, 'run');
  });

  it('구 이름은 매핑 테이블을 통해 새 유형으로 이어진다', () => {
    assert.equal(legacyKindMap['기본 지속주'], 'easy');
    assert.equal(legacyKindMap['걷고 달리기'], 'walkRun');
    assert.equal(legacyKindMap['회복하며'], 'recoveryWalk');
    assert.equal(legacyKindMap['조금 빠르게'], 'tempo');
    assert.equal(resolveRunningType('대회 전').id, 'taper');
    assert.equal(resolveRunningType('알 수 없는 값').id, 'easy');
  });

  it('모든 유형은 강도·RPE·추천·구성 기준을 갖는다', () => {
    for (const type of runningTypes) {
      assert.ok(type.intensityLabel.length > 0);
      assert.ok(type.rpe.min >= 1 && type.rpe.max <= 10 && type.rpe.min <= type.rpe.max);
      assert.ok(type.bestFor.length > 0);
      assert.ok(type.avoidIf.length > 0);
      assert.ok(type.structure.length >= 3);
      assert.ok(type.defaultMinutes >= type.minMinutes && type.defaultMinutes <= type.maxMinutes);
      assert.ok(sessionSummaries[type.title].length > 0);
    }
  });

  it('표준 러닝 유형을 모두 제공한다', () => {
    const ids = runningTypes.map((type) => type.id);
    for (const id of [
      'easy',
      'long',
      'tempo',
      'interval',
      'fartlek',
      'progression',
      'hill',
      'strides',
      'recoveryWalk',
      'walkRun',
      'treadmill',
      'taper',
    ]) {
      assert.ok(ids.includes(id as (typeof ids)[number]), `${id} 유형이 없습니다`);
    }
  });

  it('native 전송 형식에 파이프와 줄바꿈을 남기지 않는다', () => {
    const schedule = cueScheduleForNative(createCoachSession('인터벌', 30, 'detailed'));
    for (const line of schedule.split('\n')) {
      assert.equal(line.split('|').length, 2);
    }
  });
});

describe('발화와 상황의 정합', () => {
  const guidances: GuidanceLevel[] = ['minimal', 'standard', 'detailed'];

  it('진행 문장은 구간마다 6문장 이상이고 합집합이 공용 progress 풀과 같다', () => {
    for (const stage of progressStages) {
      assert.ok(
        progressCuesByStage[stage].length >= minimumProgressStageCount,
        `${stage} 진행 문장이 부족합니다: ${progressCuesByStage[stage].length}`,
      );
    }
    const union = progressStages.flatMap((stage) => progressCuesByStage[stage]);
    assert.deepEqual(generalCues.progress, union, 'progress 합집합이 어긋납니다');
    assert.equal(new Set(union).size, union.length, '진행 문장이 두 구간에 중복 배치됐습니다');
  });

  it('구간 경계가 0~0.25, 0.25~0.6, 0.6~0.85, 0.85~1로 이어진다', () => {
    assert.equal(progressStageFor(0), 'early');
    assert.equal(progressStageFor(0.24), 'early');
    assert.equal(progressStageFor(0.25), 'middle');
    assert.equal(progressStageFor(0.59), 'middle');
    assert.equal(progressStageFor(0.6), 'late');
    assert.equal(progressStageFor(0.84), 'late');
    assert.equal(progressStageFor(0.85), 'final');
    assert.equal(progressStageFor(1), 'final');
    for (const stage of progressStages) {
      assert.ok(progressStageRanges[stage].from < progressStageRanges[stage].to);
    }
  });

  it('모든 유형 × 3밀도에서 진행 문장이 경과 비율 구간과 일치한다', () => {
    for (const type of runningTypes) {
      for (const guidance of guidances) {
        for (const minutes of [15, 30, 60]) {
          const session = createCoachSession(type.id, minutes, guidance);
          const totalSeconds = session.durationMinutes * 60;
          for (const cue of session.cues) {
            const stage = progressStageOfLine(cue.text);
            if (!stage) continue;
            const ratio = cue.offsetSeconds / totalSeconds;
            assert.equal(
              stage,
              progressStageFor(ratio),
              `${type.id}/${guidance}/${minutes}분 ${cue.offsetSeconds}초(비율 ${ratio.toFixed(2)})에 ${stage} 문장: ${cue.text}`,
            );
          }
        }
      }
    }
  });

  it('남은 시간 안내도 경과 비율에 어긋나는 마무리 말투를 쓰지 않는다', () => {
    // 15분 세션의 5분 시점은 남은 10분이지만 아직 3분의 1이라 "끝이 보여요"가 될 수 없습니다.
    assert.equal(progressLine(300, 900).includes('끝이 보여'), false);
    assert.ok(progressLine(720, 900).includes('끝이 보여') || progressLine(720, 900).includes('마지막까지'));
    for (const totalMinutes of [10, 15, 20, 30, 45, 60, 90, 120]) {
      const total = totalMinutes * 60;
      for (let offset = 60; offset < total; offset += 30) {
        const line = progressLine(offset, total);
        const ratio = offset / total;
        if (/끝이 보여|마지막까지/.test(line)) {
          assert.ok(
            ratio >= progressStageRanges.late.from,
            `${totalMinutes}분 세션 비율 ${ratio.toFixed(2)}에서 마무리 말투: ${line}`,
          );
        }
      }
    }
  });

  it('대화 가능 강도 전제 문장은 고강도 유형에서 나오지 않는다', () => {
    const easyOnly = new Set(requiresEasyIntensityCues);
    for (const type of runningTypes) {
      if (allowsEasyIntensityCues(type)) continue;
      for (const guidance of guidances) {
        for (const cue of createCoachSession(type.id, 40, guidance).cues) {
          assert.equal(
            easyOnly.has(cue.text),
            false,
            `${type.id}(RPE ${type.rpe.min}~${type.rpe.max})에 대화 가능 강도 문장: ${cue.text}`,
          );
        }
      }
    }
    // 반대로 이지런 계열에서는 그대로 쓰여야 합니다.
    assert.ok(allowsEasyIntensityCues(resolveRunningType('이지런')));
    assert.ok(allowsEasyIntensityCues(resolveRunningType('리커버리 워크')));
    assert.equal(allowsEasyIntensityCues(resolveRunningType('인터벌')), false);
    assert.equal(allowsEasyIntensityCues(resolveRunningType('템포런')), false);
  });

  it('걷기·회복 유형에는 속도를 올리라는 문장이 나오지 않는다', () => {
    const runOnly = new Set(notForWalkingCues);
    for (const type of runningTypes) {
      if (allowsSpeedUpCues(type)) continue;
      for (const guidance of guidances) {
        for (const cue of createCoachSession(type.id, 40, guidance).cues) {
          assert.equal(runOnly.has(cue.text), false, `${type.id}에 속도 상승 문장: ${cue.text}`);
        }
      }
    }
    assert.equal(allowsSpeedUpCues(resolveRunningType('걷기')), false);
    assert.equal(allowsSpeedUpCues(resolveRunningType('회복 걷기')), false);
    assert.ok(allowsSpeedUpCues(resolveRunningType('인터벌')));
  });

  it('워밍업 구간에는 마무리성 문장이 없다', () => {
    const closing = new Set(notForWarmupCues);
    for (const type of runningTypes) {
      for (const guidance of guidances) {
        for (const minutes of [15, 30, 60]) {
          const session = createCoachSession(type.id, minutes, guidance);
          const warmup = session.phases[0];
          for (const cue of session.cues) {
            if (cue.kind === 'phase') continue;
            if (cue.offsetSeconds >= warmup.endSeconds) continue;
            assert.equal(
              closing.has(cue.text),
              false,
              `${type.id}/${guidance}/${minutes}분 워밍업(${cue.offsetSeconds}초)에 마무리성 문장: ${cue.text}`,
            );
          }
        }
      }
    }
  });
});

describe('세션 진행 조회', () => {
  it('경과 시간으로 현재 구간과 다음 구간, 최근 멘트를 찾는다', () => {
    const session = createCoachSession('인터벌', 40, 'standard');
    const phase = currentPhase(session, 700);
    assert.ok(phase);
    assert.ok(phase.startSeconds <= 700 && phase.endSeconds > 700);
    const upcoming = nextPhase(session, 700);
    assert.ok(upcoming && upcoming.startSeconds > 700);
    const recent = recentCues(session, 700, 3);
    assert.equal(recent.length, 3);
    assert.ok(recent[0].offsetSeconds >= recent[1].offsetSeconds);
  });
});

describe('기기 한국어 음성 선택', () => {
  const voices: SpeechVoiceLike[] = [
    { identifier: 'ko-kr-x-kod-network', name: 'ko-kr-x-kod-network', language: 'ko-KR' },
    { identifier: 'ko-kr-x-kod-local', name: 'ko-kr-x-kod-local', language: 'ko-KR' },
    { identifier: 'ko-kr-x-ism-network', name: 'ko-kr-x-ism-network', language: 'ko-KR' },
    { identifier: 'ko-kr-x-ism-local', name: 'ko-kr-x-ism-local', language: 'ko-KR' },
    { identifier: 'en-us-x-sfg-local', name: 'en-us-x-sfg-local', language: 'en-US' },
  ];

  it('ko-KR 음성만 추린다', () => {
    assert.equal(koreanVoices(voices).length, 4);
  });

  it('성별이 적혀 있을 때만 남성·여성을 말한다', () => {
    // ko-kr-x-kod처럼 성별 표시가 없는 식별자는 추측하지 않습니다.
    // 잘못 짚은 성별은 "고른 목소리와 다른 목소리가 나온다"는 어색함으로 이어집니다.
    assert.equal(classifyVoiceGender(voices[0]), 'unknown');
    assert.equal(
      classifyVoiceGender({ identifier: 'ko-kr-x-ism#female_1-local', language: 'ko-KR' }),
      'female',
    );
    assert.equal(
      classifyVoiceGender({ identifier: 'com.apple.voice.compact.ko-KR.Yuna', language: 'ko-KR' }),
      'female',
    );
  });

  it('가장 자연스러운 음성을 성별보다 먼저 고른다', () => {
    // 구글 인터넷 음성이 기기 안에서 가장 사람처럼 들립니다.
    assert.equal(selectVoiceIdentifier(voices, 'male'), 'ko-kr-x-ism-network');
    assert.equal(selectVoiceIdentifier(voices, 'female'), 'ko-kr-x-ism-network');
    const ranked = rankKoreanVoices(voices, 'male');
    assert.equal(ranked[0].tier, 'onlineNatural');
    assert.ok(ranked[0].score > ranked[ranked.length - 1].score);
  });

  it('한국어 음성이 없으면 설치 안내를 정직하게 노출하고 선택을 비운다', () => {
    const availability = koreanVoiceAvailability([voices[4]]);
    assert.equal(availability.hasKorean, false);
    assert.match(availability.notice ?? '', /목소리/);
    assert.equal(selectVoiceIdentifier([voices[4]], 'female'), undefined);
  });

  it('성별과 유형에 따라 pitch와 rate를 다르게 조정한다', () => {
    // 같은 유형이면 여성 음성이 조금 더 높게 들리도록 둡니다.
    assert.ok(voiceTuning('easy', 'female').pitch > voiceTuning('easy', 'male').pitch);
    // 같은 성별이면 강한 유형이 또렷하고 빠르게, 회복 유형이 낮고 느리게 읽힙니다.
    const maleInterval = voiceTuning('interval', 'male');
    const maleWalk = voiceTuning('recoveryWalk', 'male');
    assert.ok(maleInterval.pitch > maleWalk.pitch);
    assert.ok(maleInterval.rate > maleWalk.rate);
    // 자세히 안내는 촘촘하므로 간단 안내보다 살짝 빠르게 읽습니다.
    assert.ok(
      voiceTuning('easy', 'female', 'detailed').rate >
        voiceTuning('easy', 'female', 'minimal').rate,
    );
    for (const tuning of [maleInterval, maleWalk, voiceTuning('tempo', 'female', 'detailed', 1.2)]) {
      assert.ok(tuning.pitch >= 0.8 && tuning.pitch <= 1.3);
      assert.ok(tuning.rate >= 0.7 && tuning.rate <= 1.3);
    }
  });

  it('저장된 음성 선택값이 손상되면 기본값으로 되돌린다', () => {
    assert.deepEqual(normalizeVoicePreference({ gender: 'male' }), { gender: 'male' });
    assert.deepEqual(normalizeVoicePreference({ gender: 'robot' }), { gender: 'female' });
    assert.deepEqual(normalizeVoicePreference(null), { gender: 'female' });
  });
});
