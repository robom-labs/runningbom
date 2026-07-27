// 달리는 중 경험(자동 멈춤·칼로리·부상 안내·지금 기록 멘트·야간 모드·카운트다운)의 판정 규칙을 검증합니다.
// 화면을 렌더링하지 않고 순수 함수만 검사하므로 새 의존성 없이 돌아갑니다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  AUTO_PAUSE_HOLD_SECONDS,
  AUTO_RESUME_HOLD_SECONDS,
  autoPauseAnnouncements,
  autoPauseSpeedSummary,
  autoPauseStatus,
  autoPauseTunings,
  initialAutoPauseState,
  isAutoPauseLevel,
  speedKmhFromFixes,
  updateAutoPause,
  type AutoPauseLevel,
  type AutoPauseState,
} from '../domains/tracking/autoPause';
import type { LocationFix } from '../domains/tracking/filter';
import {
  caloriesFromDistance,
  estimateCalories,
  isValidWeightKg,
  KCAL_PER_KG_PER_KM,
  weightMissingNotice,
} from '../domains/activities/calories';
import {
  backToBackNotice,
  injuryNotices,
  longRunNotice,
  tenPercentHint,
  twoWeekJumpNotice,
} from '../domains/activities/injuryGuard';
import type { ActivityRecord } from '../domains/activities/types';
import {
  initialLiveStatsState,
  liveStatsSentence,
  nextLiveStatsCue,
  paceComparison,
  spokenPaceShort,
} from '../domains/coaching/liveStats';
import {
  countdownStep,
  countdownSteps,
} from '../app/screens/start/countdown';
import { isNightHour, shouldUseNightMode } from '../app/screens/start/nightMode';
import {
  defaultRunPreferences,
  parseWeightInput,
  sanitizeRunPreferences,
  RUN_PREFERENCES_KEY,
} from '../services/storage/runPreferences';

