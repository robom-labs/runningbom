// Local, explicit phrase hints + SurveyJS confirmation. This is not an NLP,
// clinical or learned recommendation engine. Never transmit or log answers.
export const concerns = [
  { value: "instep", text: "발등이 높아서 눌려요", short: "발등이 눌리지 않게", example: "발등이 높아서 끈을 묶으면 눌려요" },
  { value: "narrow", text: "칼발이라 신발이 헐거워요", short: "좁은 발에 잘 맞게", example: "칼발이라 신발 안에서 발이 움직여요" },
  { value: "wide", text: "발볼이 넓어서 양옆이 끼어요", short: "발볼이 끼지 않게", example: "발볼이 넓어서 신발 양옆이 끼어요" },
  { value: "ankle", text: "발목이 약하고 자주 흔들려요", short: "발을 안정적으로 잡도록", example: "평소 발목이 약해서 자주 흔들려요" },
  { value: "plantar", text: "족저근막염이 있어요", short: "뒤꿈치 쿠션과 받침 확인", example: "족저근막염이 있어서 편한 신발을 찾고 있어요" },
  { value: "arch", text: "발바닥 안쪽이 높아요 (요족)", short: "쿠션과 신었을 때 편안함", example: "요족이라 발바닥 안쪽이 높아요" },
  { value: "orthotic", text: "맞춤 깔창을 넣어 신어요", short: "깔창을 넣어도 편안하게", example: "맞춤 깔창을 넣어 신을 수 있는 신발을 찾고 있어요" },
  { value: "cushion", text: "가볍게 뛸 때 푹신하면 좋겠어요", short: "편하게 달릴 푹신한 쿠션", example: "가볍게 뛸 때 푹신하고 편하면 좋겠어요" },
] as const;
export type Concern = (typeof concerns)[number]["value"];
export type FinderAnswer = { concerns: Concern[]; purpose: string; budget: number; discomfort?: string };
export const finderExamples = concerns.filter(c => ["instep", "narrow", "ankle", "plantar"].includes(c.value));

export function requestHints(text: string): Concern[] {
  const found = new Set<Concern>();
  // Conservative hints only; compound/negative statements always remain editable.
  for (const clause of text.split(/[.!?\n,，]|지만|그리고|아니고|않고|없고/)) {
    if (/(?:아니|없|않|아닌|높지|좁지|넓지|약하지|안\s*아)/.test(clause)) continue;
    if (/발등/.test(clause) && /높|눌|조이|압박|꽉/.test(clause)) found.add("instep");
    if (/칼발|발볼.{0,7}좁|발이?\s*좁|헐거|헐렁/.test(clause)) found.add("narrow");
    if (/발볼.{0,7}넓|양옆.{0,7}끼|발가락.{0,7}끼/.test(clause)) found.add("wide");
    if (/발목/.test(clause) && /약|흔들|접질|삐/.test(clause)) found.add("ankle");
    if (/족저|근막염|뒤꿈치.{0,7}(?:아파|통증)/.test(clause)) found.add("plantar");
    if (/요족|아치.{0,7}높|발바닥.{0,7}안쪽.{0,7}높/.test(clause)) found.add("arch");
    if (/맞춤.{0,4}깔창|교정.{0,4}깔창|보조기/.test(clause)) found.add("orthotic");
    if (/푹신|쿠션|충격/.test(clause)) found.add("cushion");
  }
  return concerns.map(c => c.value).filter(c => found.has(c));
}

export const finderSchema = {
  showQuestionNumbers: "off", showCompletedPage: false, showProgressBar: "off",
  completeText: "이 조건으로 찾아주세요", requiredText: "", widthMode: "responsive",
  questionErrorLocation: "bottom", focusFirstQuestionAutomatic: false,
  elements: [
    { type: "checkbox", name: "concerns", title: "제가 이해한 내용이 맞나요?", description: "여러 개 골라도 돼요. 다른 내용은 바로 바꿔 주세요.", choices: concerns.map(({ value, text }) => ({ value, text })), colCount: 1, isRequired: true, requiredErrorText: "찾고 싶은 조건을 하나 이상 골라 주세요." },
    { type: "radiogroup", name: "discomfort", title: "지금 달리거나 걸을 때도 아픈가요?", description: "통증이 있으면 신발 후보보다 먼저 확인할 점을 안내해요.", visibleIf: "{concerns} contains 'plantar' or {concerns} contains 'ankle'", isRequired: true, requiredErrorText: "현재 상태를 골라 주세요.", choices: [{ value: "now", text: "지금도 아파요" }, { value: "none", text: "현재 통증은 없어요" }, { value: "unknown", text: "잘 모르겠어요" }] },
    { type: "radiogroup", name: "purpose", title: "주로 어떻게 신을 건가요?", defaultValue: "daily", choices: [{ value: "daily", text: "산책이나 가벼운 조깅" }, { value: "cushion", text: "오래 달려도 편한 쿠션" }, { value: "fast", text: "빠르게 달리는 훈련" }, { value: "race", text: "기록을 위한 대회용" }] },
    { type: "radiogroup", name: "budget", title: "생각한 가격대가 있나요?", defaultValue: 0, choices: [{ value: 0, text: "가격은 먼저 보지 않을게요" }, { value: 100000, text: "10만원까지" }, { value: 200000, text: "20만원까지" }, { value: 300000, text: "30만원까지" }] },
  ],
};

