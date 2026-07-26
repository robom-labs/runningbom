// 커뮤니티 글쓰기가 열리기 전까지 사용자가 쓴 질문·메모를 이 기기에만 보관하는 규칙입니다.
// 서버로 보내지 않고, 기존 저장 키를 건드리지 않으며, 새 키만 추가합니다.

import type { KnowledgeTopic } from './knowledge';

export const COMMUNITY_DRAFT_KEY = 'runningbom:vnext:community-drafts:v1';

export const draftTopics: KnowledgeTopic[] = [
  '초보질문',
  '훈련법',
  '장비',
  '대회준비',
  '부상예방·회복',
  '코스',
];

export const DRAFT_BODY_MAX = 500;
export const DRAFT_LIMIT = 50;

export type CommunityDraft = {
  id: string;
  topic: KnowledgeTopic;
  body: string;
  createdAt: string;
};

export type DraftParseResult =
  | { ok: true; value: Omit<CommunityDraft, 'id' | 'createdAt'> }
  | { ok: false; message: string };

export function parseDraft(topic: KnowledgeTopic, body: string): DraftParseResult {
  const normalized = body.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (normalized.length < 5) {
    return { ok: false, message: '5자 이상 적어 주세요. 나중에 그대로 올릴 수 있게 보관해 둘게요.' };
  }
  if (normalized.length > DRAFT_BODY_MAX) {
    return { ok: false, message: `${DRAFT_BODY_MAX}자 이내로 줄여 주세요.` };
  }
  if (!draftTopics.includes(topic)) {
    return { ok: false, message: '주제를 하나 골라 주세요.' };
  }
  return { ok: true, value: { topic, body: normalized } };
}

export function isCommunityDraft(value: unknown): value is CommunityDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<CommunityDraft>;
  return (
    typeof draft.id === 'string' &&
    typeof draft.body === 'string' &&
    typeof draft.createdAt === 'string' &&
    typeof draft.topic === 'string' &&
    draftTopics.includes(draft.topic as KnowledgeTopic)
  );
}

export function parseDraftList(raw: string | null): CommunityDraft[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCommunityDraft).slice(0, DRAFT_LIMIT);
  } catch {
    return [];
  }
}

/** 최신 보관함이 위로 오도록 정렬하고 상한을 지킵니다. */
export function withDraft(drafts: CommunityDraft[], next: CommunityDraft): CommunityDraft[] {
  return [next, ...drafts.filter((draft) => draft.id !== next.id)].slice(0, DRAFT_LIMIT);
}

export function withoutDraft(drafts: CommunityDraft[], draftId: string): CommunityDraft[] {
  return drafts.filter((draft) => draft.id !== draftId);
}
