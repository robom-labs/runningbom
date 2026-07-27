// 내 러닝 기록 하나를 "공유 카드" 한 장으로 바꾸는 순수 규칙입니다.
//
// 왜 이게 필요한가
// - 커뮤니티 서버가 아직 없어서 다른 사람의 글은 존재하지 않습니다.
//   없는 사람과 없는 글을 지어내면 거짓말이 되므로, 지금 정직하게 할 수 있는 건
//   "내 기록을 내가 보기 좋게 만들어서 내가 원하는 곳으로 내보내는 것"입니다.
// - 그래서 이 파일은 저장된 기록에 이미 있는 값(거리·시간·날짜·유형)만 씁니다.
//   없는 값은 지어내지 않고 "없다"고 적습니다.
import { formatActivityPace } from '../activities/pace';
import { formatDistance, formatDuration } from '../activities/summary';
import { activitySourceLabels, type ActivityKind, type ActivityRecord } from '../activities/types';

/** 공유 카드로 만들 수 있는 기록의 최소 시간입니다. 이보다 짧으면 목록에 올리지 않습니다. */
export const shareCardMinimumMinutes = 5;

/** 고르는 목록에 한 번에 보여 주는 최대 개수입니다. */
export const shareCardListLimit = 30;

/**
 * 공유받은 사람이 러닝봄을 다시 찾을 수 있는 공식 랜딩 주소입니다.
 * 비공개 테스트 중인 Play 링크를 억지로 넣지 않고 누구나 열 수 있는 공식 웹 주소를 씁니다.
 */
export const shareCardLandingUrl = 'https://robom-labs.github.io/runningbom/';

export const shareCardKindLabels: Record<ActivityKind, string> = {
  run: '달리기',
  walk: '걷기',
  recovery: '회복 운동',
};

/** 거리를 재지 않은 기록에 쓰는 문구입니다. 0km라고 적지 않습니다. */
export const noDistanceLabel = '거리는 재지 않았어요';
export const noPaceLabel = '거리가 없어 1km당 시간은 계산할 수 없어요';

export type ShareCard = {
  activityId: string;
  /** '달리기' · '걷기' · '회복 운동' */
  kindLabel: string;
  /** '2026년 7월 26일 일요일' */
  dateLabel: string;
  /** '7월 26일' — 카드 안 작은 글씨용입니다. */
  shortDateLabel: string;
  /** '5.2km' 또는 거리 없음 안내 */
  distanceLabel: string;
  /** '30분' */
  durationLabel: string;
  /** "1km당 5'46\"" 또는 계산 불가 안내 */
  paceLabel: string;
  hasDistance: boolean;
  /** '러닝봄 코치 완주' 같은 기록 출처입니다. 어디서 온 기록인지 숨기지 않습니다. */
  sourceLabel: string;
};

const longDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
});

const shortDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'long',
  day: 'numeric',
});

function safeDate(value: string): Date | undefined {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed;
}

/** 기록 한 건을 카드에 필요한 문구들로 바꿉니다. 없는 값은 안내 문구로 채웁니다. */
export function buildShareCard(activity: ActivityRecord): ShareCard {
  const date = safeDate(activity.completedAt);
  const hasDistance =
    activity.distanceKm !== undefined &&
    Number.isFinite(activity.distanceKm) &&
    activity.distanceKm > 0;

  return {
    activityId: activity.id,
    kindLabel: shareCardKindLabels[activity.kind],
    dateLabel: date ? longDateFormatter.format(date) : '날짜를 알 수 없는 기록',
    shortDateLabel: date ? shortDateFormatter.format(date) : '날짜 모름',
    distanceLabel: hasDistance ? formatDistance(activity.distanceKm as number) : noDistanceLabel,
    durationLabel: formatDuration(activity.durationMinutes),
    paceLabel: hasDistance ? `1km당 ${formatActivityPace(activity)}` : noPaceLabel,
    hasDistance,
    sourceLabel: activitySourceLabels[activity.source],
  };
}

/** 공유 카드로 만들 만한 기록만, 최근 순으로 골라 줍니다. */
export function shareableActivities(
  activities: readonly ActivityRecord[],
  limit: number = shareCardListLimit,
): ActivityRecord[] {
  return [...activities]
    .filter(
      (activity) =>
        Number.isFinite(activity.durationMinutes) &&
        activity.durationMinutes >= shareCardMinimumMinutes,
    )
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .slice(0, Math.max(0, limit));
}

/** 폰의 공유 창에 뜨는 제목입니다. */
export const shareCardTitle = '러닝봄 기록 카드';

/**
 * 폰의 공유 기능으로 내보낼 글입니다.
 * 이미지가 아니라 글이라서 어느 앱에 붙여도 그대로 읽히고, 마지막 공식 주소로 러닝봄을 다시 찾을 수 있습니다.
 */
export function shareCardText(card: ShareCard, nickname?: string): string {
  const who = (nickname ?? '').trim();
  const lines = [shareCardTitle, card.dateLabel];

  lines.push(
    card.hasDistance
      ? `${card.kindLabel} · ${card.distanceLabel} · ${card.durationLabel}`
      : `${card.kindLabel} · ${card.durationLabel}`,
  );
  lines.push(card.hasDistance ? card.paceLabel : noDistanceLabel);
  if (who) lines.push(`${who}의 기록`);
  lines.push('', '러닝봄에서 함께 기록하기', shareCardLandingUrl);

  return lines.join('\n');
}

/** 화면 미리보기와 공유 글이 어긋나지 않게, 카드에 보여 줄 줄들을 한곳에서 만듭니다. */
export function shareCardPreviewLines(card: ShareCard): string[] {
  return [
    card.hasDistance ? card.distanceLabel : noDistanceLabel,
    card.durationLabel,
    card.hasDistance ? card.paceLabel : noPaceLabel,
  ];
}
