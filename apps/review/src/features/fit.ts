// Editorial/source fields, not a medical matching or scoring engine.
// Wide variants, toe space and instep volume are separate properties.
export type FootProfile = { width: string; instep: string; arch: string };
export const emptyFoot: FootProfile = {
  width: "미선택",
  instep: "미선택",
  arch: "미선택",
};
type FitFact = Partial<{
  width: string;
  forefoot: string;
  instep: string;
  heel: string;
  size: string;
  source: string;
}>;
const facts: Record<string, Partial<FitFact>> = {
  "nike-pegasus42-105": {
    forefoot: "이전 모델보다 앞쪽이 넉넉해졌어요",
    size: "공식몰은 대부분 정사이즈로 안내해요",
  },
  "nike-structure26": { size: "공식몰은 반 사이즈 크게 안내해요" },
  "adidas-adiospro4": { size: "공식몰은 정사이즈로 안내해요" },
};
export const fitFor = (id: string, source: string): FitFact => ({
  ...facts[id],
  source,
});
export function profileSummary(p: FootProfile) {
  return [p.width, p.instep, p.arch].filter((v) => v !== "미선택").map(friendlyFootChoice).join(" · ");
}
export function friendlyFootChoice(v:string){return ({'미선택':'잘 모르겠어요','발볼 좁음·칼발':'발볼이 좁아요 (칼발)','보통 발볼':'발볼은 보통이에요','발볼 넓음':'발볼이 넓어요','발등 낮음':'발등이 낮아요','보통 발등':'발등은 보통이에요','발등 높음':'발등이 높아요','아치 낮음':'발바닥 안쪽이 낮아요','보통 아치':'발바닥 모양은 보통이에요','아치 높음·요족':'발바닥 안쪽이 높아요 (요족)'} as Record<string,string>)[v]||v;}
export function profileNotes(p: FootProfile): string[] {
  const notes: string[] = [];
  if (p.width === "발볼 좁음·칼발")
    notes.push(
      "앞쪽이 너무 헐겁지 않은지, 뒤꿈치가 들리지 않는지 살펴보세요. 어떤 모델이 좁은 발에 잘 맞는지는 아직 정보가 부족해요.",
    );
  if (p.width === "발볼 넓음")
    notes.push(
      "넓은 폭 모델인지, 엄지 쪽도 넉넉한지 따로 살펴보세요. 사진 속 제품과 넓은 폭 제품의 제품번호는 다를 수 있어요.",
    );
  if (p.instep === "발등 높음")
    notes.push(
      "끈을 묶었을 때 발등이 눌리지 않는지 살펴보세요. 앞쪽이 넉넉해도 발등 쪽은 다르게 느껴질 수 있어요.",
    );
  if (p.arch === "아치 높음·요족")
    notes.push(
      "얼마나 푹신한지, 잘 구부러지는지, 직접 신었을 때 편한지 함께 살펴보세요. 발바닥 모양만으로 맞는 신발을 정할 수는 없어요.",
    );
  if (p.arch === "아치 낮음")
    notes.push(
      "발을 안정적으로 잡아주는지, 직접 신었을 때 편한지 살펴보세요. 발바닥 모양만으로 맞는 신발을 정할 수는 없어요.",
    );
  return notes.length
    ? notes
    : ["내 발 모양을 고르면 신발을 비교할 때 살펴볼 점을 함께 보여드려요."];
}
export const fitSources = [
  {
    title: "AAOS · 양발 길이·너비와 실제 착화 확인",
    url: "https://orthoinfo.aaos.org/en/diseases--conditions/tight-shoes-and-foot-problems?webid=2FDEE455",
  },
  {
    title: "APMA · 발 유형별 러닝화 선택 안내",
    url: "https://www.apma.org/patients-and-the-public/tips-for-healthy-feet/which-running-shoe-is-right-for-you/",
  },
  {
    title: "Mayo Clinic · 아치 형태만으로 최적 신발을 정할 수 없음",
    url: "https://www.mayoclinichealthsystem.org/-/media/national-files/documents/hometown-health/2019/determine-your-foot-arch-type.pdf?hash=8F1C21551BF27F88EE0B6CF3E62AA98B&sc_lang=en",
  },
  {
    title: "RunRepeat · 발볼·엄지 쪽 폭·앞코 높이 측정 구분",
    url: "https://runrepeat.com/uk/guides/runners-guide-choosing-toebox",
  },
];
