'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminToken } from '@/lib/platform-admin/api';

export default function PlatformAdminIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getAdminToken() ? '/admin/dashboard' : '/admin/login/access');
  }, [router]);
  return null;
}
