import { useApiQuery } from '@/lib/hooks/useApi';

/** First active company (common pattern for company-scoped settings). */
export function useFirstCompany() {
  const { data, isLoading, isError, error, refetch } = useApiQuery<
    { id: string; arabicName?: string; code?: string }[]
  >(['companies', 'first'], '/companies', { page: 1, limit: 1, isActive: true });

  const company = data?.data?.[0];
  return {
    companyId: company?.id,
    company,
    isLoading,
    isError,
    error,
    refetch,
  };
}
