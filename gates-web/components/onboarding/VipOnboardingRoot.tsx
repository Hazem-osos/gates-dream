'use client';

import { useRouter } from 'next/navigation';
import { SandboxBanner } from '@/components/dashboard/SandboxBanner';
import { QuickWinsDock } from '@/components/onboarding/QuickWinsDock';
import { VipWelcomeModal } from '@/components/onboarding/VipWelcomeModal';
import { useOnboardingState } from '@/lib/hooks/useOnboardingState';
import { useProductTourContext } from '@/components/onboarding/ProductTourProvider';

export function VipOnboardingRoot() {
  const router = useRouter();
  const { openAcademy } = useProductTourContext();
  const {
    ready,
    showWelcome,
    sandboxMode,
    wins,
    completedWins,
    dockMinimized,
    persona,
    displayName,
    companyName,
    dismissOnboarding,
    enableSandboxMode,
    completeQuickWin,
    setDockMinimized,
    journeyActive,
  } = useOnboardingState();

  if (!ready) return null;

  const showDock = !showWelcome && (journeyActive || sandboxMode);

  return (
    <>
      <SandboxBanner active={sandboxMode} onClear={() => enableSandboxMode(false)} />
      <VipWelcomeModal
        open={showWelcome}
        displayName={displayName}
        companyName={companyName}
        persona={persona}
        onExplore={() => {
          void dismissOnboarding();
          openAcademy();
          router.push('/academy');
        }}
        onSandbox={() => {
          enableSandboxMode(true);
          router.push('/dashboard');
        }}
        onDismiss={() => {
          void dismissOnboarding();
        }}
      />
      {showDock && !showWelcome ? (
        <QuickWinsDock
          persona={persona}
          wins={wins}
          completedWins={completedWins}
          minimized={dockMinimized}
          onMinimize={setDockMinimized}
          onComplete={completeQuickWin}
        />
      ) : null}
    </>
  );
}
