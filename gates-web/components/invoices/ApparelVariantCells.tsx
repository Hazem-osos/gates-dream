'use client';

type Props = {
  color?: string;
  size?: string;
  suggestedColor?: string;
  suggestedSize?: string;
  onChange: (patch: { color?: string; size?: string }) => void;
  mode: 'color' | 'size';
  className?: string;
};

export function ApparelVariantCell({
  color,
  size,
  suggestedColor,
  suggestedSize,
  onChange,
  mode,
  className,
}: Props) {
  const value = mode === 'color' ? color : size;
  const suggestion = mode === 'color' ? suggestedColor : suggestedSize;
  const listId = mode === 'color' ? 'invoice-line-colors' : 'invoice-line-sizes';

  return (
    <div className={className}>
      <input
        list={suggestion ? listId : undefined}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
        placeholder={mode === 'color' ? 'اللون' : 'المقاس'}
        value={value ?? ''}
        onChange={(e) =>
          onChange(mode === 'color' ? { color: e.target.value } : { size: e.target.value })
        }
      />
      {suggestion ? (
        <datalist id={listId}>
          <option value={suggestion} />
        </datalist>
      ) : null}
    </div>
  );
}
