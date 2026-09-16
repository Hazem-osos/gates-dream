'use client';

import React, { useEffect, useState } from 'react';
import { CompactFormField, FormSectionCard } from '@/components/ui';
import { useApiMutation } from '@/lib/hooks/useApi';
import { useSuggestAccountCode } from '@/lib/hooks/useChartOfAccounts';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import { invalidateMasterDataClient } from '@/lib/hooks/invalidateMasterData';
import type { ApiError } from '@/lib/api/types';
import { useQueryClient } from '@tanstack/react-query';
import { QuickCreateDialog } from '@/app/components/form/QuickCreateDialog';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { compactControlClass } from '@/components/ui/forms/formTokens';
import { statementTypeFromAccountType } from '@/lib/accounting/account-classification';
import { useAccountsQuery } from '@/lib/hooks/useMasterDataQueries';

export type QuickCreatedAccount = {
  id: string;
  code: string;
  arabicName: string;
};

type Props = {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onCreated: (account: QuickCreatedAccount) => void;
};

export function QuickCreateAccountModal({ open, initialName, onClose, onCreated }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState('');
  const [parentId, setParentId] = useState('');
  const [accountSide, setAccountSide] = useState<'مدين' | 'دائن' | ''>('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [error, setError] = useState('');

  const { data: settingsRes } = useAccountingSettingsQuery();
  const autoNumbering = settingsRes?.data?.general?.coaAutoNumbering !== false;
  const { data: suggestRes } = useSuggestAccountCode(
    parentId || null,
    open && autoNumbering && Boolean(parentId)
  );
  const { data: headersRes } = useAccountsQuery('', 200, { headerOnly: true, enabled: open });
  const parent = (headersRes?.data ?? []).find((row) => row.id === parentId);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setParentId('');
    setAccountSide('');
    setCode('');
    setCodeTouched(false);
    setError('');
  }, [open, initialName]);

  useEffect(() => {
    if (!open || !autoNumbering || !parentId || codeTouched) return;
    const next = suggestRes?.data?.code;
    if (next) setCode(next);
  }, [open, autoNumbering, parentId, codeTouched, suggestRes?.data?.code]);

  useEffect(() => {
    if (!parent || accountSide) return;
    const inherited =
      parent.accountType?.toLowerCase() === 'liability' ||
      parent.accountType?.toLowerCase() === 'equity' ||
      parent.accountType?.toLowerCase() === 'revenue'
        ? 'دائن'
        : 'مدين';
    setAccountSide(inherited);
  }, [parent, accountSide]);

  const mutation = useApiMutation<QuickCreatedAccount, Record<string, unknown>>(
    '/accounting/accounts',
    'POST',
    {
      showSuccessToast: true,
      successMessage: 'تم إنشاء الحساب',
      onSuccess: (res) => {
        const row = res.data;
        if (!row?.id) return;
        invalidateMasterDataClient(queryClient);
        queryClient.setQueriesData({ queryKey: ['accounts'] }, (current: unknown) => {
          if (!current || typeof current !== 'object') return current;
          const bag = current as { data?: Array<Record<string, unknown>> };
          if (!Array.isArray(bag.data) || bag.data.some((item) => item.id === row.id)) return current;
          return {
            ...bag,
            data: [
              {
                id: row.id,
                code: row.code || code.trim(),
                arabicName: row.arabicName || name.trim(),
                accountKind: 'POSTING',
              },
              ...bag.data,
            ],
          };
        });
        onCreated({
          id: row.id,
          code: row.code || code.trim(),
          arabicName: row.arabicName || name.trim(),
        });
        onClose();
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر الحفظ'),
    }
  );

  const submit = () => {
    setError('');
    if (!name.trim()) {
      setError('الاسم مطلوب');
      return;
    }
    if (!parentId) {
      setError('اختَر الحساب الرئيسي أولاً. الإضافة السريعة تنشئ حساب حركة تحت أب.');
      return;
    }
    if (!autoNumbering && !code.trim()) {
      setError('كود الحساب مطلوب — الترقيم يدوي');
      return;
    }
    if (!accountSide) {
      setError('جهة الحساب مطلوبة (مدين أو دائن)');
      return;
    }
    mutation.mutate({
      arabicName: name.trim(),
      code: code.trim() || undefined,
      parentId,
      accountSide,
      accountNature: accountSide === 'دائن' ? 'CREDIT' : 'DEBIT',
      accountType: parent?.accountType || undefined,
      statementType: statementTypeFromAccountType(parent?.accountType),
      accountKind: 'POSTING',
    });
  };

  return (
    <QuickCreateDialog
      open={open}
      title="إضافة حساب حركة"
      titleId="quick-account-title"
      error={error}
      saving={mutation.isPending}
      onClose={onClose}
      onSave={submit}
    >
      <FormSectionCard title="البيانات الأساسية" bodyClassName="sm:grid-cols-1 lg:grid-cols-1">
        <CompactFormField label="الحساب الرئيسي" required>
          <AccountSelect
            value={parentId}
            onChange={(id) => {
              setParentId(id);
              setCodeTouched(false);
            }}
            headerOnly
            leafOnly={false}
            className={compactControlClass}
            placeholder="اختر الحساب الرئيسي"
            emptyLabel="اختر الحساب الرئيسي"
            enableQuickCreate={false}
          />
        </CompactFormField>
        <CompactFormField
          label="اسم الحساب"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <CompactFormField
          label={autoNumbering ? 'الكود (تلقائي)' : 'الكود'}
          required={!autoNumbering}
          value={code}
          readOnly={autoNumbering}
          disabled={autoNumbering}
          hint={autoNumbering ? undefined : 'أدخله بنفسك — مفيش رقم مقترح'}
          onChange={(e) => {
            setCodeTouched(true);
            setCode(e.target.value);
          }}
        />
        <CompactFormField label="جهة الحساب" required>
          <div className="flex flex-wrap gap-2">
            {(['مدين', 'دائن'] as const).map((side) => (
              <label
                key={side}
                className={`${
                  accountSide === side
                    ? 'bg-[#0E78AA] text-white border-[#0E78AA]'
                    : 'bg-white text-[#0A3D5E] border-[#D6EAF3]'
                } inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold`}
              >
                <input
                  type="radio"
                  name="quickAccountSide"
                  className="sr-only"
                  checked={accountSide === side}
                  onChange={() => setAccountSide(side)}
                />
                {side}
              </label>
            ))}
          </div>
        </CompactFormField>
      </FormSectionCard>
    </QuickCreateDialog>
  );
}
