'use client';

type Props = {
  onMouseDown: (event: React.MouseEvent) => void;
};

/** Drag handle on the inner edge between columns (RTL tables). */
export function ColumnResizeHandle({ onMouseDown }: Props) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label="تغيير عرض العمود"
      className="absolute left-0 top-0 z-30 h-full w-2 -translate-x-1/2 cursor-col-resize touch-none hover:bg-white/25 active:bg-white/40"
      onMouseDown={onMouseDown}
      onClick={(event) => event.stopPropagation()}
    />
  );
}
