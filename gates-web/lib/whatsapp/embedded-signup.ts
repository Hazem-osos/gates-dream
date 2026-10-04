export type EmbeddedSignupNotice =
  | 'SUCCESS'
  | 'USER_CANCELLED'
  | 'POPUP_CLOSED'
  | 'INVALID_STATE'
  | 'CODE_EXPIRED'
  | 'META_AUTH_FAILED'
  | 'ACCOUNT_MISMATCH'
  | 'PHONE_MISMATCH';

export type EmbeddedSignupSession = {
  wabaId?: string;
  phoneNumberId?: string;
};

const FINISH_EVENTS = new Set([
  'FINISH',
  'FINISH_ONLY_WABA',
  'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
  'FINISH_OBO_MIGRATION',
  'FINISH_GRANT_ONLY_API_ACCESS',
]);

function facebookOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === 'facebook.com' || host.endsWith('.facebook.com');
  } catch {
    return false;
  }
}

export function interpretEmbeddedSignupMessage(
  origin: string,
  data: unknown
): { event: 'FINISH' | 'CANCEL' | 'ERROR'; finishEvent?: string; session?: EmbeddedSignupSession } | null {
  if (!facebookOrigin(origin)) return null;
  let payload: unknown = data;
  if (typeof data === 'string') {
    try {
      payload = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!payload || typeof payload !== 'object') return null;
  const row = payload as { type?: string; event?: string; data?: { waba_id?: string; phone_number_id?: string } };
  if (row.type !== 'WA_EMBEDDED_SIGNUP') return null;
  if (row.event === 'CANCEL') return { event: 'CANCEL' };
  if (row.event === 'ERROR') return { event: 'ERROR' };
  if (row.event && FINISH_EVENTS.has(row.event)) {
    return {
      event: 'FINISH',
      finishEvent: row.event,
      session: {
        wabaId: row.data?.waba_id,
        phoneNumberId: row.data?.phone_number_id,
      },
    };
  }
  return null;
}

export function selectableTemplates<T extends { usable: boolean }>(rows: T[]): T[] {
  return rows.filter((row) => row.usable);
}
