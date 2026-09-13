'use client';

import { usePathname } from 'next/navigation';
import { ScreenHelpButton } from '@/components/ai/ScreenHelpButton';
import { CrudButtons, type CrudMenuItem } from '@/components/ui/CrudButtons';
import { resolveAiScreenContext } from '@/lib/ai/screen-context';
import { useRegisterScreenChrome } from './AppScreenChromeContext';

export type AppScreenToolbarProps = {
  title?: string;
  onPrevious?: () => void;
  previousLabel?: string;
  onAdd?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  menuItems?: CrudMenuItem[];
  extraItems?: CrudMenuItem[];
};

export function AppScreenToolbarButtons({
  title,
  onPrevious,
  previousLabel,
  onAdd,
  onEdit,
  onDelete,
  menuItems,
  extraItems,
}: AppScreenToolbarProps) {
  const pathname = usePathname();
  const screenTitle = title?.trim() || resolveAiScreenContext(pathname ?? '').pageTitle || 'هذه الشاشة';

  return (
    <div className="inline-flex flex-wrap items-center gap-2" data-app-screen-toolbar dir="rtl">
      <ScreenHelpButton screenTitle={screenTitle} />
      <CrudButtons
        onPrevious={onPrevious}
        previousLabel={previousLabel}
        onAdd={onAdd}
        onEdit={onEdit}
        onDelete={onDelete}
        items={menuItems}
        extraItems={extraItems}
      />
    </div>
  );
}

export function AppScreenToolbar(props: AppScreenToolbarProps) {
  useRegisterScreenChrome();
  return <AppScreenToolbarButtons {...props} />;
}
