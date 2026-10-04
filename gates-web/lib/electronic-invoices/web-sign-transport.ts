/**
 * Official ITIDA Web-Sign Client transport.
 *
 * Verified from official material:
 * - Web-Sign Client is a desktop app installed on the user's Windows PC.
 * - The Smart Token stays on that PC.
 * - The official user manual says the browser may prompt to open Web-Sign / signsrv.
 * - ETA signing requires a Base64 CAdES-BES over the canonical document.
 *
 * NOT verified in this repository or official pages available to us:
 * - URI scheme / parameters
 * - localhost or WebSocket callback
 * - request/response JSON for passing a document and receiving the CAdES value
 *
 * Until ITIDA publishes that contract or it appears in Gates assets:
 * WEB_SIGN_TRANSPORT_CONTRACT_REQUIRED
 */

export const WEB_SIGN_TRANSPORT_CONTRACT_REQUIRED = 'WEB_SIGN_TRANSPORT_CONTRACT_REQUIRED' as const;

export const OFFICIAL_WEB_SIGN_DOWNLOAD_URL =
  'https://www.eta.gov.eg/ar/content/altwqy-alalktrwny';

export type WebSignInvokeResult =
  | { status: typeof WEB_SIGN_TRANSPORT_CONTRACT_REQUIRED }
  | { status: 'USER_CANCELLED' }
  | { status: 'SIGNER_NOT_INSTALLED' }
  | { status: 'TOKEN_NOT_FOUND' }
  | { status: 'CERTIFICATE_NOT_FOUND' }
  | { status: 'SIGNED'; signature: string };

export type WebSignInvokeInput = {
  contentHash: string;
  unsignedPayload: Record<string, unknown>;
};

export function officialWebSignDownloadUrl(): string {
  return OFFICIAL_WEB_SIGN_DOWNLOAD_URL;
}

export async function invokeOfficialWebSignClient(
  _input: WebSignInvokeInput
): Promise<WebSignInvokeResult> {
  return { status: WEB_SIGN_TRANSPORT_CONTRACT_REQUIRED };
}

export function isWebSignUnavailable(result: WebSignInvokeResult): boolean {
  return (
    result.status === WEB_SIGN_TRANSPORT_CONTRACT_REQUIRED ||
    result.status === 'SIGNER_NOT_INSTALLED'
  );
}
