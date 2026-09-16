'use client';

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function ShowFxColumnsField({ checked, onChange, disabled, compact }: Props) {
  return (
    <label className={`flex items-center gap-2 text-sm text-[#094C6B] ${compact ? 'h-9' : ''}`}>
      <input
        type="checkbox"
        className="h-4 w-4 accent-[#0E79AA]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      إظهار أعمدة العملة وسعر الصرف
    </label>
  );
}
