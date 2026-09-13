'use client';

import { UserAvatar } from '@/app/components/UserAvatar';
import { useCurrentUserProfile } from '@/lib/hooks/useCurrentUserProfile';

type SidebarUserCardProps = {
  variant: 'collapsed' | 'expanded';
};

export function SidebarUserCard({ variant }: SidebarUserCardProps) {
  const { displayName, email, avatarSrc, isLoading } = useCurrentUserProfile();

  if (variant === 'collapsed') {
    return (
      <div>
        <UserAvatar
          src={avatarSrc}
          alt={displayName || 'المستخدم'}
          size={48}
          className="rounded-lg"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      <UserAvatar
        src={avatarSrc}
        alt={displayName || 'المستخدم'}
        size={56}
        className="rounded-lg border-2 border-[#DEEFF6]"
      />
      <div className="mt-2 text-center w-full px-2">
        <div className="font-semibold text-base text-[#094C6B] truncate">
          {isLoading ? '…' : displayName}
        </div>
        <div className="text-xs text-gray-500 truncate">{isLoading ? '…' : email}</div>
      </div>
    </div>
  );
}
