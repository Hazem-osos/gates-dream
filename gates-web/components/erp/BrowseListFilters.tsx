const controlClass =
  'h-9 rounded-lg border border-[#D6EAF3] bg-white px-2 text-sm text-[#094C6B]';

export function BrowseDateRangeFilters({
  startDate,
  endDate,
  onStartDate,
  onEndDate,
}: {
  startDate: string;
  endDate: string;
  onStartDate: (value: string) => void;
  onEndDate: (value: string) => void;
}) {
  return (
    <>
      <input
        type="date"
        value={startDate}
        onChange={(e) => onStartDate(e.target.value)}
        className={controlClass}
        aria-label="من تاريخ"
        title="من تاريخ"
      />
      <input
        type="date"
        value={endDate}
        onChange={(e) => onEndDate(e.target.value)}
        className={controlClass}
        aria-label="إلى تاريخ"
        title="إلى تاريخ"
      />
    </>
  );
}

export function BrowseStatusFilter<T extends string>({
  value,
  onChange,
  options,
  'aria-label': ariaLabel = 'الحالة',
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  'aria-label'?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={controlClass}
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
