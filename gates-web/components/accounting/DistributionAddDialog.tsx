'use client';

import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { STAFF_CARD_KINDS, type StaffCardKind } from '@/components/accounting/StaffCardKindDialog';

export type DistributionFolderRole = 'DRIVER' | 'DISTRIBUTOR' | 'DELEGATE';

type Step = 'folder' | 'node' | 'person';

const FOLDER_CHOICES: Array<{
  id: DistributionFolderRole;
  title: string;
  description: string;
}> = [
  { id: 'DRIVER', title: 'سائق', description: 'المجموعة أو الفرد ينزل تحت مجلد السائقين.' },
  { id: 'DISTRIBUTOR', title: 'موزع', description: 'المجموعة أو الفرد ينزل تحت مجلد الموزعين.' },
  { id: 'DELEGATE', title: 'مندوب', description: 'المجموعة أو الفرد ينزل تحت مجلد المندوبين.' },
];

type Props = {
  open: boolean;
  parentLabel?: string | null;
  folderRole?: DistributionFolderRole | null;
  step: Step;
  onStepChange: (step: Step) => void;
  onPickFolder: (role: DistributionFolderRole) => void;
  onPickGroup: () => void;
  onPickPerson: (kind: StaffCardKind) => void;
  onClose: () => void;
  canPickFolder?: boolean;
};

export function DistributionAddDialog({
  open,
  parentLabel,
  folderRole,
  step,
  onStepChange,
  onPickFolder,
  onPickGroup,
  onPickPerson,
  onClose,
  canPickFolder,
}: Props) {
  const knownKind: StaffCardKind | null =
    folderRole === 'DRIVER' ? 'driver' : folderRole === 'DISTRIBUTOR' ? 'distributor' : folderRole === 'DELEGATE' ? 'delegate' : null;

  return (
    <CenteredOverlay open={open} onClose={onClose} width="md" labelledBy="distribution-add-title">
      <div className="p-6" dir="rtl">
        <h2 id="distribution-add-title" className="text-lg font-bold text-[#0E79AA]">
          {step === 'folder' ? 'تحت أي مجلد؟' : step === 'person' ? 'نوع الفرد' : 'إضافة في الدليل'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {parentLabel
            ? `تحت «${parentLabel}» — المجموعة تنزل جوه المجلد ده مش جنبه.`
            : 'المجموعة لازم تبقى تحت سائق أو موزع أو مندوب، مش مجموعة رئيسية جنبهم.'}
        </p>

        {step === 'folder' ? (
          <div className="mt-5 grid gap-3">
            {FOLDER_CHOICES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-right hover:border-[#0E79AA] hover:bg-white"
                onClick={() => onPickFolder(item.id)}
              >
                <span className="block text-sm font-bold text-[#0A3D5E]">{item.title}</span>
                <span className="mt-1 block text-xs text-slate-500">{item.description}</span>
              </button>
            ))}
          </div>
        ) : step === 'node' ? (
          <div className="mt-5 grid gap-3">
            <button
              type="button"
              className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-right hover:border-[#0E79AA] hover:bg-white"
              onClick={onPickGroup}
            >
              <span className="block text-sm font-bold text-[#0A3D5E]">مجموعة</span>
              <span className="mt-1 block text-xs text-slate-500">
                مجلد فرعي تحت {parentLabel ? `«${parentLabel}»` : 'المجلد المختار'} — كود واسم فقط.
              </span>
            </button>
            <button
              type="button"
              className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-right hover:border-[#0E79AA] hover:bg-white"
              onClick={() => {
                if (knownKind) {
                  onPickPerson(knownKind);
                  return;
                }
                onStepChange('person');
              }}
            >
              <span className="block text-sm font-bold text-[#0A3D5E]">فرد</span>
              <span className="mt-1 block text-xs text-slate-500">
                {knownKind
                  ? `بطاقة ${FOLDER_CHOICES.find((f) => f.id === folderRole)?.title ?? 'الفرد'}.`
                  : 'مندوب أو سائق أو موزع — بطاقة كاملة.'}
              </span>
            </button>
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {STAFF_CARD_KINDS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-right hover:border-[#0E79AA] hover:bg-white"
                onClick={() => onPickPerson(item.id)}
              >
                <span className="block text-sm font-bold text-[#0A3D5E]">{item.title}</span>
                <span className="mt-1 block text-xs text-slate-500">{item.description}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          {step === 'person' || (step === 'node' && canPickFolder) ? (
            <button
              type="button"
              className="text-sm text-[#0E79AA] hover:underline"
              onClick={() => onStepChange(step === 'person' ? 'node' : 'folder')}
            >
              رجوع
            </button>
          ) : null}
          <button type="button" className="text-sm text-slate-500 hover:text-slate-700" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </CenteredOverlay>
  );
}
