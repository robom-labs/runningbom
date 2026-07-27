// 오늘 한 번만 하는 훈련이 안전하고, 실제로 실행까지 이어지는지 검사합니다.
//
// V3가 실패로 규정한 상태: "목록은 있지만 시작 버튼이 실행 엔진과 연결되지 않음".
// 이 파일은 그 상태로 돌아가면 실패합니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { programCoachCues } from '../domains/programs/coachSession';
import { MAX_SILENCE_SECONDS } from '../domains/programs/coachSession';
import { levelOrder, type UserLevelId } from '../domains/programs/level';
import {
  MAX_WORKOUT_SECONDS,
  availableWorkouts,
  buildWorkoutSession,
  suggestWorkouts,
  validateWorkoutLibrary,
  workoutCategoryLabels,
  workoutTemplates,
  workoutsByCategory,
} from '../domains/workouts/library';

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

const pickerSource = read('../app/screens/programs/WorkoutPicker.tsx');
const screenSource = read('../app/screens/programs/ProgramsScreen.tsx');

describe('오늘 한 번만 하는 훈련', () => {
  it('100개 이상 있고 전부 안전 규칙을 통과한다', () => {
    // 여기서 실패하면 위험한 훈련이 사용자에게 나갈 뻔한 것입니다.
    assert.deepEqual(validateWorkoutLibrary(), []);
    assert.ok(
      workoutTemplates.length >= 100,
      `훈련이 ${workoutTemplates.length}개뿐입니다`,
    );
  });

  it('훈련 ID가 겹치지 않는다', () => {
    // ID가 겹치면 기록이 서로 덮어씁니다.
    const ids = new Set(workoutTemplates.map((template) => template.id));
    assert.equal(ids.size, workoutTemplates.length);
  });

  it('모든 훈련에 제목·설명·갈래가 있다', () => {
    for (const template of workoutTemplates) {
      assert.ok(template.title.length > 0, `${template.id} 제목 없음`);
      assert.ok(template.description.length > 0, `${template.id} 설명 없음`);
      assert.ok(workoutCategoryLabels[template.category], `${template.id} 갈래 이름 없음`);
    }
  });

  it('화면에 보여 줄 말에 영어 전문용어를 쓰지 않는다', () => {
    for (const template of workoutTemplates) {
      const text = `${template.title} ${template.subtitle} ${template.description}`;
      for (const banned of ['RPE', '스트릭', 'threshold', 'tempo', 'interval', '인터벌']) {
        assert.ok(!text.includes(banned), `${template.id}에 '${banned}'가 있습니다`);
      }
    }
  });

  it('모든 갈래가 비어 있지 않다', () => {
    // 갈래만 만들어 놓고 안이 비면 화면에 빈칸이 생깁니다.
    const categories = new Set(workoutTemplates.map((template) => template.category));
    assert.equal(categories.size, Object.keys(workoutCategoryLabels).length);
  });

  it('준비 걷기와 마무리 걷기가 반드시 있다', () => {
    // 갑자기 뛰기 시작하고 갑자기 멈추면 다칩니다.
    for (const template of workoutTemplates) {
      const session = buildWorkoutSession(template);
      assert.equal(session.segments[0]?.role, 'warmup', `${template.id}: 준비 걷기 없음`);
      assert.equal(session.segments.at(-1)?.role, 'cooldown', `${template.id}: 마무리 걷기 없음`);
    }
  });

  it('한 훈련이 하루에 할 수 있는 길이다', () => {
    for (const template of workoutTemplates) {
      const session = buildWorkoutSession(template);
      assert.ok(
        session.totalSeconds <= MAX_WORKOUT_SECONDS,
        `${template.id}: ${Math.round(session.totalSeconds / 60)}분입니다`,
      );
    }
  });

  it('같은 훈련은 언제나 같은 결과를 낸다', () => {
    for (const template of workoutTemplates.slice(0, 10)) {
      assert.deepEqual(buildWorkoutSession(template), buildWorkoutSession(template));
    }
  });
});

