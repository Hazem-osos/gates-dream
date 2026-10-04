'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import {
  compareSemver,
  GATES_ESIGN_PAIRING_MIN_VERSION,
  probeLocalEsignAgent,
} from '@/lib/electronic-invoices/esign-agent';
import { signWithLocalEsignAgent } from '@/lib/electronic-invoices/esign-local-sign';
import {
  canStartEtaSigning,
  ETA_SIGNING_COPY,
  type EtaSigningState,
} from '@/lib/electronic-invoices/eta-signing-state';

type AuthorizedSignSession = {
  signingSessionId: string;
  companyId: string;
  requestId: string;
  documentId: string;
  invoiceId: string;
  contentHash: string;
  canonicalPayload: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  authorization: string;
  operation: 'ETA_SIGN';
  display?: {
    companyName?: string;
    internalId?: string;
    amount?: string;
    documentType?: string;
  };
};

type CompleteResult = {
  localSigning?: string;
  etaSubmission?: string;
  document?: { status?: string };
};

type Props = {
  invoiceIds: string[];
  amended?: boolean;
  onClose: () => void;
  onFinished: (message: string) => void;
};

const AGENT_STATE: Record<string, EtaSigningState> = {
  AGENT_UNREACHABLE: 'SIGNER_NOT_INSTALLED',
  AGENT_VERSION_UNSUPPORTED: 'SIGNER_NOT_INSTALLED',
  AGENT_NOT_PAIRED: 'SIGNING_FAILED',
  TOKEN_NOT_FOUND: 'TOKEN_NOT_FOUND',
  CERTIFICATE_NOT_FOUND: 'CERTIFICATE_NOT_FOUND',
  USER_CANCELLED: 'USER_CANCELLED',
  TOKEN_LOGIN_FAILED: 'SIGNING_FAILED',
  SIGNING_SESSION_EXPIRED: 'SIGNING_FAILED',
  SIGNING_AUTHORIZATION_INVALID: 'SIGNING_FAILED',
  SIGNING_REQUEST_REPLAYED: 'SIGNING_FAILED',
  DOCUMENT_HASH_MISMATCH: 'SIGNING_FAILED',
  CADES_VERIFICATION_FAILED: 'SIGNING_FAILED',
  ETA_SUBMISSION_FAILED: 'SUBMISSION_FAILED',
};

