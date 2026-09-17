import React from 'react';
import { Building2 } from 'lucide-react';
import { CompactFormField, FormSectionCard } from '@/components/ui';

export type ProjectHeaderForm = {
  serial: string;
  arabicName: string;
  englishName: string;
  address: string;
  customerCode: string;
  customerName: string;
  customerPhone: string;
  duration: string;
  startDate: string;
  startDateHijri: string;
};

type ProjectHeaderProps = {
  value: ProjectHeaderForm;
  onChange: (patch: Partial<ProjectHeaderForm>) => void;
  readOnlyIdentity?: boolean;
};

const ProjectHeader = ({
  value,
  onChange,
  readOnlyIdentity = false,
}: ProjectHeaderProps) => (
  <FormSectionCard title="بيانات المشروع" subtitle="التعريف والعميل وتواريخ البدء" icon={Building2}>
    <CompactFormField
      label="رقم المشروع"
      placeholder="رقم المشروع"
      readOnly={readOnlyIdentity}
      value={value.serial}
      onChange={(e) => onChange({ serial: e.target.value })}
    />
    <CompactFormField
      label="الإسم العربي"
      required
      placeholder="الإسم العربي"
      value={value.arabicName}
      onChange={(e) => onChange({ arabicName: e.target.value })}
    />
    <CompactFormField
      label="الإسم الإنجليزي"
      placeholder="إدخل الإسم الإنجليزي"
      value={value.englishName}
      onChange={(e) => onChange({ englishName: e.target.value })}
    />
    <CompactFormField
      label="العنوان"
      placeholder="إدخل العنوان"
      value={value.address}
      onChange={(e) => onChange({ address: e.target.value })}
    />
    <CompactFormField
      label="كود العميل"
      placeholder="كود العميل"
      value={value.customerCode}
      onChange={(e) => onChange({ customerCode: e.target.value })}
    />
    <CompactFormField
      label="إسم العميل"
      placeholder="إسم العميل"
      value={value.customerName}
      onChange={(e) => onChange({ customerName: e.target.value })}
    />
    <CompactFormField
      label="ت. العميل"
      placeholder="إدخل رقم تليفون العميل"
      value={value.customerPhone}
      onChange={(e) => onChange({ customerPhone: e.target.value })}
    />
    <CompactFormField
      label="المدة الزمنية"
      placeholder="إدخل المدة الزمنية"
      value={value.duration}
      onChange={(e) => onChange({ duration: e.target.value })}
    />
    <CompactFormField
      label="تاريخ البدء"
      type="date"
      value={value.startDate}
      onChange={(e) => onChange({ startDate: e.target.value })}
    />
    <CompactFormField
      label="الهجري"
      placeholder="الهجري"
      value={value.startDateHijri}
      onChange={(e) => onChange({ startDateHijri: e.target.value })}
    />
  </FormSectionCard>
);

export default ProjectHeader;
