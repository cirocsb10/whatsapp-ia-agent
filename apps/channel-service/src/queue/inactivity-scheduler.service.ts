import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { INACTIVITY_QUEUE } from "./queue.constants";
import { InactivityJobData } from "./inactivity.types";

@Injectable()
export class InactivitySchedulerService {
  constructor(
    @InjectQueue(INACTIVITY_QUEUE) private readonly queue: Queue,
  ) {}

  private jobId(conversationId: string): string {
    return `inactivity-${conversationId}`;
  }

  async schedule(
    data: Omit<InactivityJobData, "phase" | "scheduledAt">,
    delayMs: number,
  ): Promise<void> {
    const jobId = this.jobId(data.conversationId);
    await this.queue.remove(jobId);
    await this.queue.add(
      "check-inactivity",
      { ...data, phase: "warn" as const, scheduledAt: Date.now() },
      {
        jobId,
        delay: delayMs,
        attempts: 2,
        backoff: { type: "fixed", delay: 5000 },
      },
    );
  }

  async scheduleClose(data: InactivityJobData, delayMs: number): Promise<void> {
    const jobId = this.jobId(data.conversationId);
    await this.queue.remove(jobId);
    await this.queue.add(
      "check-inactivity",
      { ...data, phase: "close" as const, scheduledAt: Date.now() },
      {
        jobId,
        delay: delayMs,
        attempts: 2,
        backoff: { type: "fixed", delay: 5000 },
      },
    );
  }

  async cancel(conversationId: string): Promise<void> {
    await this.queue.remove(this.jobId(conversationId));
  }
}
