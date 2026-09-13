import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { MASTER_DATA_CACHE_CONTROL } from './http-cache-policy';
import { ACCEPT_ENCODING_VARY, appendVary } from './vary';

/** Opaque validator (quotes + optional weak prefix stripped). */
export function opaqueEtag(etag: string): string {
  return etag.trim().replace(/^W\//i, '').replace(/^"|"$/g, '');
}

export function buildWeakEtag(parts: (string | number | Date | null | undefined)[]): string {
  const raw = parts
    .map((p) => {
      if (p instanceof Date) return String(p.getTime());
      if (p == null) return '';
      return String(p);
    })
    .join(':');
  const digest = createHash('sha1').update(raw).digest('hex').slice(0, 16);
  return `W/"${digest}"`;
}

/** Strong ETag of a JSON payload (uncompressed representation). */
export function buildPayloadEtag(body: unknown): string {
  const digest = createHash('sha1').update(JSON.stringify(body)).digest('hex');
  return `"${digest}"`;
}

export function ifNoneMatchHit(req: Request, etag: string): boolean {
  const raw = req.headers['if-none-match'];
  if (!raw) return false;
  const incoming = Array.isArray(raw) ? raw.join(',') : raw;
  const trimmed = incoming.trim();
  if (trimmed === '*') return true;
  const target = opaqueEtag(etag);
  return trimmed.split(',').some((part) => {
    const token = part.trim();
    if (token === '*') return true;
    return opaqueEtag(token) === target;
  });
}

/**
 * Sets ETag + master-data Cache-Control. Returns true when the client already
 * has this representation (304 sent, empty body).
 */
export function applyMasterDataEtag(req: Request, res: Response, etag: string): boolean {
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', MASTER_DATA_CACHE_CONTROL);
  appendVary(res, ACCEPT_ENCODING_VARY);
  if (ifNoneMatchHit(req, etag)) {
    res.status(304).end();
    return true;
  }
  return false;
}

export function sendJsonWithEtag(req: Request, res: Response, etag: string, body: unknown): void {
  if (applyMasterDataEtag(req, res, etag)) return;
  res.json(body);
}
