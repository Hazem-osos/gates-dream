'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import GlobalApiErrorToast from '@/components/GlobalApiErrorToast';
import { VersionConflictDialog } from '@/components/concurrency/VersionConflictDialog';
import GlobalApiSuccessToast from '@/components/GlobalApiSuccessToast';
import { AppToaster } from '@/components/feedback/AppToaster';
import { TenantBootstrap } from '@/lib/providers/TenantBootstrap';
import { ClientSearchIndexSync } from '@/lib/providers/ClientSearchIndexSync';
import { AbortRuntimeGuard } from '@/lib/providers/AbortRuntimeGuard';
import { createAppQueryClient } from '@/lib/query/query-client';
import { MutationActivityPill } from '@/components/feedback/MutationActivityPill';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createAppQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AbortRuntimeGuard>
        <TenantBootstrap>
          <ClientSearchIndexSync />
          {children}
          <MutationActivityPill />
          <AppToaster />
          <GlobalApiErrorToast />
          <VersionConflictDialog />
          <GlobalApiSuccessToast />
        </TenantBootstrap>
      </AbortRuntimeGuard>
    </QueryClientProvider>
  );
}

