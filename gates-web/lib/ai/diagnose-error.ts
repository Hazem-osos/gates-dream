import { apiClient } from '@/lib/api/client';

export type DiagnoseQuickFix = {
  actionType:
    | 'NAVIGATE_TO_SETTINGS'
    | 'UNPOST_DOCUMENT'
    | 'OPEN_EDIT_MODE'
    | 'ADJUST_PRICE'
    | 'CHECK_STOCK'
    | 'FILL_REQUIRED_FIELDS';
  labelAr: string;
  href?: string;
};

export type DiagnoseErrorResult = {
  errorCode: string;
  explanationAr: string;
  correctiveSteps: string[];
  quickFixAction?: DiagnoseQuickFix;
  settingsSnapshot?: {
    preventSellingBelowCost?: boolean;
    preventNegativeStock?: boolean;
  };
};

export async function diagnoseApiError(input: {
  errorCode: string;
  errorMessage?: string;
  currentRoute?: string;
  formValues?: Record<string, unknown>;
}): Promise<DiagnoseErrorResult> {
  const res = await apiClient.post<DiagnoseErrorResult>('/ai/diagnose-error', input, {
    skipErrorNotify: true,
  });
  if (!res.data) {
    throw new Error('تعذّر تشخيص الخطأ.');
  }
  return res.data;
}
