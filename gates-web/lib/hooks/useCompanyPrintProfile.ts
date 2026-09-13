'use client';

import { useApiQuery } from '@/lib/hooks/useApi';
import type { CompanyPrintProfile } from '@/lib/print/types';

type CompanyCurrent = {
  nameAr: string;
  nameEn?: string | null;
  taxRegistrationNumber?: string | null;
  commercialRegister?: string | null;
  logoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

export function useCompanyPrintProfile() {
  const { data, isLoading } = useApiQuery<CompanyCurrent>(
    ['company-current-print'],
    '/company/current',
    undefined,
    { staleTime: 120_000 }
  );
  const c = data?.data;
  const profile: CompanyPrintProfile | undefined = c
    ? {
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        taxRegistrationNumber: c.taxRegistrationNumber,
        commercialRegister: c.commercialRegister,
        logoUrl: c.logoUrl,
        phone: c.phone,
        email: c.email,
        address: c.address,
      }
    : undefined;
  return { profile, isLoading };
}
