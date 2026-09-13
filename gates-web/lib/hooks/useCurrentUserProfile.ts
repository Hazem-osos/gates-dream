'use client';

import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import {
  formatUserDisplayName,
  resolveUserAvatarSrc,
  type UserProfile,
} from '@/lib/user/profile';

export function useCurrentUserProfile() {
  const { data, isLoading, isFetching } = useApiQuery<UserProfile>(
    [...queryKeys.userMe],
    '/users/me',
    undefined,
    {
      staleTime: staleTimes.profileMs,
      refetchOnWindowFocus: false,
      retry: 1,
    }
  );

  const profile = data?.data;

  return {
    profile,
    isLoading: isLoading && !profile,
    isFetching,
    displayName: profile ? formatUserDisplayName(profile) : '',
    email: profile?.email ?? '',
    avatarSrc: resolveUserAvatarSrc(profile?.avatarUrl),
  };
}
