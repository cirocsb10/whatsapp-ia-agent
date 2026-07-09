import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { EMAIL_QUEUE, EMAIL_SEND_JOB } from "./email-queue.constants";

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
}

/**
 * Único ponto de entrada para envio de emails "do sistema".
 * Enfileira o job (assíncrono, com retry). Injetável por outros módulos
 * (billing, onboarding) no futuro.
 */
@Injectable()
export class PlatformEmailService {
  constructor(
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue,
  ) {}

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    await this.emailQueue.add(
      EMAIL_SEND_JOB,
      { to, subject, html } satisfies EmailJobData,
      { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
    );
  }
}
