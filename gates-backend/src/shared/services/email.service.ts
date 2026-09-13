import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../logger';

export interface EmailAttachment {
  filename: string;
  path: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

/**
 * L4 fix (Item 41): centralized SMTP email sender.
 *
 * `reports.processor.ts`'s `sendReportEmail` used to be a stub that only
 * logged the attempt and never actually sent mail — any workflow that
 * depended on "email me this report" silently did nothing while reporting
 * success. This service is the one real transport; other modules needing
 * outbound email (e.g. future notification digests) should reuse it rather
 * than growing their own ad hoc stub.
 *
 * SMTP is optional configuration (see `.env.example`): when `SMTP_HOST` is
 * unset, `isEmailConfigured()` returns false and callers should treat
 * sending as a no-op/log-only fallback instead of throwing, so environments
 * that never configured mail (most local dev boxes) don't hard-fail jobs
 * that merely attempted to email a report.
 */
class EmailService {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter | null {
    if (!env.SMTP_HOST) {
      return null;
    }
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: env.SMTP_USER
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS,
            }
          : undefined,
      });
    }
    return this.transporter;
  }

  isEmailConfigured(): boolean {
    return Boolean(env.SMTP_HOST);
  }

  async sendEmail(input: SendEmailInput): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) {
      logger.warn(
        { to: input.to, subject: input.subject },
        'SMTP not configured (SMTP_HOST unset) — email not sent'
      );
      return;
    }

    await transporter.sendMail({
      from: env.SMTP_FROM || env.SMTP_USER,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments,
    });
  }
}

export const emailService = new EmailService();
