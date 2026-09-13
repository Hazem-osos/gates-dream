import { randomBytes } from 'node:crypto';

export type LocalUploadTicket = {
  token: string;
  attachmentId: string;
  companyId: string;
  storagePathKey: string;
  mimeType: string;
  maxBytes: number;
  expiresAt: number;
};

const tickets = new Map<string, LocalUploadTicket>();

const DEFAULT_TTL_MS = 15 * 60 * 1000;

export function issueLocalUploadTicket(input: {
  attachmentId: string;
  companyId: string;
  storagePathKey: string;
  mimeType: string;
  maxBytes: number;
  ttlMs?: number;
}): LocalUploadTicket {
  const token = randomBytes(24).toString('hex');
  const ticket: LocalUploadTicket = {
    token,
    attachmentId: input.attachmentId,
    companyId: input.companyId,
    storagePathKey: input.storagePathKey,
    mimeType: input.mimeType,
    maxBytes: input.maxBytes,
    expiresAt: Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS),
  };
  tickets.set(token, ticket);
  return ticket;
}

export function consumeLocalUploadTicket(token: string): LocalUploadTicket | null {
  const ticket = tickets.get(token);
  if (!ticket) return null;
  if (ticket.expiresAt < Date.now()) {
    tickets.delete(token);
    return null;
  }
  tickets.delete(token);
  return ticket;
}

export function peekLocalUploadTicket(token: string): LocalUploadTicket | null {
  const ticket = tickets.get(token);
  if (!ticket || ticket.expiresAt < Date.now()) {
    if (ticket) tickets.delete(token);
    return null;
  }
  return ticket;
}
