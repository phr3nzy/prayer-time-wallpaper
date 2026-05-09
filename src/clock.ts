export interface Clock {
  stop(): void;
}

export function startClock(onTick: () => void, intervalMs = 1_000): Clock {
  const id = setInterval(onTick, intervalMs);
  return {
    stop() {
      clearInterval(id);
    },
  };
}
