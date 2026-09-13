import { Cairo } from 'next/font/google';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-subcontracts',
  display: 'swap',
});

export default function SubcontractsLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${cairo.variable} ${cairo.className}`}>{children}</div>;
}
