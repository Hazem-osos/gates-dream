/** TanStack Query cache tiers — master/reference vs transactional documents. */

export const cachePolicies = {
  master: {
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  },
  transactional: {
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  },
  /** Default for hooks that do not specify a tier. */
  defaultQuery: {
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  },
} as const;
