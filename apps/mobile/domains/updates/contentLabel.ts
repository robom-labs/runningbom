// 지금 폰에서 돌고 있는 앱 내용을 사람 말로 바꾸는 규칙입니다.
//
// 기기에서 값을 읽어 오는 일은 services/updates가 하고, 여기서는 말로 바꾸기만 합니다.
// 그래야 이 규칙을 기기 없이 테스트할 수 있습니다.
//
// 왜 필요한가:
//   자동 업데이트를 켜 두고도, 사용자도 개발자도 **폰에 무엇이 깔려 있는지 볼 방법이 없었습니다.**
//   그래서 "고쳤습니다"라고 말한 뒤 "안 되는데요"가 오면, 고친 내용이 폰에 도달하지 않은 것인지
//   고친 내용이 틀린 것인지 구분할 수가 없었습니다. 실제로 그 상태로 세 번을 헤맸습니다.

/** "7월 27일 22:33 판"처럼 사람이 읽는 말로 바꿉니다. */
export function contentLabel(
  enabled: boolean,
  embedded: boolean,
  createdAt: Date | undefined,
): string {
  if (!enabled) return '이 빌드는 자동 업데이트를 쓰지 않아요.';
  if (embedded || !createdAt || Number.isNaN(createdAt.getTime())) {
    return '처음 설치한 내용 그대로예요.';
  }
  const month = createdAt.getMonth() + 1;
  const day = createdAt.getDate();
  const hour = String(createdAt.getHours()).padStart(2, '0');
  const minute = String(createdAt.getMinutes()).padStart(2, '0');
  return `${month}월 ${day}일 ${hour}:${minute}에 올린 내용이에요.`;
}

export type UpdateCheckOutcomeKind = 'disabled' | 'upToDate' | 'downloaded' | 'failed';

/** 화면에 그대로 쓰는 말입니다. 기기 오류 문구를 그대로 내보내지 않습니다. */
export const updateOutcomeLabels: Record<UpdateCheckOutcomeKind, string> = {
  disabled: '이 빌드는 자동 업데이트를 쓰지 않아요.',
  upToDate: '이미 최신이에요.',
  downloaded: '새 내용을 받았어요. 잠시 뒤 다시 시작합니다.',
  failed: '지금은 확인하지 못했어요. 인터넷을 확인하고 다시 눌러 주세요.',
};
