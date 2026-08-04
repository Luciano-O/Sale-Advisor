import { Inject } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";

import { PersistentPipelineService } from "./persistent-pipeline.js";
import { DEFAULT_JOB_OPTIONS, deterministicJobId } from "./queue-config.js";

export interface PipelineJobData {
  rawMessageId: string;
  version: number;
  correlationId: string;
}

abstract class PipelineProcessor extends WorkerHost {
  constructor(protected readonly pipeline: PersistentPipelineService) {
    super();
  }
  protected async run(job: Job<PipelineJobData>, operation: () => Promise<void>) {
    try {
      await operation();
    } catch (error) {
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? DEFAULT_JOB_OPTIONS.attempts ?? 5)) {
        await this.pipeline.markFailed(job.data.rawMessageId, error);
      }
      throw error;
    }
  }
}

@Processor("resolve-url")
export class ResolveUrlProcessor extends PipelineProcessor {
  constructor(
    @Inject(PersistentPipelineService) pipeline: PersistentPipelineService,
    @InjectQueue("parse") private readonly next: Queue<PipelineJobData>
  ) {
    super(pipeline);
  }
  async process(job: Job<PipelineJobData>) {
    await this.run(job, async () => {
      await this.pipeline.resolveUrl(job.data.rawMessageId, job.data.version);
      await this.next.add("parse", job.data, {
        ...DEFAULT_JOB_OPTIONS,
        jobId: deterministicJobId("parse", job.data.rawMessageId, job.data.version)
      });
    });
  }
}

@Processor("parse")
export class ParseProcessor extends PipelineProcessor {
  constructor(
    @Inject(PersistentPipelineService) pipeline: PersistentPipelineService,
    @InjectQueue("consolidate") private readonly next: Queue<PipelineJobData>
  ) {
    super(pipeline);
  }
  async process(job: Job<PipelineJobData>) {
    await this.run(job, async () => {
      if (!(await this.pipeline.parse(job.data.rawMessageId, job.data.version))) return;
      await this.next.add("consolidate", job.data, {
        ...DEFAULT_JOB_OPTIONS,
        jobId: deterministicJobId("consolidate", job.data.rawMessageId, job.data.version)
      });
    });
  }
}

@Processor("consolidate")
export class ConsolidateProcessor extends PipelineProcessor {
  constructor(
    @Inject(PersistentPipelineService) pipeline: PersistentPipelineService,
    @InjectQueue("score") private readonly next: Queue<PipelineJobData>
  ) {
    super(pipeline);
  }
  async process(job: Job<PipelineJobData>) {
    await this.run(job, async () => {
      if (!(await this.pipeline.consolidate(job.data.rawMessageId))) return;
      await this.next.add("score", job.data, {
        ...DEFAULT_JOB_OPTIONS,
        jobId: deterministicJobId("score", job.data.rawMessageId, job.data.version)
      });
    });
  }
}

@Processor("score")
export class ScoreProcessor extends PipelineProcessor {
  constructor(
    @Inject(PersistentPipelineService) pipeline: PersistentPipelineService,
    @InjectQueue("notify") private readonly next: Queue<PipelineJobData>
  ) {
    super(pipeline);
  }
  async process(job: Job<PipelineJobData>) {
    await this.run(job, async () => {
      await this.pipeline.scoreAffected(job.data.rawMessageId);
      await this.next.add("notify", job.data, {
        ...DEFAULT_JOB_OPTIONS,
        jobId: deterministicJobId("notify", job.data.rawMessageId, job.data.version)
      });
    });
  }
}

@Processor("notify")
export class NotifyProcessor extends PipelineProcessor {
  constructor(@Inject(PersistentPipelineService) pipeline: PersistentPipelineService) {
    super(pipeline);
  }
  async process(job: Job<PipelineJobData>) {
    await this.run(job, async () => this.pipeline.notify(job.data.rawMessageId));
  }
}
