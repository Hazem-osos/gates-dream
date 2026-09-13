export type DiagnoseErrorInput = {
  errorCode: string;
  errorMessage?: string;
  currentRoute?: string;
  formValues?: Record<string, unknown>;
};

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
  settingsSnapshot: {
    preventSellingBelowCost: boolean;
    preventNegativeStock: boolean;
  };
};

export type CompanyGuardSettings = {
  preventSellingBelowCost: boolean;
  preventNegativeStock: boolean;
};
