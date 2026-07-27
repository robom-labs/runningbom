// 시스템 창이 뜨기 "직전에" 먼저 보여 주는 사전 설명 문구입니다.
// 규칙: 무엇을 위한 것인지 제목에 쓰고, 본문에는 구체적인 이득을 쓰고,
// 안 되는 것도 정직하게 적습니다. "허용해 주세요" 같은 부탁 문장은 쓰지 않습니다.
import type { PermissionKey } from './types';

export type PermissionPrimingCopy = {
  key: PermissionKey;
  /** 큰 제목: 무엇을 위한 것인지 */
  title: string;
  /** 본문 1~2줄: 켜면 실제로 무엇이 좋아지는지 */
  body: string;
  /** 안 되는 것도 정직하게 */
  honesty: string;
  /** 개인정보 약속처럼 꼭 화면에 남겨야 하는 한 줄(없으면 비워 둡니다) */
  promise?: string;
  /** 시스템 창이 없는 경우, 설정 화면에서 무엇을 눌러야 하는지 번호로 */
  steps?: string[];
  /** 주 버튼 */
  allowLabel: string;
  /** 보조 버튼 */
  laterLabel: string;
  /** 두 번 거절해 시스템 창이 더 안 뜰 때 쓰는 주 버튼 */
  settingsLabel: string;
  /** 두 번 거절한 뒤 보여 주는 한 줄 설명 */
  settingsNote: string;
  /** 거절 직후 보여 주는 한 줄 설명 */
  deniedNote: string;
  /** 설정 화면 목록에 쓰는 짧은 이름 */
  shortName: string;
  /** 설정 화면 목록에 쓰는 한 줄 설명 */
  shortDescription: string;
};

export const permissionPriming: Record<PermissionKey, PermissionPrimingCopy> = {
  notification: {
    key: 'notification',
    title: '대회 접수가 열리면 바로 알려 드릴게요',
    body: '알림을 켜면 마음에 담아 둔 대회의 접수 시작 시각에 딱 맞춰 알려 드리고, 달리기로 정해 둔 날 아침에 한 번 가볍게 알려 드려요.',
    honesty:
      '거절해도 대회 찾기와 코치 안내는 그대로 다 됩니다. 다만 접수 시작 시각을 직접 챙기셔야 해요.',
    promise: '광고 알림은 보내지 않아요. 알려 드리는 건 직접 고른 대회와 직접 정한 러닝 날뿐이에요.',
    allowLabel: '허용하고 계속',
    laterLabel: '나중에',
    settingsLabel: '설정에서 켜기',
    settingsNote:
      '이미 두 번 껐기 때문에 휴대폰이 더는 물어보지 않아요. 아래 버튼을 누르면 러닝봄 설정이 바로 열려요.',
    deniedNote: '지금은 알림이 꺼져 있어요. 설정에서 언제든 다시 켤 수 있어요.',
    shortName: '알림',
    shortDescription: '대회 접수 시작과 달리기로 정한 날을 알려 줘요.',
  },
  location: {
    key: 'location',
    title: '달린 거리를 재려면 위치가 필요해요',
    body: '위치를 켜야 몇 km 뛰었는지, 1km에 몇 분이 걸렸는지 알 수 있어요. 달린 길도 지도처럼 남아요.',
    honesty:
      '거절해도 시간 기반 코칭은 그대로 됩니다. 거리와 1km 기록만 안 나와요.',
    promise: '러닝 중에만 쓰고, 앱을 끈 사이의 위치는 아예 요청하지 않아요.',
    allowLabel: '허용하고 계속',
    laterLabel: '나중에',
    settingsLabel: '설정에서 켜기',
    settingsNote:
      '이미 두 번 껐기 때문에 휴대폰이 더는 물어보지 않아요. 아래 버튼을 누르면 러닝봄 설정이 바로 열려요.',
    deniedNote: '지금은 위치가 꺼져 있어요. 시간 기반 코칭으로 계속 달릴 수 있어요.',
    shortName: '위치',
    shortDescription: '달린 거리와 1km 기록을 재요. 러닝 중에만 씁니다.',
  },
  battery: {
    key: 'battery',
    title: '화면을 꺼도 러닝이 안 끊기게',
    body: '휴대폰이 러닝봄을 억지로 재우면 시간과 거리가 중간에 멈춰요. 배터리 아끼기 대상에서 빼 두면 주머니에 넣고 달려도 끝까지 세어 줘요.',
    honesty:
      '안 해도 러닝은 됩니다. 다만 화면을 오래 꺼 두면 기록이 실제보다 짧게 남을 수 있어요.',
    promise: '이건 휴대폰 설정 화면에서 직접 고르는 값이라, 러닝봄이 대신 켤 수 없어요.',
    steps: [
      '1. 아래 버튼을 누르면 휴대폰 설정이 열려요',
      '2. 열리는 목록에서 러닝봄 찾기',
      '3. 제한 없음 선택',
      '4. 뒤로 눌러 러닝봄으로 돌아오기',
    ],
    allowLabel: '설정 열고 계속',
    laterLabel: '나중에',
    settingsLabel: '설정 다시 열기',
    settingsNote: '설정이 안 열리면 러닝봄 앱 설정이 대신 열려요. 거기서 배터리 항목을 찾으면 돼요.',
    deniedNote: '설정을 열어 봤어요. 실제로 바뀌었는지는 휴대폰만 알 수 있어서 이 화면에서는 확인하지 못해요.',
    shortName: '배터리 아끼기 제외',
    shortDescription: '화면을 꺼도 러닝 기록이 끊기지 않게 해요.',
  },
};

/** 사전 설명 화면에서 쓰지 않기로 한 말들입니다. 테스트가 이 목록으로 문구를 검사합니다. */
export const bannedPhrases = [
  '권한을 허용',
  '퍼미션',
  '런타임',
  '스트릭',
  'RPE',
  '인터벌',
  '세션',
];

export function primingCopy(key: PermissionKey): PermissionPrimingCopy {
  return permissionPriming[key];
}

/** 온보딩 마지막 화면 문구입니다. */
export const onboardingDoneCopy = {
  title: '준비 끝, 이제 달리러 나가요',
  body: '지금 고른 값은 모두 설정에서 다시 바꿀 수 있어요. 안 켠 것이 있어도 러닝은 바로 시작할 수 있어요.',
  allGrantedNote: '알림과 거리 재기가 켜졌어요. 첫 러닝을 시작해 보세요.',
  noneGrantedNote: '아무것도 안 켜도 괜찮아요. 시간 기반 코칭으로 바로 달릴 수 있어요.',
  settingsHint: '설정 > 알림·위치·배터리에서 언제든 다시 켤 수 있어요.',
} as const;

/** 로그인 자리 문구입니다. 실제 로그인 화면은 부모가 연결합니다. */
export const onboardingLoginCopy = {
  title: '기록을 다른 기기에서도 보고 싶다면',
  body: '로그인하면 기록을 계정에 이어 둘 수 있어요. 지금 안 해도 모든 기능을 그대로 쓸 수 있어요.',
  honesty: '로그인 없이 시작해도 기록은 이 기기에 그대로 쌓여요.',
  continueLabel: '로그인 없이 계속',
} as const;
