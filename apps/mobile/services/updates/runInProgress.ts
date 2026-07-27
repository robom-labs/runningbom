// "지금 달리는 중인가?"를 앱 전체가 함께 보는 아주 작은 표시등입니다.
//
// 새 내용을 적용하려면 앱을 다시 시작해야 하는데, 달리는 도중에 그러면
// 그날 기록이 사라집니다. 그래서 달리는 동안에는 적용을 미루려고 이 값을 둡니다.
// 러닝 화면이 값을 세우고, 자동 업데이트가 값을 읽습니다.

let running = false;
const listeners = new Set<(next: boolean) => void>();

/** 러닝 화면이 세션을 시작·종료할 때 알려 줍니다. */
export function setRunInProgress(next: boolean): void {
  if (running === next) return;
  running = next;
  for (const listener of listeners) listener(next);
}

/** 지금 달리는 중인지 알려 줍니다. */
export function isRunInProgress(): boolean {
  return running;
}

/** 값이 바뀔 때 알려 달라고 등록합니다. 반환값을 부르면 등록이 풀립니다. */
export function subscribeRunInProgress(listener: (next: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 테스트에서 상태를 처음으로 되돌립니다. */
export function resetRunInProgress(): void {
  running = false;
  listeners.clear();
}
