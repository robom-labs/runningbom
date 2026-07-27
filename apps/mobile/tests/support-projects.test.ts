// 보조 프로젝트와 오늘 제안이 안전하고 실제로 화면에 연결됐는지 검사합니다.
//
// 두 층 모두 지켜야 할 규칙: **훈련량을 늘리라고 밀어붙이지 않는다.**
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import type { ActivityRecord } from '../domains/activities/types';
import {
  activeProjects,
  projectCategoryLabels,
  projectProgress,
  supportProjects,
  validateProjects,
} from '../domains/projects/library';
import {
  emptyProjectStore,
  MAX_DONE_STEPS,
  parseProjectStore,
  toggleStep,
} from '../domains/projects/store';
import {
  activeDaysWithin,
  consecutiveRunDays,
  movedToday,
  suggestToday,
} from '../domains/today/suggest';
import { workoutTemplates } from '../domains/workouts/library';

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

const screenSource = read('../app/screens/programs/ProgramsScreen.tsx');
const boardSource = read('../app/screens/programs/ProjectBoard.tsx');
const serviceSource = read(
  '../modules/runningbom-coach/android/src/main/java/expo/modules/runningbomcoach/RunningbomCoachService.kt',
);

const NOW = new Date('2026-07-27T12:00:00Z');

function record(daysAgo: number, kind: ActivityRecord['kind']): ActivityRecord {
  return {
    id: `a-${daysAgo}-${kind}`,
    localUuid: `u-${daysAgo}-${kind}`,
    kind,
    durationMinutes: 30,
    source: 'COACH_COMPLETED',
    completedAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
    timezoneId: 'Asia/Seoul',
  };
}

describe('보조 프로젝트 목록', () => {
  it('20개 이상 있고 규칙을 지킨다', () => {
    assert.deepEqual(validateProjects(), []);
    assert.ok(supportProjects.length >= 20, `프로젝트가 ${supportProjects.length}개뿐입니다`);
  });

  it('모든 갈래가 비어 있지 않다', () => {
    const used = new Set(supportProjects.map((item) => item.category));
    assert.equal(used.size, Object.keys(projectCategoryLabels).length);
  });

  it('훈련량을 늘리라고 시키지 않는다', () => {
    // 보조 프로젝트는 달리기 밖의 일이거나, 달리는 동안 신경 쓰는 방법입니다.
    for (const item of supportProjects) {
      const text = `${item.title} ${item.description} ${item.steps.map((s) => `${s.title} ${s.detail}`).join(' ')}`;
      for (const banned of ['더 뛰', '거리를 늘려', '횟수를 늘려']) {
        assert.ok(!text.includes(banned), `${item.id}에 '${banned}'가 있습니다`);
      }
    }
  });

  it('아픈 곳을 진단하지 않고 병원으로 보낸다', () => {
    const pain = supportProjects.find((item) => item.id === 'body-pain');
    assert.ok(pain);
    const text = `${pain!.description} ${pain!.steps.map((s) => `${s.title} ${s.detail}`).join(' ')}`;
    assert.ok(text.includes('병원'), '아플 때 병원 안내가 없습니다');
  });

  it('화면에 보여 줄 말에 영어 전문용어를 쓰지 않는다', () => {
    for (const item of supportProjects) {
      const text = `${item.title} ${item.subtitle} ${item.description}`;
      for (const banned of ['RPE', '스트릭', 'interval', 'tempo']) {
        assert.ok(!text.includes(banned), `${item.id}에 '${banned}'가 있습니다`);
      }
    }
  });
});

describe('프로젝트 진행 계산', () => {
  it('한 단계도 안 했으면 0이다', () => {
    const result = projectProgress(supportProjects[0], []);
    assert.equal(result.ratio, 0);
    assert.equal(result.finished, false);
    assert.equal(result.nextStep?.id, supportProjects[0].steps[0].id);
  });

  it('다 하면 끝난 것으로 본다', () => {
    const item = supportProjects[0];
    const result = projectProgress(item, item.steps.map((step) => step.id));
    assert.equal(result.ratio, 1);
    assert.equal(result.finished, true);
    assert.equal(result.nextStep, undefined);
  });

  it('다른 프로젝트의 단계는 세지 않는다', () => {
    // 저장 값이 섞여도 진행률이 부풀지 않아야 합니다.
    const result = projectProgress(supportProjects[0], ['남의-단계-1', '남의-단계-2']);
    assert.equal(result.doneStepIds.length, 0);
  });

  it('하던 것을 먼저 보여 준다', () => {
    // 벌여 놓기만 하면 아무것도 안 끝납니다.
    const started = supportProjects[3];
    const shown = activeProjects([started.steps[0].id], 3);
    assert.equal(shown[0].project.id, started.id);
  });

  it('보여 주는 개수를 제한한다', () => {
    assert.ok(activeProjects([], 3).length <= 3);
  });
});

describe('프로젝트 저장', () => {
  it('깨진 값을 넣어도 빈 상태로 돌아간다', () => {
    assert.deepEqual(parseProjectStore(undefined), emptyProjectStore);
    assert.deepEqual(parseProjectStore({ doneStepIds: '아님' }), emptyProjectStore);
    assert.deepEqual(parseProjectStore({ doneStepIds: [1, null, ''] }), emptyProjectStore);
  });

  it('눌렀다 다시 누르면 되돌아간다', () => {
    const once = toggleStep(emptyProjectStore, 'form-basics-s1');
    assert.deepEqual(once.doneStepIds, ['form-basics-s1']);
    const twice = toggleStep(once, 'form-basics-s1');
    assert.deepEqual(twice.doneStepIds, []);
  });

  it('같은 단계를 두 번 세지 않는다', () => {
    const store = parseProjectStore({ doneStepIds: ['a', 'a', 'b'] });
    assert.deepEqual(store.doneStepIds, ['a', 'b']);
  });

  it('무한정 쌓이지 않는다', () => {
    const many = Array.from({ length: MAX_DONE_STEPS + 50 }, (_v, i) => `s${i}`);
    assert.equal(parseProjectStore({ doneStepIds: many }).doneStepIds.length, MAX_DONE_STEPS);
  });
});

