'use client';

import Image from 'next/image';
import { DEFAULT_AVATAR_SRC } from '@/lib/user/profile';

type UserAvatarProps = {
  src: string;
  alt: string;
  size: number;
  className?: string;
};

export function UserAvatar({ src, alt, size, className = '' }: UserAvatarProps) {
  const resolved = src?.trim() || DEFAULT_AVATAR_SRC;
  const useNativeImg =
    resolved.startsWith('data:') ||
    resolved.startsWith('blob:') ||
    (resolved.startsWith('http') && !resolved.includes('cdn.builder.io'));

  if (useNativeImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolved}
        alt={alt}
        width={size}
        height={size}
        className={className}
        style={{ width: size, height: size, objectFit: 'cover' }}
      />
    );
  }

  return (
    <Image
      src={resolved}
      alt={alt}
      width={size}
      height={size}
      className={className}
      unoptimized={resolved === DEFAULT_AVATAR_SRC}
    />
  );
}
