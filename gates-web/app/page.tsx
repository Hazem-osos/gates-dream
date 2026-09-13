'use client';

import dynamic from 'next/dynamic';
import { MarketingShell } from '../components/marketing/MarketingShell';
import { HeroSystem } from '../components/sections/HeroSystem';

const ConnectedBusiness = dynamic(() => import('../components/sections/ConnectedBusiness'));
const TransactionFlow = dynamic(() => import('../components/sections/TransactionFlow'));
const GatesStory = dynamic(() => import('../components/sections/GatesStory'));
const BusinessNetwork = dynamic(() => import('../components/sections/BusinessNetwork'));
const GatesAI = dynamic(() => import('../components/sections/GatesAI'));
const Industries = dynamic(() => import('../components/sections/Industries'));
const ProductShowcase = dynamic(() => import('../components/sections/ProductShowcase'));
const ScaleStats = dynamic(() => import('../components/sections/ScaleStats'));
const RegionalExpansion = dynamic(() => import('../components/sections/RegionalExpansion'));
const FinalCTA = dynamic(() => import('../components/sections/FinalCTA'));
const Footer = dynamic(() => import('../components/layout/Footer'));

/**
 * Official GATES marketing homepage.
 * Authenticated ERP landing is `/dashboard`. Login remains `/login`.
 * Phase 6: full narrative + polish.
 */
export default function MarketingHomePage() {
  return (
    <MarketingShell>
      <HeroSystem />
      <ConnectedBusiness />
      <TransactionFlow />
      <GatesStory />
      <BusinessNetwork />
      <GatesAI />
      <Industries />
      <ProductShowcase />
      <ScaleStats />
      <RegionalExpansion />
      <FinalCTA />
      <Footer />
    </MarketingShell>
  );
}
