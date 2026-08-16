export type Metrics = {
  start: number;
  stages: Array<{ name: string; ms: number; ok: boolean }>;
  aiJobs: number;
  aiFailures: number;
  aiMs: number;
};

export const metrics: Metrics = {
  start: performance.now(),
  stages: [],
  aiJobs: 0,
  aiFailures: 0,
  aiMs: 0,
};

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60_000)}m ${((ms % 60_000) / 1000).toFixed(1)}s`;
}

function sinceStart(): string {
  return `+${formatDuration(performance.now() - metrics.start)}`;
}

export function log(tag: string, ...args: unknown[]): void {
  console.log(`[${sinceStart()}] [${tag}]`, ...args);
}

export function warn(tag: string, ...args: unknown[]): void {
  console.warn(`[${sinceStart()}] [${tag}]`, ...args);
}

export async function stage<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const started = performance.now();
  log("STAGE", `START ${name}`);
  try {
    const result = await fn();
    const ms = performance.now() - started;
    metrics.stages.push({ name, ms, ok: true });
    log("STAGE", `DONE  ${name} ${formatDuration(ms)}`);
    return result;
  } catch (error) {
    const ms = performance.now() - started;
    metrics.stages.push({ name, ms, ok: false });
    warn("STAGE", `FAIL  ${name} ${formatDuration(ms)}`);
    throw error;
  }
}

export function printSummary(): void {
  console.log("\n======================================");
  console.log("TIMING SUMMARY");
  console.log("======================================");
  for (const item of metrics.stages) {
    console.log(
      `${item.ok ? "OK " : "ERR"} ${item.name.padEnd(32)} ${formatDuration(item.ms)}`,
    );
  }
  console.log("--------------------------------------");
  console.log(`AI jobs:        ${metrics.aiJobs}`);
  console.log(`AI failures:    ${metrics.aiFailures}`);
  console.log(`AI total:       ${formatDuration(metrics.aiMs)}`);
  if (metrics.aiJobs) {
    console.log(`AI avg/job:     ${formatDuration(metrics.aiMs / metrics.aiJobs)}`);
  }
  console.log(`PIPELINE TOTAL: ${formatDuration(performance.now() - metrics.start)}`);
  console.log("======================================");
}
