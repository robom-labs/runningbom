// 코칭, 스트릭, 리그와 러닝화의 비용 없는 핵심 규칙을 회귀 검증합니다.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  activityCountsAsCompetitiveRun,
  activityCountsAsMovement,
  type ActivityRecord,
} from '../domains/activities/types';
import { calculateStreak, streakInternals, unlockedBadges } from '../domains/badges/rules';
import {
  createCoachSession,
  cueSilenceRatio,
  cueScheduleForNative,
} from '../domains/coaching/model';
import {
  coachActivityId,
  coachCompletionRecord,
} from '../domains/coaching/runtime';
import {
  normalizeNaverUserInfo,
  naverUserInfoAdapterContract,
} from '../domains/identity/naverAdapter';
import { recommendShoes, shoes } from '../domains/shoes/catalog';
import { reactionKinds, weeklyLeagueScore } from '../domains/social/types';
import { publicPostRowSchema } from '../services/supabase/contracts';
import { secureAuthStorageKey } from '../services/supabase/storageKey';

function activity(
  completedAt: string,
  overrides: Partial<ActivityRecord> = {},
): ActivityRecord {
  return {
    id: completedAt,
    localUuid: 'local-test',
    kind: 'run',
    durationMinutes: 30,
    source: 'COACH_COMPLETED',
    completedAt,
    timezoneId: 'Asia/Seoul',
    ...overrides,
  };
}

describe('04시 기준 스트릭', () => {
  it('04시 전 활동은 전날 한 칸으로 계산한다', () => {
    assert.equal(
      streakInternals.dateKeyAtFourAm('2026-07-26T18:30:00.000Z'),
      '2026-07-26',
    );
  });

  it('같은 날 여러 활동은 한 칸이고 주간 러닝은 서로 다른 날만 센다', () => {
    const records = [
      activity('2026-07-20T22:00:00.000Z'),
      activity('2026-07-21T00:00:00.000Z'),
      activity('2026-07-22T00:00:00.000Z'),
      activity('2026-07-23T00:00:00.000Z'),
    ];
    const result = calculateStreak(records, new Date('2026-07-23T12:00:00.000Z'));
    assert.equal(result.movementDays.length, 3);
    assert.equal(result.weeklyRunDays, 3);
    assert.equal(result.weeklyGoalMet, true);
  });

  it('직접 입력은 개인 움직임에는 포함하지만 경쟁 점수에는 포함하지 않는다', () => {
    const manual = activity('2026-07-23T00:00:00.000Z', {
      source: 'SELF_LOGGED',
    });
    assert.equal(activityCountsAsMovement(manual), true);
    assert.equal(activityCountsAsCompetitiveRun(manual), false);
  });

  it('7일 연속마다 보호권을 최대 3개까지 만들고 하루 공백에만 사용한다', () => {
    const records = Array.from({ length: 15 }, (_, index) => {
      const date = new Date('2026-07-01T12:00:00.000Z');
      date.setUTCDate(date.getUTCDate() + index);
      return activity(date.toISOString());
    });
    records.push(activity('2026-07-17T12:00:00.000Z'));
    const result = calculateStreak(records, new Date('2026-07-17T15:00:00.000Z'));

    assert.deepEqual(result.protectedDays, ['2026-07-16']);
    assert.equal(result.current, 17);
    assert.equal(result.best, 17);
    assert.equal(result.freezeCredits, 1);
  });

  it('서버 권위 배지는 로컬 기록만으로 해제되지 않는다', () => {
    const records = [activity('2026-07-23T00:00:00.000Z')];
    const unlocked = unlockedBadges(
      records,
      calculateStreak(records, new Date('2026-07-23T12:00:00.000Z')),
    );
    assert.equal(unlocked.some((badge) => badge.id === 'first-run'), true);
    assert.equal(unlocked.some((badge) => badge.id === 'first-post'), false);
  });
});

describe('기기 음성 코칭 큐', () => {
  it('모든 음성 큐 간격을 90초 이상 유지하고 침묵 비율 75% 이상을 지킨다', () => {
    const session = createCoachSession('편안한 지속주', 60, 'detailed');
    for (let index = 1; index < session.cues.length; index += 1) {
      assert.ok(
        session.cues[index].offsetSeconds - session.cues[index - 1].offsetSeconds >= 90,
      );
    }
    assert.ok(cueSilenceRatio(session) >= 0.75);
  });

  it('최근 네 문장 안에서 동일 일반 문장을 반복하지 않는다', () => {
    const session = createCoachSession('걷고 달리기', 60, 'detailed');
    const spoken = session.cues.map((cue) => cue.text);
    for (let index = 0; index < spoken.length; index += 1) {
      assert.equal(spoken.slice(Math.max(0, index - 4), index).includes(spoken[index]), false);
    }
  });

  it('native 전송 형식에 파이프와 줄바꿈을 남기지 않는다', () => {
    const schedule = cueScheduleForNative(createCoachSession('걷기', 10));
    for (const line of schedule.split('\n')) {
      assert.equal(line.split('|').length, 2);
    }
  });

  it('복원된 완료 세션은 실행별 안정 ID와 실제 완료 시각으로 한 번만 기록한다', () => {
    const completion = coachCompletionRecord({
      sessionId: 'run-instance-1',
      countsAs: 'run',
      durationSeconds: 1_801,
      completedAtEpochMillis: Date.parse('2026-07-26T08:00:00.000Z'),
    });
    assert.deepEqual(completion, {
      id: 'coach:run-instance-1',
      kind: 'run',
      durationMinutes: 30,
      completedAt: '2026-07-26T08:00:00.000Z',
    });
    assert.equal(coachActivityId('run-instance-1'), completion?.id);
  });

  it('이전 버전처럼 활동 종류가 없는 완료 상태는 잘못 기록하지 않는다', () => {
    assert.equal(
      coachCompletionRecord({
        sessionId: 'legacy-definition-id',
        durationSeconds: 1_800,
      }),
      null,
    );
  });
});