describe('오늘 제안', () => {
  it('오늘 이미 했으면 더 하라고 하지 않는다', () => {
    const result = suggestToday({
      activities: [record(0, 'run')],
      now: NOW,
      hasPlanSessionLeft: true,
    });
    assert.equal(result.kind, 'rest');
  });

  it('사흘 연속 뛰었으면 쉬라고 한다', () => {
    const result = suggestToday({
      activities: [record(1, 'run'), record(2, 'run'), record(3, 'run')],
      now: NOW,
      hasPlanSessionLeft: true,
    });
    assert.equal(result.kind, 'rest');
    assert.ok(result.reason.includes('연속'));
  });

  it('이틀 연속 뛰었으면 걷기를 권한다', () => {
    const result = suggestToday({
      activities: [record(1, 'run'), record(2, 'run')],
      now: NOW,
      hasPlanSessionLeft: true,
    });
    assert.equal(result.kind, 'walk');
  });

  it('최근에 많이 했으면 가볍게 간다', () => {
    const busy = [1, 2, 3, 4, 5].map((d) => record(d, d % 2 === 0 ? 'walk' : 'run'));
    const result = suggestToday({ activities: busy, now: NOW, hasPlanSessionLeft: true });
    assert.notEqual(result.kind, 'planSession');
  });

  it('기록이 없으면 걷기부터 권한다', () => {
    const result = suggestToday({ activities: [], now: NOW, hasPlanSessionLeft: false });
    assert.equal(result.kind, 'walk');
    assert.ok(result.reason.includes('첫 기록'));
  });

  it('평소에는 계획의 다음 회차를 권한다', () => {
    const result = suggestToday({
      activities: [record(3, 'run')],
      now: NOW,
      hasPlanSessionLeft: true,
    });
    assert.equal(result.kind, 'planSession');
  });

  it('제안하는 훈련이 실제로 목록에 있다', () => {
    // 없는 훈련을 가리키면 시작 버튼이 안 뜹니다.
    const ids = new Set(workoutTemplates.map((item) => item.id));
    const cases = [
      { activities: [] as ActivityRecord[], hasPlanSessionLeft: false },
      { activities: [record(1, 'run'), record(2, 'run')], hasPlanSessionLeft: true },
      { activities: [1, 2, 3, 4, 5].map((d) => record(d, 'run')), hasPlanSessionLeft: true },
      { activities: [record(3, 'run')], hasPlanSessionLeft: false },
    ];
    for (const item of cases) {
      const result = suggestToday({ ...item, now: NOW });
      if (!result.workoutId) continue;
      assert.ok(ids.has(result.workoutId), `${result.workoutId} 훈련이 없습니다`);
    }
  });

  it('같은 입력이면 언제나 같은 결과가 나온다', () => {
    const input = { activities: [record(2, 'run')], now: NOW, hasPlanSessionLeft: true };
    assert.deepEqual(suggestToday(input), suggestToday(input));
  });

  it('날짜 계산이 정확하다', () => {
    assert.equal(consecutiveRunDays([record(1, 'run'), record(2, 'run')], NOW), 2);
    // 하루 건너뛰면 연속이 끊깁니다.
    assert.equal(consecutiveRunDays([record(1, 'run'), record(3, 'run')], NOW), 1);
    assert.equal(activeDaysWithin([record(0, 'run'), record(0, 'walk')], NOW, 7), 1);
    assert.equal(movedToday([record(0, 'walk')], NOW), true);
    assert.equal(movedToday([record(1, 'walk')], NOW), false);
  });
});

describe('화면에 연결돼 있다', () => {
  it('오늘 제안이 화면에 있다', () => {
    assert.ok(screenSource.includes('<TodayCard'), '오늘 제안이 화면에 없습니다');
  });

  it('보조 프로젝트가 화면에 있다', () => {
    assert.ok(screenSource.includes('<ProjectBoard'), '보조 프로젝트가 화면에 없습니다');
  });

  it('단계를 눌러 표시할 수 있다', () => {
    assert.ok(boardSource.includes('onToggleStep(step.id)'));
    assert.ok(screenSource.includes('projects.toggle(id)'));
  });

  it('다음에 할 단계 하나만 눈에 띄게 한다', () => {
    // 다섯 개가 똑같이 보이면 시작하기 어렵습니다.
    assert.ok(boardSource.includes('item.nextStep?.id === step.id'));
  });
});

describe('기기 서비스도 밀린 대사를 버리지 않는다', () => {
  it('한 마디만 읽고 나머지를 버리지 않는다', () => {
    // 예전에는 마지막 하나만 읽어, 같은 순간의 대사 세 개 중 한 마디만 들렸습니다.
    assert.ok(serviceSource.includes('MAX_SPOKEN_PER_TICK'), '여전히 하나만 읽습니다');
    assert.ok(serviceSource.includes('TextToSpeech.QUEUE_ADD'), '뒤 마디가 앞 마디를 지웁니다');
  });

  it('읽지 않은 대사도 자리는 끝까지 넘긴다', () => {
    // 안 그러면 지난 대사가 계속 되살아납니다.
    assert.ok(serviceSource.includes('nextCueIndex += 1'));
  });
});
