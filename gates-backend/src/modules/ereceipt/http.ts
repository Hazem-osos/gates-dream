import { resolveEtaEndpoints } from '../electronic-invoices/utils/eta-endpoints';
import { ERECEIPT_PATHS } from './limits';
import { redactEreceiptLog } from './errors';
import { logger } from '../../shared/logger';

export type HttpResult = {
  status: number;
  body: unknown;
  retryAfter: string | null;
};

export type EreceiptTransport = {
  request(input: {
    url: string;
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    body?: string;
  }): Promise<HttpResult>;
};

export const fetchTransport: EreceiptTransport = {
  async request(input) {
    const response = await fetch(input.url, {
      method: input.method,
      headers: input.headers,
      body: input.body,
    });
    const text = await response.text();
    let body: unknown = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { message: text.slice(0, 300) };
      }
    }
    return { status: response.status, body, retryAfter: response.headers.get('retry-after') };
  },
};

let transport: EreceiptTransport = fetchTransport;

export function setEreceiptTransport(next: EreceiptTransport | null): void {
  transport = next ?? fetchTransport;
}

export function etaBases(environment: string) {
  return resolveEtaEndpoints({
    environment: environment === 'PRODUCTION' ? 'PRODUCTION' : 'PREPRODUCTION',
  });
}

export async function ereceiptRequest(input: {
  environment: string;
  path: string;
  method: 'GET' | 'POST';
  token?: string;
  body?: string;
  contentType?: string;
}): Promise<HttpResult> {
  const bases = etaBases(input.environment);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (input.body) headers['Content-Type'] = input.contentType ?? 'application/json';
  if (input.token) headers.Authorization = `Bearer ${input.token}`;
  try {
    return await transport.request({
      url: `${bases.apiBaseUrl}${input.path}`,
      method: input.method,
      headers,
      body: input.body,
    });
  } catch (error) {
    logger.warn({ environment: input.environment, path: input.path }, 'ETA eReceipt request failed before a response');
    return { status: 0, body: { message: error instanceof Error ? error.message : 'network' }, retryAfter: null };
  }
}

export async function requestPosToken(input: {
  environment: string;
  clientId: string;
  clientSecret: string;
  posSerial: string;
  posOsVersion: string;
  posModelFramework: string;
  presharedKey: string;
}): Promise<HttpResult> {
  const bases = etaBases(input.environment);
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: input.clientId,
    client_secret: input.clientSecret,
  }).toString();
  try {
    return await transport.request({
      url: bases.identityUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        posserial: input.posSerial,
        pososversion: input.posOsVersion,
        posmodelframework: input.posModelFramework,
        presharedkey: input.presharedKey,
      },
      body,
    });
  } catch (error) {
    logger.warn(
      redactEreceiptLog({ environment: input.environment, clientId: input.clientId }),
      'ETA POS token request failed before a response'
    );
    return { status: 0, body: { message: error instanceof Error ? error.message : 'network' }, retryAfter: null };
  }
}

export { ERECEIPT_PATHS };
