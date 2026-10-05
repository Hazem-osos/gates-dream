import { ContractingRailwayDemoBar } from '@/components/contracting/ContractingRailwayDemoBar';

export default function ContractingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pb-6 pt-2 md:px-6">
      <ContractingRailwayDemoBar />
      {children}
    </div>
  );
}
