/**
 * Tenant SMTP settings. The password is stored with the existing AES-256-GCM
 * helper and is never included in API responses or logs.
 */
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import prisma from '../../../shared/database/prisma';
import { decrypt, encrypt } from '../../../shared/security/secrets-manager';
import { logger } from '../../../shared/logger';

export interface CompanyEmailPublic {
  configured: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromEmail: string;
  fromName: string;
  passwordSet: boolean;
}

export interface CompanyEmailSaveInput {
  host: string;
  port: number;
  secure: boolean;
  username?: string;
  password?: string;
  fromEmail: string;
  fromName?: string;
}

export class CompanyEmailError extends Error {
  constructor(
    public readonly code:
      | 'EMAIL_NOT_CONFIGURED'
      | 'EMAIL_AUTH_FAILED'
      | 'EMAIL_SEND_FAILED'
      | 'EMAIL_RECIPIENT_INVALID',
    message: string,
    public readonly transient: boolean
  ) {
    super(message);
    this.name = 'CompanyEmailError';
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicView(row: {
  host: string;
  port: number;
  secure: boolean;
  username: string | null;
  fromEmail: string;
  fromName: string | null;
  passwordEncrypted: string | null;
} | null): CompanyEmailPublic {
  if (!row) {
    return {
      configured: false,
      host: '',
      port: 587,
      secure: false,
      username: '',
      fromEmail: '',
      fromName: '',
      passwordSet: false,
    };
  }
  return {
    configured: Boolean(row.host && row.fromEmail),
    host: row.host,
    port: row.port,
    secure: row.secure,
    username: row.username ?? '',
    fromEmail: row.fromEmail,
    fromName: row.fromName ?? '',
    passwordSet: Boolean(row.passwordEncrypted),
  };
}

export async function getCompanyEmailPublic(companyId: string): Promise<CompanyEmailPublic> {
  const row = await prisma.companyEmailConfig.findFirst({ where: { companyId } });
  return publicView(row);
}

export async function isCompanyEmailConfigured(companyId: string): Promise<boolean> {
  const view = await getCompanyEmailPublic(companyId);
  return view.configured;
}

export async function saveCompanyEmail(companyId: string, input: CompanyEmailSaveInput): Promise<CompanyEmailPublic> {
  const host = input.host.trim();
  const fromEmail = input.fromEmail.trim();
  if (!host || !fromEmail || !EMAIL_RE.test(fromEmail)) {
    throw new CompanyEmailError('EMAIL_RECIPIENT_INVALID', 'SMTP host and a valid from address are required', false);
  }
  if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) {
    throw new CompanyEmailError('EMAIL_NOT_CONFIGURED', 'SMTP port is invalid', false);
  }

  const existing = await prisma.companyEmailConfig.findFirst({ where: { companyId } });
  let passwordEncrypted = existing?.passwordEncrypted ?? null;
  if (typeof input.password === 'string' && input.password.length > 0) {
    passwordEncrypted = encrypt(input.password);
  }

  const data = {
    host,
    port: input.port,
    secure: input.secure,
    username: input.username?.trim() || null,
    passwordEncrypted,
    fromEmail,
    fromName: input.fromName?.trim() || null,
  };

  const saved = existing
    ? await prisma.companyEmailConfig.update({ where: { companyId }, data })
    : await prisma.companyEmailConfig.create({
        data: { id: crypto.randomUUID(), companyId, ...data },
      });
  return publicView(saved);
}

export async function sendCompanyEmail(
  companyId: string,
  input: { to: string; subject: string; text: string }
): Promise<{ provider: 'smtp'; messageId: string; recipient: string }> {
  const row = await prisma.companyEmailConfig.findFirst({ where: { companyId } });
  if (!row?.host || !row.fromEmail) {
    throw new CompanyEmailError('EMAIL_NOT_CONFIGURED', 'Company email is not configured', false);
  }

  let password: string | undefined;
  if (row.passwordEncrypted) {
    try {
      password = decrypt(row.passwordEncrypted);
    } catch (error) {
      logger.error({ companyId, code: 'EMAIL_AUTH_FAILED' }, 'Company SMTP secret could not be decrypted');
      throw new CompanyEmailError('EMAIL_AUTH_FAILED', 'SMTP credentials could not be read', false);
    }
  }

  const from = row.fromName ? `"${row.fromName.replace(/"/g, '')}" <${row.fromEmail}>` : row.fromEmail;
  try {
    const transport = nodemailer.createTransport({
      host: row.host,
      port: row.port,
      secure: row.secure,
      auth: row.username ? { user: row.username, pass: password } : undefined,
    });
    const sent = await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    return { provider: 'smtp', messageId: sent.messageId || '', recipient: input.to };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SMTP send failed';
    const authFailed = /auth|535|534|invalid login/i.test(message);
    const transient = !authFailed && /timeout|econn|etimedout|eai_again|421|450|451|452|4\d\d/i.test(message);
    logger.error({ companyId, code: authFailed ? 'EMAIL_AUTH_FAILED' : 'EMAIL_SEND_FAILED', transient }, 'Company email send failed');
    throw new CompanyEmailError(
      authFailed ? 'EMAIL_AUTH_FAILED' : 'EMAIL_SEND_FAILED',
      authFailed ? 'SMTP authentication failed' : 'SMTP send failed',
      transient
    );
  }
}
