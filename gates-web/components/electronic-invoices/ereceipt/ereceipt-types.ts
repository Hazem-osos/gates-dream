export type EreceiptCheck = { code: string; ok: boolean; messageAr: string };

export type EreceiptReceiptType = {
  code: string;
  label: string;
  defaultEnabled: boolean;
  audience: string;
};

export type EreceiptSettingRow = {
  id?: string;
  environment: string;
  enabledReceiptTypes: unknown;
  paymentMap: unknown;
  rwrReasonCodes: unknown;
  orderDeliveryMode: string | null;
  signingMode: string;
};

export type EreceiptDeviceRow = {
  id: string;
  terminalId: string;
  environment: string;
  deviceSerialNumber: string;
  branchCode: string;
  posOsVersion: string;
  posModelFramework: string;
  activityCode?: string | null;
  active: boolean;
  clientId: string;
  clientSecretConfigured?: boolean;
  presharedKeyConfigured?: boolean;
  terminal?: { name?: string };
};

export type FiscalPublic = {
  status: string;
  labelAr?: string;
  receiptId?: string;
  receiptNumber?: string | null;
  uuid?: string | null;
};

export type EreceiptReadinessPayload = {
  checks: EreceiptCheck[];
  devices: EreceiptDeviceRow[];
  settings: EreceiptSettingRow[];
  receiptTypes: EreceiptReceiptType[];
};
