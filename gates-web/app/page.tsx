'use client';

import { MarketingShell } from '../components/marketing/MarketingShell';
import { OpeningJourney } from '../components/cinematic/OpeningJourney';
import { ProductScaleJourney } from '../components/cinematic/ProductScaleJourney';

/**
 * Official GATES marketing homepage.
 * Act 1: connect / react.
 * Act 2: enter GATES → product camera → HQ → locations.
 * Act 3: after the sale — retail, briefing, draft purchase, live network.
 * Later chapters (Egypt, industries, finale) are not in this iteration.
 */
export default function MarketingHomePage() {
  return (
    <MarketingShell>
      <OpeningJourney />
      <ProductScaleJourney />
    </MarketingShell>
  );
}
