export type ThrottledBatchOptions<T> = {
  delayMs: number;
  maxItems: number;
  maxRunMs: number;
  onItem: (item: T, index: number) => Promise<void>;
};

export type ThrottledBatchResult = {
  attempted: number;
  sent: number;
  failed: number;
  stoppedEarly: boolean;
  hasMore: boolean;
};

export function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function sendWithThrottle<T>(
  items: T[],
  options: ThrottledBatchOptions<T>,
): Promise<ThrottledBatchResult> {
  const startedAt = Date.now();
  const runLimit = Math.max(1, options.maxRunMs);
  const maxItems = Math.max(1, options.maxItems);
  const delayMs = Math.max(0, options.delayMs);

  let attempted = 0;
  let sent = 0;
  let failed = 0;
  let stoppedEarly = false;

  for (let index = 0; index < items.length && attempted < maxItems; index += 1) {
    if (Date.now() - startedAt >= runLimit) {
      stoppedEarly = true;
      break;
    }

    attempted += 1;
    try {
      await options.onItem(items[index], index);
      sent += 1;
    } catch {
      failed += 1;
    }

    if (delayMs > 0 && attempted < maxItems && index < items.length - 1) {
      await sleep(delayMs);
    }
  }

  const hasMore = stoppedEarly || attempted < items.length;

  return {
    attempted,
    sent,
    failed,
    stoppedEarly,
    hasMore,
  };
}
