import type { EreceiptDeviceRow, EreceiptSettingRow } from '@/components/electronic-invoices/ereceipt/ereceipt-types';
import { deviceRowReady } from './ereceipt-settings';

export function listMissingSetupActions(input: {
  environment: string;
  settings: EreceiptSettingRow[];
  devices: EreceiptDeviceRow[];
  rinOk: boolean;
}): string[] {
  const actions: string[] = [];
  if (!input.rinOk) {
    actions.push('أكمل رقم التسجيل الضريبي (RIN) من إعدادات الفاتورة أو بيانات الشركة.');
  }
  const envDevices = input.devices.filter((d) => d.environment === input.environment);
  const active = envDevices.find((d) => d.active) ?? envDevices[0];
  if (!active) {
    actions.push('اربط طرفية Gates بجهاز ETA (اختر الطرفية وأدخل بيانات التسجيل).');
    return actions;
  }
  if (!active.deviceSerialNumber?.trim()) {
    actions.push('أدخل POS Serial المسجل لدى الضرائب.');
  }
  if (!active.branchCode?.trim()) actions.push('أدخل كود الفرع لدى الضرائب.');
  if (!active.activityCode?.trim()) actions.push('اختر أو أدخل كود النشاط.');
  if (!active.posOsVersion?.trim()) actions.push('أدخل إصدار نظام تشغيل نقطة البيع.');
  if (!active.posModelFramework?.trim()) actions.push('أدخل POS Model / Framework.');
  if (!active.clientId?.trim()) actions.push('أدخل Client ID.');
  if (!active.clientSecretConfigured) actions.push('أدخل Client Secret.');
  if (!active.presharedKeyConfigured) actions.push('أدخل Pre-shared Key.');
  if (!deviceRowReady(active)) {
    /* already listed granular fields */
  }
  const setting = input.settings.find((s) => s.environment === input.environment);
  if (!setting) {
    actions.push('احفظ إعدادات الإيصال لهذه البيئة (أنواع البيع/المرتجع الافتراضية).');
  }
  return actions;
}

export function localSetupComplete(actions: string[]): boolean {
  return actions.length === 0;
}
