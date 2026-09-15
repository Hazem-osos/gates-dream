import { Geist } from 'next/font/google';
import './global.css';
import { RootFrame } from './RootFrame';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${geist.variable} antialiased`} suppressHydrationWarning>
        <RootFrame>{children}</RootFrame>
      </body>
    </html>
  );
}
