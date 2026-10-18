// Review data, intentionally separated from published/verified source data.
// These event names, dates and prices are UI examples, not open registrations.
export type Race = {
  id: string;
  name: string;
  region: string;
  venue: string;
  distances: string[];
  raceAt: string;
  opensAt: string;
  closesAt: string;
  round: string;
  eligibility: string;
  price: number | null;
  image: string;
  imageWidth?:number;imageHeight?:number;
  status: "예정" | "접수중" | "마감임박" | "접수마감" | "확인 필요";
  sourceName:string;sourceUrl:string;registrationUrl:string;checkedAt:string;imageSource:string;imageKind?:string;timeConfirmed:boolean;needsReview:boolean;
  edition: number;
};
import productData from "./products.json";
export type Shoe = {
  id: string;
  name: string;
  model: string;
  purpose: string;
  tier: string;
  brand: string;
  description: string;
  plate: string;
  price: number | null;
  regularPrice: number | null;
  currency: string;
  sourceRegion: string;
  category: "daily" | "cushion" | "stability" | "supertrainer" | "speed" | "carbon" | "trail" | "unknown";
  uses: string[];
  modelEn?: string;
  aliases?: string[];
  drop: string;
  weight: string;
  release: string;
  releaseRegion: string;
  releaseSource: string;
  upcoming: boolean;
  color: string;
  gender: string;
  sku: string | null;
  source: string;
  image: string;
  imageSource: string;
  checkedAt: string;
  merchant: string;
  priceType: string;
};
export const shoes = productData as Shoe[];
export const purposes = [
  "전체",
  "입문·매일 러닝",
  "푹신한 쿠션",
  "탄탄한 지지",
  "빠른 훈련",
  "슈퍼 트레이너",
  "대회용 카본",
  "트레일",
];
export const trainingUses = ["전체", "조깅", "회복런", "롱런", "템포런", "인터벌", "레이스", "트레일"];
export const useCodes: Record<string,string> = {"조깅":"daily", "회복런":"recovery", "롱런":"long", "템포런":"tempo", "인터벌":"interval", "레이스":"race", "트레일":"trail"};
export function productPrice(p: Pick<Shoe,"price"|"currency">) {
  if (p.price === null || !Number.isFinite(p.price)) return "";
  return p.currency === "KRW" ? money(p.price) : `${p.currency} ${new Intl.NumberFormat("ko-KR", {maximumFractionDigits:2}).format(p.price)}`;
}
export type FeedPost = {
  id: string;
  name: string;
  initials: string;
  tag: string;
  title: string;
  content: string;
  likes: number;
  comments: number;
  time: string;
  photo?: string;
  raceId?: string;
  shoeId?: string;
  url?: string;
};
export const examplePosts: FeedPost[] = [
  {
    id: "sample-1",
    name: "아침을 달리는 지수",
    initials: "지수",
    tag: "대회 이야기",
    title: "첫 하프, 접수 전에 무엇을 챙기면 좋을까요?",
    content:
      "10km만 달리다가 이번 가을에는 하프에 도전해 보려고 해요. 기록증과 준비물을 미리 알아보고 싶어요.",
    likes: 24,
    comments: 8,
    time: "피드 예시",
    raceId: "sample-race",
  },
  {
    id: "sample-2",
    name: "차근차근 러너",
    initials: "차근",
    tag: "러닝화 후기",
    title: "매일 신을 한 켤레, 저는 편안함부터 봐요.",
    content:
      "가격보다 훈련 목적을 먼저 정하니 고르기가 쉬워졌어요. 여러분은 데일리 러닝화에서 어떤 점을 가장 많이 보나요?",
    likes: 18,
    comments: 5,
    time: "피드 예시",
    shoeId: "nike-pegasus42-105",
  },
  {
    id: "sample-3",
    name: "바다를 달려요",
    initials: "바다",
    tag: "러닝 일상",
    title: "오늘은 기록보다 풍경.",
    content: "바다 옆에서 가볍게 달리고 왔어요. 각자의 속도로 오래 달려요.",
    likes: 32,
    comments: 3,
    time: "피드 예시",
    photo: "/assets/race-busan.png",
  },
];
export const money = (n: number | null) => n === null ? "공식 안내 확인" : new Intl.NumberFormat("ko-KR").format(n) + "원";
export function formatDate(value: string, withTime = false) {
  if(!value || !Number.isFinite(Date.parse(value))) return "미공개";
  withTime = withTime && value.includes("T");
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(new Date(value));
}
