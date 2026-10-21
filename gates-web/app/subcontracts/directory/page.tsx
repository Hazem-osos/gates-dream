'use client';

import { useState } from 'react';
import { Building2, UserRound } from 'lucide-react';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { AppTable, CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import { parseVendorDetails, SUBCONTRACTOR_STATUS_AR } from '@/lib/subcontracts/vendor-details';
import type { Subcontractor, SubcontractorContact, SubcontractorDetailsBag } from '@/lib/subcontracts/types';
import { formatDateAr } from '@/lib/subcontracts/money';
import ErrorToast from '@/components/ErrorToast';

type CardForm = {
  nameAr: string;
  nameEn: string;
  phone: string;
  email: string;
  address: string;
  taxRegistrationNumber: string;
  commercialRegister: string;
  status: string;
  taxOffice: string;
  taxFileNumber: string;
  fax: string;
  dealNature: string;
  paymentMethod: string;
  bankName: string;
  iban: string;
  accountNumber: string;
  notes: string;
  contacts: SubcontractorContact[];
};

const emptyContact = (): SubcontractorContact => ({
  nameAr: '',
  nameEn: '',
  job: '',
  mobile: '',
  email: '',
  nationalId: '',
  suspended: false,
});

const emptyForm = (): CardForm => ({
  nameAr: '',
  nameEn: '',
  phone: '',
  email: '',
  address: '',
  taxRegistrationNumber: '',
  commercialRegister: '',
  status: 'ACTIVE',
  taxOffice: '',
  taxFileNumber: '',
  fax: '',
  dealNature: 'مقاول باطن',
  paymentMethod: '',
  bankName: '',
  iban: '',
  accountNumber: '',
  notes: '',
  contacts: [],
});

function fromVendor(row: Subcontractor): CardForm {
  const bag = parseVendorDetails(row.bankAccountDetails);
  return {
    nameAr: row.nameAr ?? '',
    nameEn: row.nameEn ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    address: row.address ?? '',
    taxRegistrationNumber: row.taxRegistrationNumber ?? '',
    commercialRegister: row.commercialRegister ?? '',
    status: row.status ?? 'ACTIVE',
    taxOffice: bag.taxOffice ?? '',
    taxFileNumber: bag.taxFileNumber ?? '',
    fax: bag.fax ?? '',
    dealNature: bag.dealNature || 'مقاول باطن',
    paymentMethod: bag.paymentMethod ?? '',
    bankName: bag.bankName ?? '',
    iban: bag.iban ?? '',
    accountNumber: bag.accountNumber ?? '',
    notes: bag.notes ?? '',
    contacts: bag.contacts ?? [],
  };
}

function toPayload(form: CardForm): Record<string, unknown> {
  const details: SubcontractorDetailsBag = {
    taxOffice: form.taxOffice,
    taxFileNumber: form.taxFileNumber,
    fax: form.fax,
    dealNature: form.dealNature,
    paymentMethod: form.paymentMethod,
    bankName: form.bankName,
    iban: form.iban,
    accountNumber: form.accountNumber,
    notes: form.notes,
    contacts: form.contacts.filter((row) => row.nameAr.trim()),
  };
  return {
    nameAr: form.nameAr.trim(),
    nameEn: form.nameEn || undefined,
    phone: form.phone || undefined,
    email: form.email || undefined,
    address: form.address || undefined,
    taxRegistrationNumber: form.taxRegistrationNumber || undefined,
    commercialRegister: form.commercialRegister || undefined,
    status: form.status,
    bankAccountDetails: details,
  };
}

export default function SubcontractorDirectoryPage() {
  const invalidate = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<CardForm>(emptyForm());
  const [error, setError] = useState('');
  const [createdAt, setCreatedAt] = useState('');

  const listQ = useApiQuery<Subcontractor[]>(
    queryKeys.subcontracts.directory(),
    '/subcontracts/directory/subcontractors'
  );
  const vendors = listQ.data?.data ?? [];

  const refresh = () => invalidate(queryKeys.subcontracts.directory());

  const create = useApiMutation<Subcontractor, Record<string, unknown>>(
    '/subcontracts/directory/subcontractors',
    'POST',
    {
      onSuccess: (res) => {
        const row = res.data;
        if (row?.id) {
          setSelectedId(row.id);
          setForm(fromVendor(row));
          setCreatedAt(row.createdAt ?? '');
        }
        refresh();
      },
      onError: (err) => setError(err.message || 'تعذر حفظ المقاول'),
    }
  );
  const update = useApiMutation<Subcontractor, Record<string, unknown>>(
    selectedId ? `/subcontracts/directory/subcontractors/${selectedId}` : '',
    'PATCH',
    {
      onSuccess: (res) => {
        if (res.data) setForm(fromVendor(res.data));
        refresh();
      },
      onError: (err) => setError(err.message || 'تعذر تحديث المقاول'),
    }
  );

  const patch = (field: keyof CardForm, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = () => {
    setError('');
    if (!form.nameAr.trim()) {
      setError('يرجى إدخال الاسم العربي');
      return;
    }
    const payload = toPayload(form);
    if (selectedId) update.mutate(payload);
    else create.mutate(payload);
  };

  const handleNew = () => {
    setSelectedId(null);
    setForm(emptyForm());
    setCreatedAt('');
    setError('');
  };

  return (
    <ExtractsPageChrome
      title="بطاقة مقاول الباطن"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/subcontracts', label: 'مقاولو الباطن' },
        { label: 'بطاقة المقاول' },
      ]}
      onSave={handleSave}
      savePending={create.isPending || update.isPending}
      onNew={handleNew}
      statusLabel={selectedId ? 'تعديل' : 'جديد'}
      currentId={selectedId}
      favoriteHref="/subcontracts/directory"
      browseList={{
        title: 'مقاولو الباطن',
        apiPath: '/subcontracts/directory/subcontractors',
        listKey: 'subcontractor-directory-browse',
        selectedId,
        columns: [
          { id: 'name', header: 'الاسم', getValue: (r) => String(r.nameAr || '—') },
          { id: 'tax', header: 'الرقم الضريبي', getValue: (r) => String(r.taxRegistrationNumber || '—') },
        ],
        onSelect: (id, row) => {
          const vendor = vendors.find((item) => item.id === id) ?? (row as unknown as Subcontractor);
          setSelectedId(id);
          setForm(fromVendor(vendor));
          setCreatedAt(vendor.createdAt ?? '');
          setError('');
        },
      }}
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}

      <FormSectionCard title="معلومات عامة" subtitle="جهة التعامل تُحفظ كمقاول باطن / مورد" icon={Building2}>
        <CompactFormField
          label="الإسم العربي"
          required
          value={form.nameAr}
          onChange={(e) => patch('nameAr', e.target.value)}
        />
        <CompactFormField label="الإسم بالإنجليزية" value={form.nameEn} onChange={(e) => patch('nameEn', e.target.value)} />
        <CompactFormField label="نوع جهة التعامل" readOnly value="مورد — مقاول باطن" />
        <CompactFormField label="تاريخ بدء التعامل" readOnly value={createdAt ? formatDateAr(createdAt) : '—'} />
        <CompactFormField label="المحمول" value={form.phone} onChange={(e) => patch('phone', e.target.value)} />
        <CompactFormField label="الفاكس" value={form.fax} onChange={(e) => patch('fax', e.target.value)} />
        <CompactFormField
          label="البريد الإلكتروني"
          value={form.email}
          onChange={(e) => patch('email', e.target.value)}
        />
        <CompactFormField label="حالة جهة التعامل">
          <select className={compactControlClass} value={form.status} onChange={(e) => patch('status', e.target.value)}>
            {Object.entries(SUBCONTRACTOR_STATUS_AR).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </CompactFormField>
      </FormSectionCard>

      <FormSectionCard title="العنوان">
        <CompactFormField
          label="العنوان"
          className="sm:col-span-2"
          value={form.address}
          onChange={(e) => patch('address', e.target.value)}
        />
        <CompactFormField label="التليفون" value={form.phone} onChange={(e) => patch('phone', e.target.value)} />
      </FormSectionCard>

      <FormSectionCard title="معلومات تجارية وضرائب" subtitle="تظهر في نموذج 41 عند وجود مأمورية">
        <CompactFormField
          label="الرقم الضريبي"
          value={form.taxRegistrationNumber}
          onChange={(e) => patch('taxRegistrationNumber', e.target.value)}
        />
        <CompactFormField
          label="السجل التجاري"
          value={form.commercialRegister}
          onChange={(e) => patch('commercialRegister', e.target.value)}
        />
        <CompactFormField
          label="رقم الملف الضريبي"
          value={form.taxFileNumber}
          onChange={(e) => patch('taxFileNumber', e.target.value)}
        />
        <CompactFormField label="مأمورية الضرائب" value={form.taxOffice} onChange={(e) => patch('taxOffice', e.target.value)} />
        <CompactFormField label="طبيعة التعامل" value={form.dealNature} onChange={(e) => patch('dealNature', e.target.value)} />
      </FormSectionCard>

      <FormSectionCard title="طريقة السداد">
        <CompactFormField
          label="طريقة السداد"
          value={form.paymentMethod}
          onChange={(e) => patch('paymentMethod', e.target.value)}
          placeholder="تحويل / شيك / نقدي"
        />
        <CompactFormField label="البنك" value={form.bankName} onChange={(e) => patch('bankName', e.target.value)} />
        <CompactFormField label="رقم الحساب" value={form.accountNumber} onChange={(e) => patch('accountNumber', e.target.value)} />
        <CompactFormField label="IBAN" value={form.iban} onChange={(e) => patch('iban', e.target.value)} />
        <CompactFormField label="ملاحظات" className="sm:col-span-2">
          <textarea
            className={`${compactControlClass} h-20 max-w-none resize-none py-2`}
            value={form.notes}
            onChange={(e) => patch('notes', e.target.value)}
          />
        </CompactFormField>
      </FormSectionCard>

      <FormSectionCard title="الشخص المسؤول" subtitle="أضف صفوفاً ثم احفظ البطاقة" icon={UserRound} bodyClassName="grid-cols-1">
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="secondary" onClick={() => setForm((prev) => ({ ...prev, contacts: [...prev.contacts, emptyContact()] }))}>
            إدخال
          </Button>
        </div>
        <AppTable
          columns={[
            {
              id: 'nameAr',
              header: 'الإسم بالعربي',
              cell: (row, index) => (
                <input
                  className={compactControlClass}
                  value={row.nameAr}
                  onChange={(e) =>
                    setForm((prev) => {
                      const contacts = [...prev.contacts];
                      contacts[index] = { ...contacts[index], nameAr: e.target.value };
                      return { ...prev, contacts };
                    })
                  }
                />
              ),
            },
            {
              id: 'nameEn',
              header: 'الإسم بالإنجليزية',
              cell: (row, index) => (
                <input
                  className={compactControlClass}
                  value={row.nameEn ?? ''}
                  onChange={(e) =>
                    setForm((prev) => {
                      const contacts = [...prev.contacts];
                      contacts[index] = { ...contacts[index], nameEn: e.target.value };
                      return { ...prev, contacts };
                    })
                  }
                />
              ),
            },
            {
              id: 'job',
              header: 'الوظيفة',
              cell: (row, index) => (
                <input
                  className={compactControlClass}
                  value={row.job ?? ''}
                  onChange={(e) =>
                    setForm((prev) => {
                      const contacts = [...prev.contacts];
                      contacts[index] = { ...contacts[index], job: e.target.value };
                      return { ...prev, contacts };
                    })
                  }
                />
              ),
            },
            {
              id: 'mobile',
              header: 'المحمول',
              cell: (row, index) => (
                <input
                  className={compactControlClass}
                  value={row.mobile ?? ''}
                  onChange={(e) =>
                    setForm((prev) => {
                      const contacts = [...prev.contacts];
                      contacts[index] = { ...contacts[index], mobile: e.target.value };
                      return { ...prev, contacts };
                    })
                  }
                />
              ),
            },
            {
              id: 'email',
              header: 'البريد الإلكتروني',
              cell: (row, index) => (
                <input
                  className={compactControlClass}
                  value={row.email ?? ''}
                  onChange={(e) =>
                    setForm((prev) => {
                      const contacts = [...prev.contacts];
                      contacts[index] = { ...contacts[index], email: e.target.value };
                      return { ...prev, contacts };
                    })
                  }
                />
              ),
            },
            {
              id: 'nid',
              header: 'رقم تحقيق الشخصية',
              cell: (row, index) => (
                <input
                  className={compactControlClass}
                  value={row.nationalId ?? ''}
                  onChange={(e) =>
                    setForm((prev) => {
                      const contacts = [...prev.contacts];
                      contacts[index] = { ...contacts[index], nationalId: e.target.value };
                      return { ...prev, contacts };
                    })
                  }
                />
              ),
            },
            {
              id: 'stop',
              header: 'إيقاف',
              cell: (row, index) => (
                <input
                  type="checkbox"
                  checked={row.suspended === true}
                  onChange={(e) =>
                    setForm((prev) => {
                      const contacts = [...prev.contacts];
                      contacts[index] = { ...contacts[index], suspended: e.target.checked };
                      return { ...prev, contacts };
                    })
                  }
                />
              ),
            },
            {
              id: 'del',
              header: '',
              cell: (_row, index) => (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setForm((prev) => ({ ...prev, contacts: prev.contacts.filter((_, i) => i !== index) }))}
                >
                  حذف
                </Button>
              ),
            },
          ]}
          data={form.contacts}
          getRowKey={(_row, index) => String(index)}
          emptyTitle="لا يوجد شخص مسؤول"
          emptyDescription="اضغط إدخال لإضافة صف."
        />
      </FormSectionCard>
    </ExtractsPageChrome>
  );
}