export function EtaSignAndSendDialog({ invoiceIds, amended, onClose, onFinished }: Props) {
  const [state, setState] = useState<EtaSigningState>('IDLE');
  const [detail, setDetail] = useState('');
  const [retrySessionId, setRetrySessionId] = useState<string | null>(null);
  const busy = !canStartEtaSigning(state) && state !== 'IDLE';
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fail = (next: EtaSigningState, message: string) => {
    setState(next);
    setDetail(message);
  };

  const run = async () => {
    if (!canStartEtaSigning(state) && state !== 'IDLE') return;
    setState('PREPARING_DOCUMENT');
    setDetail(ETA_SIGNING_COPY.PREPARING_DOCUMENT);
    setRetrySessionId(null);

    try {
      const probe = await probeLocalEsignAgent();
      if (probe.error === 'tls') {
        fail('SIGNER_NOT_INSTALLED', ETA_SIGNING_COPY.SIGNER_NOT_INSTALLED);
        return;
      }
      if (!probe.health) {
        fail('SIGNER_NOT_INSTALLED', ETA_SIGNING_COPY.SIGNER_NOT_INSTALLED);
        return;
      }
      if (
        Number(probe.health.protocolVersion) !== 2 ||
        compareSemver(probe.health.version, GATES_ESIGN_PAIRING_MIN_VERSION) < 0
      ) {
        fail('SIGNER_NOT_INSTALLED', 'برنامج التوقيع يحتاج تحديث 1.1.3 قبل الإرسال.');
        return;
      }
      if (!probe.health.deviceId || probe.health.paired === false) {
        fail('SIGNING_FAILED', 'برنامج التوقيع متصل ويحتاج إلى الربط مع Gates من إعدادات الفاتورة الإلكترونية.');
        return;
      }
      if (probe.health.tokenConnected === false) {
        fail('TOKEN_NOT_FOUND', ETA_SIGNING_COPY.TOKEN_NOT_FOUND);
        return;
      }

      for (const invoiceId of invoiceIds) {
        setState('PREPARING_DOCUMENT');
        setDetail(ETA_SIGNING_COPY.PREPARING_DOCUMENT);
        const prepared = await apiClient.post<AuthorizedSignSession>(
          amended
            ? `/eta/documents/prepare-amendment/${invoiceId}`
            : `/eta/documents/prepare-sign/${invoiceId}`,
          { deviceId: probe.health.deviceId, signingMethod: 'LOCAL_USB_AGENT' }
        );
        const pack = prepared.data;
        if (!pack?.signingSessionId || !pack.canonicalPayload || !pack.authorization) {
          fail('SIGNING_FAILED', 'تعذر تجهيز مستند مصلحة الضرائب');
          return;
        }

        setState('WAITING_FOR_SIGNATURE');
        setDetail(ETA_SIGNING_COPY.WAITING_FOR_SIGNATURE);
        const signed = await signWithLocalEsignAgent({
          sessionId: pack.signingSessionId,
          documentId: pack.documentId,
          companyId: pack.companyId,
          documentType: pack.display?.documentType,
          canonicalPayload: pack.canonicalPayload,
          documentHash: pack.contentHash,
          nonce: pack.nonce,
          issuedAt: pack.issuedAt,
          expiresAt: pack.expiresAt,
          authorization: pack.authorization,
          operation: 'ETA_SIGN',
          display: pack.display,
        });
        if (signed.success === false) {
          fail(AGENT_STATE[signed.code] || 'SIGNING_FAILED', signed.code);
          return;
        }

        setState('SIGNED');
        setDetail(ETA_SIGNING_COPY.SIGNED);
        setState('SUBMITTING_TO_ETA');
        setDetail(ETA_SIGNING_COPY.SUBMITTING_TO_ETA);
        try {
          const submitted = await apiClient.post<CompleteResult>('/eta/documents/complete-sign', {
            signingSessionId: pack.signingSessionId,
            requestId: signed.requestId,
            documentHash: signed.documentHash,
            signature: signed.signature,
            certificateThumbprint: signed.certificateThumbprint,
          });
          const eta = String(submitted.data?.document?.status ?? submitted.data?.etaSubmission ?? '').toUpperCase();
          if (eta.includes('INVALID') || submitted.data?.etaSubmission === 'ETA_SUBMISSION_FAILED') {
            fail('REJECTED', ETA_SIGNING_COPY.REJECTED);
            return;
          }
        } catch (error) {
          setRetrySessionId(pack.signingSessionId);
          fail(
            'SUBMISSION_FAILED',
            error instanceof Error ? error.message : ETA_SIGNING_COPY.SUBMISSION_FAILED
          );
          return;
        }
      }

      setState('ACCEPTED');
      onFinished(
        invoiceIds.length > 1
          ? `تم توقيع وإرسال ${invoiceIds.length} مستندات`
          : 'تم توقيع المستند وإرساله لمصلحة الضرائب'
      );
    } catch (error) {
      fail(
        'SUBMISSION_FAILED',
        error instanceof Error ? error.message : ETA_SIGNING_COPY.SUBMISSION_FAILED
      );
    }
  };

  const retrySubmit = async () => {
    if (!retrySessionId) {
      void run();
      return;
    }
    setState('SUBMITTING_TO_ETA');
    setDetail(ETA_SIGNING_COPY.SUBMITTING_TO_ETA);
    try {
      const submitted = await apiClient.post<CompleteResult>(
        `/eta/documents/retry-submit/${retrySessionId}`,
        {}
      );
      const eta = String(submitted.data?.document?.status ?? '').toUpperCase();
      if (eta === 'INVALID') {
        fail('REJECTED', ETA_SIGNING_COPY.REJECTED);
        return;
      }
      setState('ACCEPTED');
      onFinished('تم إرسال المستند الموقّع لمصلحة الضرائب');
    } catch (error) {
      fail(
        'SUBMISSION_FAILED',
        error instanceof Error ? error.message : ETA_SIGNING_COPY.SUBMISSION_FAILED
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl" role="dialog" aria-modal>
        <h2 className="mb-2 text-base font-bold text-foreground">توقيع وإرسال لمصلحة الضرائب</h2>
        <p className="text-sm text-foreground-muted">{detail || ETA_SIGNING_COPY[state]}</p>
        {state === 'WAITING_FOR_SIGNATURE' ? (
          <p className="mt-2 text-sm text-foreground">{ETA_SIGNING_COPY.WAITING_FOR_SIGNATURE}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {canStartEtaSigning(state) && state !== 'IDLE' && state !== 'ACCEPTED' ? (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => {
                started.current = true;
                if (retrySessionId && state === 'SUBMISSION_FAILED') {
                  void retrySubmit();
                  return;
                }
                setState('IDLE');
                void run();
              }}
            >
              إعادة المحاولة
            </Button>
          ) : null}
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onClose}>
            إلغاء
          </Button>
        </div>
      </div>
    </div>
  );
}