const root = join(import.meta.dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

/** 같은 속도가 몇 초 동안 이어질 때의 판정을 1초 간격으로 돌려 봅니다. */
function runSeconds(
  state: AutoPauseState,
  level: AutoPauseLevel,
  speedKmh: number | undefined,
  seconds: number,
  startMillis = 0,
): { state: AutoPauseState; events: string[] } {
  let current = state;
  const events: string[] = [];
  for (let index = 0; index <= seconds; index += 1) {
    const result = updateAutoPause(
      current,
      {
        timestampMillis: startMillis + index * 1_000,
        ...(speedKmh === undefined ? {} : { speedKmh }),
      },
      level,
    );
    current = result.state;
    if (result.event) events.push(result.event);
  }
  return { state: current, events };
}

describe('자동 멈춤 판정', () => {
  it('네 단계의 km/h 값이 화면에 보여 줄 수 있게 정해져 있다', () => {
    assert.equal(autoPauseTunings.off.pauseSpeedKmh, 0);
    assert.equal(autoPauseTunings.loose.pauseSpeedKmh, 2.5);
    assert.equal(autoPauseTunings.normal.pauseSpeedKmh, 4);
    assert.equal(autoPauseTunings.strict.pauseSpeedKmh, 6);
    for (const level of ['loose', 'normal', 'strict'] as const) {
      const tuning = autoPauseTunings[level];
      assert.ok(
        tuning.resumeSpeedKmh > tuning.pauseSpeedKmh,
        `${level}: 다시 시작 기준이 멈춤 기준보다 높아야 되돌이가 없습니다.`,
      );
    }
    assert.match(autoPauseSpeedSummary('normal'), /시속 4km/);
    assert.match(autoPauseSpeedSummary('normal'), /시속 6km/);
  });

  it('임계값 아래가 10초 이어져야 멈춘다', () => {
    const nine = runSeconds(initialAutoPauseState, 'normal', 1, AUTO_PAUSE_HOLD_SECONDS - 1);
    assert.deepEqual(nine.events, []);
    assert.equal(nine.state.phase, 'moving');

    const ten = runSeconds(initialAutoPauseState, 'normal', 1, AUTO_PAUSE_HOLD_SECONDS);
    assert.deepEqual(ten.events, ['paused']);
    assert.equal(ten.state.phase, 'paused');
  });

  it('느려졌다가 다시 빨라지면 세던 시간을 지우고 멈추지 않는다', () => {
    const slow = runSeconds(initialAutoPauseState, 'normal', 1, 8);
    const fast = runSeconds(slow.state, 'normal', 10, 1, 8_000);
    assert.equal(fast.state.belowSinceMillis, undefined);
    const slowAgain = runSeconds(fast.state, 'normal', 1, 9, 9_000);
    assert.deepEqual([...slow.events, ...fast.events, ...slowAgain.events], []);
  });

  it('걷는 정도로는 다시 시작하지 않고, 뛰어야 5초 만에 다시 시작한다', () => {
    const paused = runSeconds(initialAutoPauseState, 'strict', 0, AUTO_PAUSE_HOLD_SECONDS);
    assert.equal(paused.state.phase, 'paused');

    // 시속 5km(빠른 걷기)는 엄격하게 단계의 다시 시작 기준(9km/h)에 못 미칩니다.
    const walking = runSeconds(paused.state, 'strict', 5, 30, 10_000);
    assert.deepEqual(walking.events, []);
    assert.equal(walking.state.phase, 'paused');

    const running = runSeconds(walking.state, 'strict', 11, AUTO_RESUME_HOLD_SECONDS, 40_000);
    assert.deepEqual(running.events, ['resumed']);
    assert.equal(running.state.phase, 'moving');
  });

  it('GPS 신호가 없으면 멈추지 않고 "신호를 찾는 중"으로만 알린다', () => {
    const almost = runSeconds(initialAutoPauseState, 'normal', 1, AUTO_PAUSE_HOLD_SECONDS - 1);
    const lost = runSeconds(almost.state, 'normal', undefined, 60, 9_000);
    assert.deepEqual(lost.events, [], '신호가 없을 때 멈추면 안 됩니다.');
    assert.equal(lost.state.searching, true);
    assert.equal(lost.state.belowSinceMillis, undefined, '신호 없는 시간은 세지 않습니다.');

    const status = autoPauseStatus(lost.state, 'normal', 70_000);
    assert.equal(status?.label, '신호를 찾는 중');
  });

  it('끄기 단계에서는 어떤 속도에서도 멈추지 않는다', () => {
    const result = runSeconds(initialAutoPauseState, 'off', 0, 120);
    assert.deepEqual(result.events, []);
    assert.equal(result.state.phase, 'moving');
    assert.equal(autoPauseStatus(result.state, 'off', 1_000), undefined);
  });

  it('단말이 알려 준 속도를 먼저 쓰고, 없으면 좌표 사이 거리로 구한다', () => {
    const base: LocationFix = {
      latitudeDeg: 37.5663,
      longitudeDeg: 126.9779,
      timestampMillis: 0,
    };
    assert.equal(
      speedKmhFromFixes(undefined, { ...base, speedMetersPerSecond: 3 }),
      10.8,
    );
    // 단말이 -1(모름)을 주면 좌표로 계산합니다. 위도 1도는 약 111.19km입니다.
    const moved: LocationFix = {
      latitudeDeg: base.latitudeDeg + 30 / 111_195,
      longitudeDeg: base.longitudeDeg,
      speedMetersPerSecond: -1,
      timestampMillis: 10_000,
    };
    const derived = speedKmhFromFixes(base, moved);
    assert.ok(derived !== undefined && derived > 10 && derived < 12);
    // 비교할 직전 좌표가 없고 단말 속도도 없으면 지어내지 않습니다.
    assert.equal(speedKmhFromFixes(undefined, base), undefined);
  });

  it('멈춤·다시 시작을 화면과 음성 양쪽 문구로 갖는다', () => {
    for (const event of ['paused', 'resumed'] as const) {
      assert.ok(autoPauseAnnouncements[event].screen.length > 0);
      assert.ok(autoPauseAnnouncements[event].voice.length > 0);
    }
    assert.equal(isAutoPauseLevel('normal'), true);
    assert.equal(isAutoPauseLevel('보통'), false);
  });
});

describe('칼로리', () => {
  it('거리와 몸무게만으로 계산한다', () => {
    assert.equal(KCAL_PER_KG_PER_KM, 1.036);
    assert.equal(Math.round(caloriesFromDistance(60, 5)), 311);

    const estimate = estimateCalories({ weightKg: 60, distanceKm: 5, minutes: 30 });
    assert.equal(estimate.available, true);
    if (!estimate.available) return;
    assert.equal(estimate.kcal, 311);
    assert.equal(estimate.basis, 'distance');
    assert.equal(estimate.approximate, false);
  });

  it('같은 거리라면 빠르게 달려도 총 칼로리가 같고, 그 사실을 한 줄로 알린다', () => {
    const slow = estimateCalories({ weightKg: 70, distanceKm: 10, minutes: 70 });
    const fast = estimateCalories({ weightKg: 70, distanceKm: 10, minutes: 45 });
    assert.equal(slow.available && fast.available && slow.kcal === fast.kcal, true);
    if (!slow.available) return;
    assert.match(slow.note, /빨리 달리든 천천히 달리든/);
  });

  it('몸무게가 없으면 추측하지 않고 안내만 한다', () => {
    const estimate = estimateCalories({ distanceKm: 5, minutes: 30 });
    assert.equal(estimate.available, false);
    if (estimate.available) return;
    assert.equal(estimate.reason, 'no-weight');
    assert.equal(estimate.message, weightMissingNotice);
    assert.equal(weightMissingNotice, '체중을 입력하면 칼로리를 계산해 드려요.');
  });

  it('거리가 없으면 시간으로 대략만 계산하고 "대략"이라고 밝힌다', () => {
    const estimate = estimateCalories({ weightKg: 60, minutes: 30 });
    assert.equal(estimate.available, true);
    if (!estimate.available) return;
    assert.equal(estimate.basis, 'time');
    assert.equal(estimate.approximate, true);
    assert.match(estimate.label, /^약 /);
    assert.match(estimate.note, /대략/);
  });

  it('사람이 넣을 수 없는 몸무게는 받지 않는다', () => {
    assert.equal(isValidWeightKg(0), false);
    assert.equal(isValidWeightKg(500), false);
    assert.equal(isValidWeightKg(62.5), true);
    assert.equal(parseWeightInput('62.5kg'), 62.5);
    assert.equal(parseWeightInput('세 자리'), undefined);
  });
});

function activity(
  completedAt: string,
  overrides: Partial<ActivityRecord> = {},
): ActivityRecord {
  return {
    id: completedAt,
    localUuid: `local-${completedAt}`,
    kind: 'run',
    durationMinutes: 30,
    source: 'COACH_COMPLETED',
    completedAt,
    timezoneId: 'Asia/Seoul',
    ...overrides,
  };
}

/** 기준일(2026년 7월 29일 수요일 한국 시간 정오)에서 며칠 전 기록을 만듭니다. */
function daysAgo(days: number, distanceKm: number): ActivityRecord {
  const date = new Date(Date.UTC(2026, 6, 29, 3, 0, 0));
  date.setUTCDate(date.getUTCDate() - days);
  return activity(date.toISOString(), { distanceKm });
}

const now = new Date(Date.UTC(2026, 6, 29, 3, 0, 0));

describe('부상 경고', () => {
  it('2주 거리가 30% 넘게 늘면 알리고, 그 아래면 알리지 않는다', () => {
    const older = Array.from({ length: 4 }, (_, index) => daysAgo(15 + index * 2, 5));
    const jumped = [...older, ...Array.from({ length: 4 }, (_, index) => daysAgo(1 + index * 2, 8))];
    const notice = twoWeekJumpNotice({ activities: jumped, now });
    assert.equal(notice?.id, 'two-week-jump');
    assert.equal(notice?.tone, 'caution');
    assert.match(notice?.body ?? '', /30%/);

    const steady = [...older, ...Array.from({ length: 4 }, (_, index) => daysAgo(1 + index * 2, 5))];
    assert.equal(twoWeekJumpNotice({ activities: steady, now }), undefined);
  });

  it('비교할 앞 2주 거리가 너무 짧으면 알리지 않는다', () => {
    const activities = [daysAgo(20, 1), daysAgo(3, 6)];
    assert.equal(twoWeekJumpNotice({ activities, now }), undefined);
  });

  it('오늘 거리가 최근 30일 최장의 110%를 넘으면 주의, 130%를 넘으면 강하게 알린다', () => {
    const activities = [daysAgo(10, 8), daysAgo(20, 6)];

    assert.equal(longRunNotice({ activities, now, plannedDistanceKm: 8.5 }), undefined);

    const caution = longRunNotice({ activities, now, plannedDistanceKm: 9.2 });
    assert.equal(caution?.id, 'long-run-110');
    assert.equal(caution?.tone, 'caution');

    const strong = longRunNotice({ activities, now, plannedDistanceKm: 11 });
    assert.equal(strong?.id, 'long-run-130');
    assert.equal(strong?.tone, 'strong');
    assert.match(strong?.body ?? '', /64%/);
  });

  it('달린 거리를 모르면 긴 거리 안내를 만들지 않는다', () => {
    assert.equal(longRunNotice({ activities: [daysAgo(10, 8)], now }), undefined);
  });

  it('막 시작한 사람이 이틀 이어 달리면 부드럽게 안내한다', () => {
    const activities = [daysAgo(1, 4), daysAgo(3, 4)];
    const notice = backToBackNotice({ activities, now });
    assert.equal(notice?.id, 'back-to-back');
    assert.equal(notice?.tone, 'gentle');

    // 1년 넘게 달려 온 사람에게는 이 안내를 하지 않습니다.
    const veteran = backToBackNotice({
      activities,
      now,
      runningStartedAt: '2024-01-01T00:00:00.000Z',
    });
    assert.equal(veteran, undefined);
  });

  it('10% 규칙은 경고가 아니라 참고 안내로만 쓴다', () => {
    // 지난주(7월 20~26일) 10km, 이번 주(7월 27~29일) 13km입니다.
    const activities = [daysAgo(8, 6), daysAgo(9, 4), daysAgo(1, 13)];
    const hint = tenPercentHint({ activities, now });
    assert.equal(hint?.id, 'ten-percent');
    assert.equal(hint?.tone, 'gentle');
    assert.match(hint?.body ?? '', /참고로만/);
    assert.match(hint?.evidence ?? '', /우연 수준/);
  });

  it('근거가 강한 안내가 있으면 10% 참고 안내는 붙이지 않는다', () => {
    const older = Array.from({ length: 4 }, (_, index) => daysAgo(15 + index * 2, 5));
    const jumped = [...older, ...Array.from({ length: 4 }, (_, index) => daysAgo(1 + index * 2, 9))];
    const notices = injuryNotices({ activities: jumped, now });
    assert.ok(notices.length > 0);
    assert.equal(notices.some((notice) => notice.id === 'ten-percent'), false);
  });

  it('겁주는 말이나 어려운 말을 쓰지 않는다', () => {
    const activities = [daysAgo(10, 8), daysAgo(1, 4), daysAgo(3, 4)];
    const notices = injuryNotices({ activities, now, plannedDistanceKm: 12 });
    assert.ok(notices.length > 0);
    for (const notice of notices) {
      for (const banned of ['부상', '위험', '경고', 'RPE', '볼륨', '세션', '스플릿']) {
        assert.equal(
          notice.title.includes(banned) || notice.body.includes(banned),
          false,
          `${notice.id}에 "${banned}"가 들어 있습니다.`,
        );
      }
      assert.ok(notice.evidence.length > 0, `${notice.id}에 근거 한 줄이 없습니다.`);
    }
  });
});

describe('실측 수치를 넣은 코치 멘트', () => {
  it('평균과 직전 구간을 견줘 해석을 붙인다', () => {
    const text = liveStatsSentence(
      {
        distanceMeters: 2_400,
        elapsedSeconds: 823,
        averagePaceSecondsPerKm: 342,
        lastSplitPaceSecondsPerKm: 334,
        completedSplits: 2,
      },
      'distance',
    );
    assert.equal(text, '2km 지났어요. 평균 5분 42초, 방금 1km는 8초 빨랐어요.');
  });

  it('첫 1km는 비교 문장을 만들지 않는다', () => {
    const text = liveStatsSentence(
      {
        distanceMeters: 1_000,
        elapsedSeconds: 350,
        averagePaceSecondsPerKm: 350,
        lastSplitPaceSecondsPerKm: 350,
        completedSplits: 1,
      },
      'distance',
    );
    assert.equal(text, '1km 지났어요. 평균 5분 50초예요.');
    assert.equal(
      paceComparison({
        distanceMeters: 1_000,
        elapsedSeconds: 350,
        averagePaceSecondsPerKm: 350,
        lastSplitPaceSecondsPerKm: 350,
        completedSplits: 1,
      }),
      undefined,
    );
  });

  it('차이가 3초 안쪽이면 "일정하다"고 말한다', () => {
    const text = liveStatsSentence(
      {
        distanceMeters: 3_000,
        elapsedSeconds: 1_020,
        averagePaceSecondsPerKm: 340,
        lastSplitPaceSecondsPerKm: 338,
        completedSplits: 3,
      },
      'distance',
    );
    assert.equal(text, '3km 지났어요. 평균 5분 40초, 페이스가 아주 일정해요.');
  });

  it('평균을 아직 모르면 숫자를 지어내지 않는다', () => {
    const text = liveStatsSentence(
      { distanceMeters: 1_200, elapsedSeconds: 400, completedSplits: 1 },
      'distance',
    );
    assert.equal(text, '1km 지났어요.');
    assert.equal(spokenPaceShort(300), '5분');
    assert.equal(spokenPaceShort(342), '5분 42초');
  });

  it('1km 안내와 시간 안내가 겹치면 1km 안내만 하고 시간은 다음으로 미룬다', () => {
    const options = { mode: 'both' as const, intervalMinutes: 5 };
    const first = nextLiveStatsCue(
      initialLiveStatsState,
      {
        distanceMeters: 1_000,
        elapsedSeconds: 320,
        averagePaceSecondsPerKm: 320,
        completedSplits: 1,
      },
      options,
    );
    assert.equal(first?.trigger, 'distance');
    assert.equal(first?.state.lastSpokenSeconds, 320);

    // 같은 자리에서 다시 물어도 되풀이하지 않습니다.
    const repeat = nextLiveStatsCue(
      first?.state ?? initialLiveStatsState,
      {
        distanceMeters: 1_100,
        elapsedSeconds: 360,
        averagePaceSecondsPerKm: 325,
        completedSplits: 1,
      },
      options,
    );
    assert.equal(repeat, undefined);

    // 정해 둔 간격이 지나면 시간 안내가 나옵니다.
    const timed = nextLiveStatsCue(
      first?.state ?? initialLiveStatsState,
      {
        distanceMeters: 1_800,
        elapsedSeconds: 620,
        averagePaceSecondsPerKm: 330,
        completedSplits: 1,
      },
      options,
    );
    assert.equal(timed?.trigger, 'time');
    assert.match(timed?.text ?? '', /^10분 달렸어요\./);
  });

  it('끄기와 구간마다 설정을 지킨다', () => {
    const input = {
      distanceMeters: 2_000,
      elapsedSeconds: 700,
      averagePaceSecondsPerKm: 350,
      completedSplits: 2,
    };
    assert.equal(
      nextLiveStatsCue(initialLiveStatsState, input, { mode: 'off', intervalMinutes: 5 }),
      undefined,
    );
    assert.equal(
      nextLiveStatsCue(initialLiveStatsState, input, { mode: 'time', intervalMinutes: 5 })?.trigger,
      'time',
    );
    assert.equal(
      nextLiveStatsCue(initialLiveStatsState, input, { mode: 'distance', intervalMinutes: 5 })
        ?.trigger,
      'distance',
    );
  });
});

describe('야간 모드와 시작 카운트다운', () => {
  it('해가 진 뒤에만 자동으로 어두워진다', () => {
    // 7월: 해는 19시 48분쯤 집니다.
    assert.equal(isNightHour(7, 18), false);
    assert.equal(isNightHour(7, 21), true);
    // 12월: 해가 17시 12분쯤 집니다.
    assert.equal(isNightHour(12, 18), true);
    assert.equal(isNightHour(12, 12), false);
    // 이른 새벽도 밤으로 봅니다.
    assert.equal(isNightHour(7, 4), true);
  });

  it('끄기와 항상 어둡게는 시각과 상관없이 그대로 따른다', () => {
    const noon = new Date(2026, 6, 27, 12, 0, 0);
    const night = new Date(2026, 6, 27, 22, 0, 0);
    assert.equal(shouldUseNightMode('off', night), false);
    assert.equal(shouldUseNightMode('on', noon), true);
    assert.equal(shouldUseNightMode('auto', noon), false);
    assert.equal(shouldUseNightMode('auto', night), true);
  });

  it('3·2·1을 세고 출발이라고 말한다', () => {
    assert.deepEqual(
      countdownSteps(3).map((step) => step.voiceText),
      ['3', '2', '1', '출발!'],
    );
    assert.equal(countdownStep(0).screenText, '출발!');
    assert.equal(countdownStep(5).spokenLabel, '5초 뒤에 시작해요');
  });
});

describe('달리는 중 설정 저장', () => {
  it('새 저장 키만 쓰고 기존 설정 키는 건드리지 않는다', () => {
    assert.equal(RUN_PREFERENCES_KEY, 'runningbom:run-experience:v1');
    assert.equal(source('services/storage/preferences.ts').includes('run-experience'), false);
    assert.match(source('services/storage/preferences.ts'), /runningbom:vnext:preferences:v1/);
  });

  it('이상한 값이 들어와도 쓸 수 있는 기본값으로 되돌린다', () => {
    const sanitized = sanitizeRunPreferences({
      autoPause: '아주 엄격' as never,
      weightKg: 900,
      liveStats: 'loud' as never,
      liveStatsMinutes: 7,
      nightMode: 'dark' as never,
      countdownSeconds: 99,
    });
    assert.deepEqual(sanitized, defaultRunPreferences);
    assert.equal(sanitized.weightKg, undefined, '이상한 몸무게는 저장하지 않습니다.');
  });

  it('고른 값은 그대로 지킨다', () => {
    const sanitized = sanitizeRunPreferences({
      autoPause: 'strict',
      weightKg: 58.4,
      liveStats: 'distance',
      liveStatsMinutes: 10,
      nightMode: 'on',
      countdownSeconds: 10,
    });
    assert.equal(sanitized.autoPause, 'strict');
    assert.equal(sanitized.weightKg, 58.4);
    assert.equal(sanitized.liveStats, 'distance');
    assert.equal(sanitized.countdownSeconds, 10);
  });
});

describe('스토어 안전선과 쉬운 말', () => {
  it('새로 만든 파일이 위치·센서 권한이나 백그라운드 위치를 늘리지 않는다', () => {
    for (const file of [
      'domains/tracking/autoPause.ts',
      'domains/tracking/useRunTracking.ts',
      'domains/activities/calories.ts',
      'domains/activities/injuryGuard.ts',
      'domains/coaching/liveStats.ts',
      'services/storage/runPreferences.ts',
      'app/screens/start/StartScreen.tsx',
      'app/screens/settings/RunSettingsSection.tsx',
    ]) {
      const text = source(file);
      assert.equal(text.includes('BACKGROUND_LOCATION'), false, `${file}에 백그라운드 위치`);
      assert.equal(text.includes('requestBackgroundPermissionsAsync'), false, `${file}`);
      assert.equal(/expo-sensors|react-native-sensors|Pedometer|Accelerometer/.test(text), false, `${file}에 새 센서 의존성`);
      assert.ok(/[가-힣]/.test(text.split(/\r?\n/, 1)[0] ?? ''), `${file} 첫 줄 한국어 주석 누락`);
    }
  });

  it('화면에 어려운 말이나 금지한 낱말을 쓰지 않는다', () => {
    for (const file of [
      'domains/tracking/autoPause.ts',
      'domains/activities/calories.ts',
      'domains/activities/injuryGuard.ts',
      'domains/coaching/liveStats.ts',
      'app/screens/settings/RunSettingsSection.tsx',
      'app/screens/start/countdown.ts',
      'app/screens/start/nightMode.ts',
    ]) {
      const text = source(file);
      for (const banned of ['히스테리시스', '스트릭', 'RPE', '인터벌', '스플릿', '볼륨']) {
        assert.equal(text.includes(banned), false, `${file}에 "${banned}"가 있습니다.`);
      }
    }
  });

  it('자동 멈춤은 GPS 속도만 보고, 기존 Preview 게이트를 그대로 쓴다', () => {
    const hook = source('domains/tracking/useRunTracking.ts');
    assert.match(hook, /gpsTrackingEnabled/);
    assert.match(hook, /speedKmhFromFixes/);
  });
});
