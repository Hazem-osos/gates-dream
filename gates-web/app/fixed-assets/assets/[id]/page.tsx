'use client';

import { useParams } from 'next/navigation';
import { AssetCardScreen } from '@/components/fixed-assets/AssetCardScreen';

export default function FixedAssetCardPage() {
  const params = useParams<{ id: string }>();
  return <AssetCardScreen assetId={String(params?.id ?? '')} />;
}
