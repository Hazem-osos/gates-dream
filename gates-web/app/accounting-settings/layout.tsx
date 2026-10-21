import { AccountingSettingsModuleChrome } from '@/components/accounting-settings';

export default function AccountingSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AccountingSettingsModuleChrome>{children}</AccountingSettingsModuleChrome>;
}