const NHS = "https://www.nhs.uk/conditions/plantar-fasciitis/";
const FOOTWEAR = "https://www.guysandstthomas.nhs.uk/health-information/choosing-shoes-reduce-foot-pain";
const APMA = "https://www.apma.org/patients-and-the-public/tips-for-healthy-feet/which-running-shoe-is-right-for-you/";
export const criteria: Record<Concern, { title: string; detail: string; source: string; sourceTitle: string }> = {
  instep: { title: "끈을 묶어도 발등이 눌리지 않는지", detail: "발등 쪽 여유와 끈 조절을 봐요. 앞쪽이 넓다는 설명만으로 발등까지 편하다고 판단하지 않아요.", source: FOOTWEAR, sourceTitle: "NHS · 신발 깊이와 끈 조절 안내" },
  narrow: { title: "좁은 발이 안에서 움직이지 않는지", detail: "좁은 폭 옵션, 뒤꿈치가 들리는지, 끈을 조였을 때 잘 잡아주는지를 함께 봐요. 작은 사이즈를 고르는 것과는 달라요.", source: FOOTWEAR, sourceTitle: "NHS · 폭과 고정 방법 안내" },
  wide: { title: "양옆과 엄지 쪽이 끼지 않는지", detail: "넓은 폭 옵션인지, 앞쪽도 넉넉한지 따로 봐요. 넓은 폭 제품은 사진 속 제품과 제품번호가 다를 수 있어요.", source: FOOTWEAR, sourceTitle: "NHS · 발볼과 앞쪽 모양 안내" },
  ankle: { title: "발이 안에서 흔들리거나 뒤꿈치가 들리지 않는지", detail: "끈으로 잘 고정되는지와 신었을 때 안정감을 확인해요. ‘발목이 약해요’라는 말만으로 발이 안쪽으로 기우는지 판단할 수는 없어요.", source: FOOTWEAR, sourceTitle: "NHS · 신발 고정과 안정감 안내" },
  plantar: { title: "뒤꿈치 쿠션과 발바닥을 받쳐주는지", detail: "족저근막염이 있을 때 살펴볼 일반적인 조건이에요. 특정 신발이 통증을 치료하거나 나에게 맞는다는 뜻은 아니에요.", source: NHS, sourceTitle: "NHS · 족저근막염과 신발 안내" },
  arch: { title: "푹신한지, 직접 신었을 때 편한지", detail: "발바닥 안쪽이 높다는 이유 하나로 정답을 정하지 않아요. 쿠션과 잘 구부러지는지, 신었을 때 편한지를 함께 확인해요.", source: APMA, sourceTitle: "APMA · 러닝화 선택 안내" },
  orthotic: { title: "원래 깔창을 빼고 내 깔창을 넣을 수 있는지", detail: "내 깔창을 넣었을 때 발등이 눌리거나 뒤꿈치가 빠지지 않는지도 확인해요.", source: FOOTWEAR, sourceTitle: "NHS · 깔창과 신발 깊이 안내" },
  cushion: { title: "가볍게 달릴 때 편한 쿠션부터", detail: "공식 설명에서 쿠션을 강조한 모델을 먼저 살펴봐요. 무게와 신었을 때 느낌도 비교할 수 있어요.", source: APMA, sourceTitle: "APMA · 용도와 착화 확인" },
};

export function needsClinicalCheck(answer: FinderAnswer) {
  return answer.concerns.includes("plantar") || (answer.concerns.includes("ankle") && answer.discomfort !== "none");
}
export function fitEvidenceGap(answer: FinderAnswer) {
  return answer.concerns.some(c => ["instep", "narrow", "wide", "ankle", "orthotic"].includes(c));
}

// Existing official product facts, not scores by disease or foot shape.
export const candidateFacts: Record<string, string> = {
  "nike-pegasus42-105": "공식 설명에서 일상 러닝용으로 안내해요. 이전 모델보다 앞쪽이 넉넉해졌어요.",
  "asics-contend10": "공식 설명에 AMPLIFOAM+ 쿠션을 사용한 모델로 안내돼 있어요.",
  "nike-vomero18": "공식 설명에서 ZoomX와 ReactX를 사용한 쿠션을 강조해요.",
  "asics-nimbus28": "공식 설명에서 부드러운 쿠션과 편안함을 강조해요.",
  "nike-structure26": "공식 설명에서 중간 부분이 발을 감싸도록 설계했다고 안내해요.",
  "nike-zoomfly6": "공식 설명에서 빠른 훈련과 레이스를 위한 카본 플레이트를 안내해요.",
  "asics-metaspeed-tokyo": "공식 설명에서 기록을 위한 레이스 모델로 안내해요.",
  "adidas-adiospro4": "공식 설명에서 장거리 레이스용으로 안내해요. 현재 등록된 제품은 여성용이에요.",
};
type ProductForFinder = { id: string; price: number | null; currency:string; purpose: string };
export function candidateProducts<T extends ProductForFinder>(products: T[], answer: FinderAnswer): T[] {
  if (needsClinicalCheck(answer)) return [];
  const purpose = answer.purpose || "daily";
  const wanted = purpose === "race" ? ["대회용 카본"] : purpose === "fast" ? ["빠른 훈련", "슈퍼 트레이너"] : purpose === "cushion" || answer.concerns.includes("cushion") || answer.concerns.includes("arch") ? ["푹신한 쿠션"] : ["입문·매일 러닝", "푹신한 쿠션"];
  return products.filter(p => wanted.includes(p.purpose) && (!answer.budget || (p.currency === "KRW" && p.price !== null && p.price <= answer.budget))).slice(0, 4);
}