describe('리그와 러닝화', () => {
  it('리그 점수는 하루 1회·주 5일과 30분 보너스 3회 상한이다', () => {
    assert.deepEqual(weeklyLeagueScore(9, 7), {
      optedIn: false,
      competitiveDays: 5,
      bonusRuns: 3,
      score: 8,
    });
  });

  it('응원 종류는 정확히 네 가지다', () => {
    assert.deepEqual(reactionKinds, ['CHEER', 'COOL', 'TOGETHER', 'CONSISTENT']);
  });

  it('러닝화는 여덟 브랜드의 공식 HTTPS 출처만 사용하고 가격을 추측하지 않는다', () => {
    assert.equal(new Set(shoes.map((shoe) => shoe.brand)).size, 8);
    for (const shoe of shoes) {
      assert.match(shoe.officialUrl, /^https:\/\//);
      assert.equal(shoe.priceKrw, null);
      assert.ok(shoe.officialFacts.length > 0);
    }
  });

  it('finder는 조건이 가까운 세 개 이하만 결정적으로 추천한다', () => {
    const result = recommendShoes({
      surface: 'road',
      distance: 'daily',
      priority: 'balanced',
      budget: 'open',
    });
    assert.equal(result.length, 3);
    assert.deepEqual(
      result.map((shoe) => shoe.id),
      recommendShoes({
        surface: 'road',
        distance: 'daily',
        priority: 'balanced',
        budget: 'open',
      }).map((shoe) => shoe.id),
    );
  });

  it('finder는 공식 가격이 확인된 경우에만 예산 조건을 순위에 반영한다', () => {
    const template = shoes[0];
    const values = [
      { ...template, id: 'within', model: 'Within', priceKrw: 140_000 },
      { ...template, id: 'over', model: 'Over', priceKrw: 210_000 },
      { ...template, id: 'unknown', model: 'Unknown', priceKrw: null },
    ];
    assert.deepEqual(
      recommendShoes(
        {
          surface: 'road',
          distance: 'daily',
          priority: 'balanced',
          budget: 'under-150',
        },
        values,
      ).map((shoe) => shoe.id),
      ['within', 'unknown', 'over'],
    );
  });
});

describe('소셜 공개 데이터와 세션 키', () => {
  it('공개 글은 UUID, 닉네임, 본문과 네 가지 반응 카운트를 검증한다', () => {
    const valid = publicPostRowSchema.safeParse({
      id: '3f1b77ce-7ae0-4ab3-90a8-f543ecaa4c17',
      author_id: '0d5f28f4-2833-4fa9-9340-0cf7be11744e',
      author_nickname: '러너봄',
      body: '오늘도 편안하게 달렸어요.',
      kind: 'COACH_COMPLETED',
      visibility: 'PUBLIC',
      created_at: '2026-07-26T07:30:00.000Z',
      edited_at: null,
      reaction_counts: { CHEER: 2, COOL: 1 },
      comment_count: 0,
    });
    assert.equal(valid.success, true);

    const invalid = publicPostRowSchema.safeParse({
      ...(valid.success ? valid.data : {}),
      id: 'not-a-uuid',
      reaction_counts: { UNKNOWN: 9 },
    });
    assert.equal(invalid.success, false);
  });

  it('Supabase 저장 키는 네임스페이스를 고정하고 안전하지 않은 문자를 제거한다', () => {
    assert.equal(
      secureAuthStorageKey('sb-project/auth token'),
      'runningbom.auth.sb-project_auth_token',
    );
  });
});

describe('Naver Custom OAuth2 UserInfo adapter', () => {
  it('공식 응답을 표준 필드로 바꾸고 이메일이 없으면 가짜 주소를 만들지 않는다', () => {
    assert.deepEqual(
      normalizeNaverUserInfo({
        resultcode: '00',
        message: 'success',
        response: {
          id: 'naver-user-1',
          nickname: '봄러너',
          profile_image: 'https://ssl.pstatic.net/example.png',
        },
      }),
      {
        sub: 'naver-user-1',
        name: '봄러너',
        picture: 'https://ssl.pstatic.net/example.png',
      },
    );
    assert.equal(naverUserInfoAdapterContract.syntheticEmailAllowed, false);
    assert.equal(naverUserInfoAdapterContract.serviceRoleSessionMintingAllowed, false);
  });

  it('필수 response.id가 없거나 실패 응답이면 거부한다', () => {
    assert.throws(() =>
      normalizeNaverUserInfo({
        resultcode: '00',
        response: { nickname: '식별자 없음' },
      }),
    );
    assert.throws(() =>
      normalizeNaverUserInfo({
        resultcode: '024',
        message: 'Authentication failed',
        response: { id: 'not-trusted' },
      }),
    );
  });
});
