import Image from 'next/image';

/** Local `/…` or remote URL; local SVGs use `unoptimized`. */
export function SidebarNavIcon({
  src,
  alt = '',
  className,
  width = 20,
  height = 20,
}: {
  src: string;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const remote = src.startsWith('http://') || src.startsWith('https://');
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      unoptimized={!remote}
    />
  );
}