describe('훈련이 실제로 음성까지 이어진다', () => {
  it('모든 훈련이 회차 음성을 만든다', () => {
    // 목록만 있고 소리가 안 나면 주머니에 넣고 할 수 없습니다.
    for (const template of workoutTemplates) {
      const cues = programCoachCues(buildWorkoutSession(template));
      assert.ok(cues.length > 0, `${template.id}: 음성이 없습니다`);
      assert.ok(cues.some((cue) => cue.kind === 'phase'), `${template.id}: 시작 안내가 없습니다`);
      assert.ok(
        cues.some((cue) => cue.kind === 'completion'),
        `${template.id}: 완료 안내가 없습니다`,
      );
    }
  });

  it('훈련 중에 오래 조용한 구간이 없다', () => {
    for (const template of workoutTemplates) {
      const cues = programCoachCues(buildWorkoutSession(template));
      let previous = 0;
      for (const cue of cues) {
        assert.ok(
          cue.offsetSeconds - previous <= MAX_SILENCE_SECONDS,
          `${template.id}: ${previous}초 ~ ${cue.offsetSeconds}초 사이가 조용합니다`,
        );
        previous = cue.offsetSeconds;
      }
    }
  });
});

describe('수준에 맞는 것만 보여 준다', () => {
  it('처음 쓰는 사람에게도 할 수 있는 훈련이 있다', () => {
    // 빈 화면을 주면 안 됩니다.
    assert.ok(availableWorkouts('L0_MOVE').length > 0);
  });

  it('처음 쓰는 사람에게 긴 훈련을 보여 주지 않는다', () => {
    const beginner = availableWorkouts('L0_MOVE');
    assert.ok(!beginner.some((template) => template.category === 'LONG'));
    assert.ok(!beginner.some((template) => template.category === 'CHECK'));
  });

  it('수준이 올라갈수록 할 수 있는 것이 줄지 않는다', () => {
    let previous = 0;
    for (const level of levelOrder as UserLevelId[]) {
      const count = availableWorkouts(level).length;
      assert.ok(count >= previous, `${level}에서 할 수 있는 훈련이 줄었습니다`);
      previous = count;
    }
  });

  it('한 번에 네 개까지만 먼저 보여 준다', () => {
    // 100개를 늘어놓으면 고르다 지쳐서 안 나갑니다.
    for (const level of ['L0_MOVE', 'L3_RUN_30', 'L5_10K'] as UserLevelId[]) {
      const picks = suggestWorkouts(level);
      assert.ok(picks.length > 0, `${level}에 추천이 없습니다`);
      assert.ok(picks.length <= 4);
      // 추천끼리 갈래가 겹치지 않아야 선택지가 다양해집니다.
      const categories = new Set(picks.map((template) => template.category));
      assert.equal(categories.size, picks.length);
    }
  });

  it('빈 갈래는 화면에 넘기지 않는다', () => {
    for (const group of workoutsByCategory('L0_MOVE')) {
      assert.ok(group.items.length > 0, `${group.category} 갈래가 비었습니다`);
    }
  });
});

describe('훈련 고르기가 화면에 연결돼 있다', () => {
  it('프로그램 화면이 훈련 고르기를 실제로 그린다', () => {
    assert.ok(screenSource.includes('<WorkoutPicker'), '훈련 고르기가 화면에 없습니다');
  });

  it('고른 훈련이 회차 실행으로 이어진다', () => {
    assert.ok(
      screenSource.includes('setRunning(buildWorkoutSession(template))'),
      '고른 훈련이 실행되지 않습니다',
    );
  });

  it('일회성 훈련을 계획 진도로 세지 않는다', () => {
    // 하지도 않은 회차가 끝난 것으로 표시되면 안 됩니다.
    assert.ok(
      screenSource.includes('runningIsWorkout ? false : markComplete'),
      '일회성 훈련이 계획 진도에 섞입니다',
    );
  });

  it('한 번에 전부 늘어놓지 않는다', () => {
    assert.ok(pickerSource.includes('suggestWorkouts'), '추천 규칙을 쓰지 않습니다');
    assert.ok(pickerSource.includes('openCategory'), '갈래별 펼치기가 없습니다');
  });

  it('얼마나 걸리는지 먼저 보여 준다', () => {
    // 사용자가 가장 먼저 궁금해하는 값입니다.
    assert.ok(pickerSource.includes('formatClock(session.totalSeconds)'));
  });
});
