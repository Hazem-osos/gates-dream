import { Geist, IBM_Plex_Sans_Arabic } from 'next/font/google';
import '@/lib/i18n/english-digits';
import './global.css';
import { RootFrame } from './RootFrame';
import { I18nProvider } from '@/lib/i18n';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
});

const ibmArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-arabic',
});

const bootScript = `
(function(){
  try {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
    var loc = localStorage.getItem('gates:locale') || localStorage.getItem('gates-marketing-locale') || 'ar';
    if (loc !== 'en' && loc !== 'ar') loc = 'ar';
    document.documentElement.lang = loc;
    document.documentElement.dir = loc === 'ar' ? 'rtl' : 'ltr';
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className={`${geist.variable} ${ibmArabic.variable} antialiased`} suppressHydrationWarning>
        <I18nProvider>
          <RootFrame>{children}</RootFrame>
        </I18nProvider>
      </body>
    </html>
  );
}
