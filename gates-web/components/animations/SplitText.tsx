'use client';

type SplitTextProps = {
  text: string;
  className?: string;
  as?: 'h1' | 'h2' | 'p';
};

/** Line-level split (no Club SplitText). Each line is a clip target for the scene timeline. */
export function SplitText({ text, className = '', as: Tag = 'h1' }: SplitTextProps) {
  const lines = text.split('\n');
  return (
    <Tag className={className}>
      {lines.map((line) => (
        <span key={line} className="block overflow-hidden">
          <span data-split-line className="block">
            {line}
          </span>
        </span>
      ))}
    </Tag>
  );
}
