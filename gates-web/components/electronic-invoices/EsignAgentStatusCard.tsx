'use client';

import { useCallback, useEffect, useState } from 'react';
import { FormSectionCard } from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { useApiQuery } from '@/lib/hooks/useApi';
import { useI18n } from '@/lib/i18n';
import {
  mapEsignAgentStatus,
  probeLocalEsignAgent,
  resolveEsignDownloadUrl,
  type EsignAgentHealth,
  type EsignAgentRelease,
  type EsignAgentUiStatus,
} from '@/lib/electronic-invoices/esign-agent';
import { pairLocalEsignAgent } from '@/lib/electronic-invoices/esign-local-sign';

const POLL_MS = 15_000;

type PairingStart = {
  pairingSessionId: string;
  companyId: string;
  challenge: string;
  deviceCredential: string;
  expiresAt: string;
};

export function EsignAgentStatusCard() {
  const { t } = useI18n();
  const releaseQuery = useApiQuery<EsignAgentRelease>(
    ['esign-agent-latest'],
    '/electronic-invoices/esign-agent/latest',
    undefined,
    { staleTime: 60_000, refetchOnMount: false }
  );
  const release = releaseQuery.data?.data;
  const [ui, setUi] = useState<EsignAgentUiStatus>('checking');
  const [health, setHealth] = useState<EsignAgentHealth | null>(null);
  const [pairing, setPairing] = useState(false);
  const [pairError, setPairError] = useState('');

  const check = useCallback(async () => {
    const result = await probeLocalEsignAgent();
    setHealth(result.health ?? null);
    setUi(
      mapEsignAgentStatus({
        health: result.health,
        error: result.error,
        minVersion: release?.minCompatibleVersion || release?.version,
      })
    );
  }, [release?.minCompatibleVersion, release?.version]);

  useEffect(() => {
    if (pairing) return;
    void check();
    const id = window.setInterval(() => {
      void check();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [check, pairing]);

  const pair = async () => {
    if (!health?.deviceId || pairing) return;
    setPairing(true);
    setPairError('');
    try {
      const started = await apiClient.post<PairingStart>('/electronic-invoices/esign-agent/pairing/start', {
        deviceId: health.deviceId,
      });
      const challenge = started.data;
      if (!challenge?.pairingSessionId || !challenge.deviceCredential || !challenge.challenge) {
        setPairError('PAIRING_INVALID');
        return;
      }
      const local = await pairLocalEsignAgent(challenge);
      if (local && 'success' in local && local.success === false) {
        setPairError(local.code === 'AGENT_UNREACHABLE' ? t('esignAgent.pairUnreachable') : local.code);
        return;
      }
      if (!local || !('deviceId' in local)) {
        setPairError(t('esignAgent.pairUnreachable'));
        return;
      }
      await apiClient.post('/electronic-invoices/esign-agent/pairing/complete', {
        pairingSessionId: challenge.pairingSessionId,
        deviceId: local.deviceId,
        proof: local.proof,
      });
      await check();
    } catch (error) {
      setPairError(error instanceof Error ? error.message : t('esignAgent.pairFailed'));
    } finally {
      setPairing(false);
    }
  };

  const revoke = async () => {
    if (!health?.deviceId) return;
    await apiClient.post('/electronic-invoices/esign-agent/pairing/revoke', { deviceId: health.deviceId });
    await check();
  };

  const downloadHref = resolveEsignDownloadUrl(release);
  const connected = ui === 'connected';
  const needsDownload = ui === 'unreachable' || ui === 'tls' || ui === 'origin_rejected' || ui === 'outdated';
  const needsPairing = ui === 'needs_pairing';

  return (
    <FormSectionCard title={t('esignAgent.title')} subtitle={t('esignAgent.subtitle')} bodyClassName="grid-cols-1">
      <div className="space-y-3 text-sm">
        {ui === 'checking' ? <p className="text-foreground-muted">{t('esignAgent.checking')}</p> : null}

        {ui === 'unreachable' || ui === 'tls' || ui === 'origin_rejected' ? (
          <div className="space-y-2">
            <p className="font-semibold text-brand">{t('esignAgent.disconnected')}</p>
            <p className="text-foreground-muted">
              {ui === 'tls' ? t('esignAgent.tlsHelp') : t('esignAgent.notRunning')}
            </p>
          </div>
        ) : null}

        {ui === 'outdated' ? <p className="font-semibold text-brand">{t('esignAgent.updateRequired')}</p> : null}

        {needsPairing && health ? (
          <div className="space-y-1">
            <p className="font-semibold text-brand">{t('esignAgent.needsPairing')}</p>
            <p>
              {t('esignAgent.version')}: {health.version}
            </p>
          </div>
        ) : null}

        {connected && health ? (
          <div className="space-y-1">
            <p className="font-semibold text-brand">
              {t('esignAgent.product')} — {t('esignAgent.connected')}
            </p>
            <p>
              {t('esignAgent.version')}: {health.version}
            </p>
            <p>
              {t('esignAgent.token')}:{' '}
              {health.tokenConnected ? t('esignAgent.tokenConnected') : t('esignAgent.tokenDisconnected')}
            </p>
            <p className="text-foreground-muted">{t('esignAgent.paired')}</p>
          </div>
        ) : null}

        {pairing ? <p className="text-foreground-muted">{t('esignAgent.pairing')}</p> : null}
        {pairError ? <p className="text-xs text-red-600">{pairError}</p> : null}

        <div className="flex flex-wrap gap-2 pt-1">
          {needsDownload || pairError ? (
            <a
              href={downloadHref}
              download="GatesESignSetup.exe"
              className="inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
            >
              {ui === 'outdated' ? t('esignAgent.downloadUpdate') : t('esignAgent.downloadWindows')}
            </a>
          ) : null}
          {needsPairing ? (
            <button
              type="button"
              disabled={pairing}
              onClick={() => void pair()}
              className="inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
            >
              {pairing ? t('esignAgent.pairing') : t('esignAgent.pairDevice')}
            </button>
          ) : null}
          {connected ? (
            <button
              type="button"
              onClick={() => void revoke()}
              className="inline-flex items-center rounded-lg border border-brand/30 px-4 py-2 text-sm font-semibold text-brand"
            >
              {t('esignAgent.revokePairing')}
            </button>
          ) : null}
          <button
            type="button"
            disabled={pairing}
            onClick={() => void check()}
            className="inline-flex items-center rounded-lg border border-brand/30 px-4 py-2 text-sm font-semibold text-brand"
          >
            {t('esignAgent.checkAgain')}
          </button>
        </div>
        {needsDownload ? <p className="text-xs text-foreground-muted">{t('esignAgent.alreadyInstalled')}</p> : null}
      </div>
    </FormSectionCard>
  );
}
