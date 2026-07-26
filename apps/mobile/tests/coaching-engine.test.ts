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
import { legacyKindMap, resolveRunningType } from '../domains/coaching/sessionTypes';
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

  it('안내 밀도 단계는 간단 30~40초, 보통 18~25초, 자세히 10~15초 범위다', () => {
    assert.ok(guidanceIntervalSeconds.minimal >= 30 && guidanceIntervalSeconds.minimal <= 40);
    assert.ok(guidanceIntervalSeconds.standard >= 18 && guidanceIntervalSeconds.standard <= 25);
    assert.ok(guidanceIntervalSeconds.detailed >= 10 && guidanceIntervalSeconds.detailed <= 15);
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

  it('구글 한국어 음성 식별자로 남성·여성을 구분한다', () => {
    assert.equal(classifyVoiceGender(voices[0]), 'male');
    assert.equal(classifyVoiceGender(voices[2]), 'female');
    assert.equal(
      classifyVoiceGender({ identifier: 'com.apple.voice.compact.ko-KR.Yuna', language: 'ko-KR' }),
      'female',
    );
  });

  it('성별이 맞고 품질이 높은(network) 음성을 먼저 고른다', () => {
    assert.equal(selectVoiceIdentifier(voices, 'male'), 'ko-kr-x-kod-network');
    assert.equal(selectVoiceIdentifier(voices, 'female'), 'ko-kr-x-ism-network');
    const ranked = rankKoreanVoices(voices, 'male');
    assert.equal(ranked[0].gender, 'male');
    assert.ok(ranked[0].score > ranked[ranked.length - 1].score);
  });

  it('한국어 음성이 없으면 설치 안내를 정직하게 노출하고 선택을 비운다', () => {
    const availability = koreanVoiceAvailability([voices[4]]);
    assert.equal(availability.hasKorean, false);
    assert.match(availability.notice ?? '', /음성/);
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
