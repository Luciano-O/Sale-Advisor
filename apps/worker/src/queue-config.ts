import type { JobsOptions } from "bullmq";

export const PIPELINE_QUEUES = ["parse", "consolidate", "score", "notify"] as const;

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 1_000 },
  removeOnComplete: 1_000,
  removeOnFail: 5_000
};

export function deterministicJobId(stage: string, aggregateId: string, version: number): string {
  return `${stage}-${aggregateId}-${version}`;
}
