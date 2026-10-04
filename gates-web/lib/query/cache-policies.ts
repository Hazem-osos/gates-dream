/** TanStack Query cache tiers — master/reference vs transactional documents. */

export const cachePolicies = {
  master: {
    staleTime: 0,
    gcTime: 30 * 60 * 1000,
  },
  transactional: {
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
  },
  /** Default for hooks that do not specify a tier. */
  defaultQuery: {
    staleTime: 0,
    gcTime: 15 * 60 * 1000,
  },
} as const;
