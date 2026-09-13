import React from "react";

interface ReportConditionsChipsProps {
  conditions: string[];
  onRemove: (index: number) => void;
}

const LABELS = [
  "قراءة القيود الغير مرحلة",
  "قراءة الأقلام المؤيدة",
  "قراءة الأقلام الغير المؤيدة",
  "كلاهما",
  "قراءة الأقلام غير المراجعة",
  "قراءة القيود الغير مرحلة",
  "قراءة الأقلام المؤيدة",
  "قراءة الأقلام الغير المؤيدة",
  "كلاهما",
  "قراءة الأقلام غير المراجعة",
  "قراءة القيود الغير مرحلة",
  "قراءة الأقلام المؤيدة",
  "قراءة الأقلام الغير المؤيدة",
  "كلاهما",
  "قراءة الأقلام غير المراجعة",
  "قراءة القيود الغير مرحلة",
  "قراءة الأقلام المؤيدة",
  "قراءة الأقلام الغير المؤيدة",
  "كلاهما",
  "قراءة الأقلام غير المراجعة",
];

const ReportConditionsChips: React.FC<ReportConditionsChipsProps> = ({ conditions, onRemove }) => {
  const columnsPerRow = 5;
  return (
    <div className="grid grid-cols-5 gap-4 w-full mt-4">
      {conditions.map((_, idx) => {
        const label = LABELS[idx % columnsPerRow];
        return (
          <div
            key={idx}
            className="flex items-center justify-between bg-[#EAF6FB] rounded-xl px-4  py-2 text-[#0E78AA] font-medium text-base gap-4 min-w-[200px]"
          >
            <span className="truncate">{label}</span>
            <button
              type="button"
              className="ml-2 text-[#0E78AA] hover:text-red-500 text-xl focus:outline-none"
              onClick={() => onRemove(idx)}
              aria-label="حذف الشرط"
            >
              
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ReportConditionsChips; 