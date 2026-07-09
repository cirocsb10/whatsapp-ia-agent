import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PlatformSmtpSettingsService } from "../platform-smtp-settings.service";
import { buildTransporter, formatFrom } from "../../../common/mail/smtp-transporter.util";
import { EMAIL_QUEUE } from "../email-queue.constants";
import type { EmailJobData } from "../platform-email.service";

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly smtpSettings: PlatformSmtpSettingsService) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const config = await this.smtpSettings.getSettingsForSending();

    if (!config) {
      this.logger.warn("SMTP não configurado — job de e-mail não pode ser processado");
      throw new Error("SMTP não configurado");
    }

    const { to, subject, html } = job.data;
    const transporter = buildTransporter(config);

    await transporter.sendMail({
      from: formatFrom(config.fromName, config.fromEmail),
      to,
      subject,
      html,
    });

    this.logger.log(`E-mail enviado para ${to}`);
  }
}
