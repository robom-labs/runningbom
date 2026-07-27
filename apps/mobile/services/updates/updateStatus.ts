// 지금 폰에서 돌고 있는 앱 내용이 무엇인지 알려 주는 값입니다.
//
// 왜 필요한가:
//   자동 업데이트를 켜 두고도, 사용자도 개발자도 **폰에 무엇이 깔려 있는지 볼 방법이 없었습니다.**
//   그래서 "고쳤습니다"라고 말한 뒤 "안 되는데요"가 오면, 고친 내용이 폰에 도달하지 않은 것인지
//   고친 내용이 틀린 것인지 구분할 수가 없었습니다. 실제로 그 상태로 세 번을 헤맸습니다.
//
//   이 파일은 그 물음에 답합니다. "지금 이 앱은 언제 만든 내용으로 돌고 있는가."
import * as Updates from 'expo-updates';

import {
  contentLabel,
  updateOutcomeLabels,
  type UpdateCheckOutcomeKind,
} from '../../domains/updates/contentLabel';

export { contentLabel, updateOutcomeLabels };

export type AppContentStatus = {
  /** 자동 업데이트가 켜진 빌드인지입니다. 정식 앱과 개발 서버에서는 꺼져 있습니다. */
  enabled: boolean;
  /** 처음 설치한 그대로인지(아직 한 번도 새 내용을 받지 않았는지)입니다. */
  embedded: boolean;
  /** 지금 돌고 있는 내용을 만든 시각입니다. 설치본이면 없습니다. */
  createdAt?: Date;
  /** 화면에 그대로 쓰는 한 줄입니다. */
  label: string;
};

/** 지금 돌고 있는 앱 내용입니다. */
export function appContentStatus(): AppContentStatus {
  const enabled = Updates.isEnabled;
  // isEmbeddedLaunch는 예전 SDK에 없을 수 있어 안전하게 읽습니다.
  const embedded = Boolean((Updates as { isEmbeddedLaunch?: boolean }).isEmbeddedLaunch);
  const createdAt = Updates.createdAt ?? undefined;
  return {
    enabled,
    embedded,
    ...(createdAt ? { createdAt } : {}),
    label: contentLabel(enabled, embedded, createdAt),
  };
}

export type UpdateCheckOutcome =
  | { kind: Exclude<UpdateCheckOutcomeKind, 'failed'> }
  | { kind: 'failed'; message: string };

/**
 * 지금 바로 새 내용이 있는지 확인하고, 있으면 받습니다.
 *
 * 자동 업데이트는 앱을 열 때와 다시 열 때만 움직입니다.
 * 그 사이에 올라온 내용을 지금 당장 받고 싶을 때 쓰는 길입니다.
 */
export async function checkForUpdateNow(): Promise<UpdateCheckOutcome> {
  if (!Updates.isEnabled) return { kind: 'disabled' };
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return { kind: 'upToDate' };
    await Updates.fetchUpdateAsync();
    return { kind: 'downloaded' };
  } catch (error) {
    return {
      kind: 'failed',
      message: error instanceof Error ? error.message : '알 수 없는 이유',
    };
  }
}
