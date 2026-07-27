// 보조 프로젝트에서 "했어요"를 누른 단계를 이 기기에만 저장합니다.
//
// 저장하는 것은 단계 ID 목록뿐입니다. 그 이상 남기지 않습니다.
// 값이 깨져 있어도 앱이 멈추지 않게, 읽을 때 항상 다시 검사합니다.
export const PROJECT_STORE_KEY = 'runningbom.projects.v1';

/** 한 기기에 남기는 최대 개수입니다. 프로젝트 20개 × 단계 5개보다 넉넉합니다. */
export const MAX_DONE_STEPS = 300;

export type ProjectStore = {
  doneStepIds: string[];
};

export const emptyProjectStore: ProjectStore = { doneStepIds: [] };

/** 저장된 값을 안전한 모양으로 되돌립니다. 모르는 값은 버립니다. */
export function parseProjectStore(raw: unknown): ProjectStore {
  if (!raw || typeof raw !== 'object') return emptyProjectStore;
  const value = raw as { doneStepIds?: unknown };
  if (!Array.isArray(value.doneStepIds)) return emptyProjectStore;
  const ids = value.doneStepIds
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .slice(-MAX_DONE_STEPS);
  // 같은 단계가 두 번 들어가 있어도 한 번으로 셉니다.
  return { doneStepIds: [...new Set(ids)] };
}

/** 한 단계를 했다고 표시하거나, 되돌립니다. */
export function toggleStep(store: ProjectStore, stepId: string): ProjectStore {
  if (!stepId) return store;
  const done = new Set(store.doneStepIds);
  if (done.has(stepId)) done.delete(stepId);
  else done.add(stepId);
  return { doneStepIds: [...done].slice(-MAX_DONE_STEPS) };
}
