// 달린 거리와 몸무게로 태운 열량(칼로리)을 구하는 순수 계산기입니다.
// 근거: 달리기는 "1킬로그램을 1킬로미터 옮기는 데 드는 열량"이 거의 일정해서
// kcal = 1.036 × 몸무게(kg) × 거리(km) 로 계산합니다. 키·나이·성별은 필요하지 않습니다.

/** 1kg이 1km를 달릴 때 쓰는 열량(kcal)입니다. */
export const KCAL_PER_KG_PER_KM = 1.036;

/** 거리를 재지 못했을 때만 쓰는 시간 기반 대략값의 기본 강도입니다(가벼운 달리기). */
export const DEFAULT_RUN_MET = 7;

/** 사람이 넣을 수 있는 몸무게 범위입니다. 이 밖의 값은 저장하지 않습니다. */
export const MIN_WEIGHT_KG = 25;
export const MAX_WEIGHT_KG = 250;

export function isValidWeightKg(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_WEIGHT_KG &&
    value <= MAX_WEIGHT_KG
  );
}

/** 몸무게를 아직 안 넣었을 때 화면에 그대로 보여 주는 안내입니다. 추측값으로 채우지 않습니다. */
export const weightMissingNotice = '체중을 입력하면 칼로리를 계산해 드려요.';

/** 빨리 뛰나 천천히 뛰나 같은 거리면 비슷하다는 사실을 한 줄로 알려 오해를 막습니다. */
export const speedIndependenceNote =
  '같은 거리라면 빨리 달리든 천천히 달리든 태우는 열량은 비슷해요.';

export type CalorieInput = {
  /** 저장해 둔 몸무게(kg). 없으면 계산하지 않습니다. */
  weightKg?: number;
  /** 실제로 잰 거리(km). 없으면 시간으로 대략만 구합니다. */
  distanceKm?: number;
  /** 달린 시간(분). */
  minutes: number;
  /** 시간 기반 대략값에 쓸 강도입니다. 보통은 넣지 않습니다. */
  met?: number;
};

export type CalorieEstimate =
  | {
      available: false;
      reason: 'no-weight' | 'no-input';
      /** 화면에 그대로 보여 줄 안내 문장입니다. */
      message: string;
    }
  | {
      available: true;
      kcal: number;
      /** 'distance'는 실제 거리로, 'time'은 시간으로 대략 구한 값입니다. */
      basis: 'distance' | 'time';
      /** true면 화면에 반드시 "대략"이라고 함께 적습니다. */
      approximate: boolean;
      /** "320kcal" 또는 "약 240kcal" */
      label: string;
      /** 어떻게 구했는지 알려 주는 한 줄입니다. */
      note: string;
    };

/** 거리 기반 공식입니다. 소수점은 남기고 표시할 때만 반올림합니다. */
export function caloriesFromDistance(weightKg: number, distanceKm: number): number {
  return KCAL_PER_KG_PER_KM * weightKg * distanceKm;
}

/**
 * 거리를 못 잰 빌드에서만 쓰는 시간 기반 대략값입니다.
 * kcal = 강도(MET) × 3.5 × 몸무게(kg) ÷ 200 × 분
 */
export function caloriesFromMinutes(
  weightKg: number,
  minutes: number,
  met: number = DEFAULT_RUN_MET,
): number {
  return ((met * 3.5 * weightKg) / 200) * minutes;
}

/**
 * 화면이 그대로 그릴 수 있는 칼로리 결과를 만듭니다.
 * 몸무게가 없으면 숫자를 지어내지 않고 안내만 돌려줍니다.
 */
export function estimateCalories(input: CalorieInput): CalorieEstimate {
  if (!isValidWeightKg(input.weightKg)) {
    return { available: false, reason: 'no-weight', message: weightMissingNotice };
  }
  const weightKg = input.weightKg;

  const distanceKm = input.distanceKm;
  if (typeof distanceKm === 'number' && Number.isFinite(distanceKm) && distanceKm > 0) {
    const kcal = Math.round(caloriesFromDistance(weightKg, distanceKm));
    return {
      available: true,
      kcal,
      basis: 'distance',
      approximate: false,
      label: `${kcal}kcal`,
      note: speedIndependenceNote,
    };
  }

  const minutes = input.minutes;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return {
      available: false,
      reason: 'no-input',
      message: '아직 달린 시간이 없어 칼로리를 계산하지 않았어요.',
    };
  }

  const kcal = Math.round(caloriesFromMinutes(weightKg, minutes, input.met));
  return {
    available: true,
    kcal,
    basis: 'time',
    approximate: true,
    label: `약 ${kcal}kcal`,
    note: '거리를 재지 않는 빌드라 달린 시간으로 대략 계산했어요. 실제와 차이가 있을 수 있어요.',
  };
}
