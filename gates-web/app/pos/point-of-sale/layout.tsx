import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'نقطة البيع',
};

export default function PointOfSaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
