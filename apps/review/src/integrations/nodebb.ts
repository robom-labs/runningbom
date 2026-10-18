import type { FeedPost } from "../features/catalog";
// NodeBB remains the source of posts, permissions, users and chat.
// Only read public topic metadata here. No admin token may enter the browser.
type NodeTopic = {
  tid: number;
  title: string;
  slug: string;
  postcount: number;
  timestampISO?: string;
  tags?: { value: string }[];
  teaser?: {
    content: string;
    user?: { displayname?: string; username?: string };
  };
  user?: { displayname?: string; username?: string };
};
export function configuredCommunity() {
  const raw = import.meta.env.VITE_NODEBB_PUBLIC_URL as string | undefined;
  if (!raw) return null;
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("올바른 커뮤니티 주소가 필요합니다.");
  if (url.username || url.password)
    throw new Error("공개 주소에 인증 정보를 포함할 수 없습니다.");
  return url;
}
function plainText(value: string) {
  const doc = new DOMParser().parseFromString(value, "text/html");
  return doc.body.textContent?.trim().slice(0, 600) || "";
}
export async function readCommunity(signal: AbortSignal): Promise<FeedPost[]> {
  const base = configuredCommunity();
  if (!base) throw new Error("커뮤니티 서버가 아직 연결되지 않았어요.");
  const endpoint = new URL(base.href.replace(/\/$/, "") + "/api/recent");
  const response = await fetch(endpoint, {
    signal,
    credentials: "omit",
    headers: { Accept: "application/json" },
  });
  if (!response.ok)
    throw new Error("소식을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  const body = (await response.json()) as { topics?: NodeTopic[] };
  if (!Array.isArray(body.topics))
    throw new Error("커뮤니티 응답을 확인해야 합니다.");
  return body.topics.map((t) => ({
    id: String(t.tid),
    name: t.user?.displayname || t.user?.username || "러너",
    initials: (t.user?.displayname || t.user?.username || "러너").slice(0, 2),
    tag: t.tags?.[0]?.value || "러너 소식",
    title: plainText(t.title),
    content: plainText(t.teaser?.content || ""),
    likes: 0,
    comments: Math.max(0, (t.postcount || 1) - 1),
    time: t.timestampISO ? formatRelative(t.timestampISO) : "",
    url: base.href.replace(/\/$/, "") + "/topic/" + t.tid,
  }));
}
function formatRelative(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
