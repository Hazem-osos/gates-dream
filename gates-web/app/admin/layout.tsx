import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'GATES — إدارة المنصة',
  robots: { index: false, follow: false },
};

export default function PlatformAdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster richColors position="top-center" dir="rtl" toastOptions={{ style: { fontFamily: 'inherit' } }} />
    </>
  );
}
