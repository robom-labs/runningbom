// 커뮤니티 화면의 구획 순서를 정하는 규칙입니다. 화면을 그리지 않는 순수 코드라 검사하기 쉽습니다.
//
// 순서 규칙
// 1. 지금 바로 쓸 수 있는 구획이 앞에 옵니다.
// 2. 서버가 있어야 되는 구획은 뒤로 보내고, 이름 옆에 "준비 중"을 붙입니다.
// 3. 기본으로 열리는 구획은 항상 "지금 쓸 수 있는 것" 중 첫 번째입니다.
//    (앱을 열자마자 "준비 중"만 보이는 일이 생기지 않게 합니다.)

export type CommunitySectionKey = 'card' | 'drafts' | 'posts' | 'together';

export type CommunitySection = {
  key: CommunitySectionKey;
  label: string;
  /** 지금 바로 쓸 수 있으면 true, 서버를 기다리는 중이면 false입니다. */
  ready: boolean;
  /** 왜 지금 쓸 수 있는지 / 왜 아직 못 쓰는지 한 줄 설명입니다. */
  hint: string;
};

/** 준비 중 구획 이름 옆에 붙이는 꼬리말입니다. 문구를 한곳에서만 정합니다. */
export const notReadySuffix = '준비 중';

export const communitySections: CommunitySection[] = [
  {
    key: 'card',
    label: '기록 카드',
    ready: true,
    hint: '내 러닝을 카드로 만들어 원하는 곳에 올릴 수 있어요.',
  },
  {
    key: 'drafts',
    label: '내 글 보관함',
    ready: true,
    hint: '쓰고 싶은 글을 내 폰에만 저장해 둬요.',
  },
  {
    key: 'posts',
    label: '사람들 소식',
    ready: false,
    hint: '글을 모아 두는 서버가 아직 연결되지 않았어요.',
  },
  {
    key: 'together',
    label: '크루·리그',
    ready: false,
    hint: '여럿이 모이는 기능은 서버와 안전 점검이 끝나야 열려요.',
  },
];

/** 목록에서 지금 쓸 수 있는 첫 구획을 찾습니다. 하나도 없으면 맨 앞을 씁니다. */
export function firstReadySection(
  sections: CommunitySection[] = communitySections,
): CommunitySectionKey {
  const ready = sections.find((section) => section.ready) ?? sections[0];
  if (!ready) throw new Error('커뮤니티 구획이 하나도 없습니다');
  return ready.key;
}

/** 처음 화면을 열었을 때 보이는 구획입니다. 항상 지금 쓸 수 있는 곳입니다. */
export const defaultCommunitySection: CommunitySectionKey = firstReadySection();

/** 칩에 적을 이름입니다. 준비 중이면 그 사실을 이름에 그대로 적습니다. */
export function sectionChipLabel(section: CommunitySection): string {
  return section.ready ? section.label : `${section.label} · ${notReadySuffix}`;
}

/** 스크린리더가 읽어 줄 말입니다. */
export function sectionAccessibilityLabel(section: CommunitySection): string {
  return section.ready ? section.label : `${section.label}, 아직 ${notReadySuffix}이에요`;
}
