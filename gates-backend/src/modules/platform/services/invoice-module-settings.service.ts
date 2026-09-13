import { companySettingService } from './company-setting.service';

/**
 * Legacy-exact per-module settings for the sales/purchase invoice and
 * return family (`SI`, `PI`, `SR`, `PR`, `SV`, …), verified against
 * `MainProgram/untRInovice.pas` `TFrmRInovice.LoadSettings` (the shared
 * load routine for this document family; `FormType` there is the 4-char
 * `NewModule` code, e.g. "SI01").
 *
 * This is the concrete, wave-1-verified instance of the generic
 * `getModuleFlag` / `getModuleEnum` primitives in `company-setting.service.ts` —
 * later document waves should follow the same pattern (read the unit's own
 * `LoadSettings`, then add a sibling resolver here or in a new file).
 */
export interface InvoiceModuleSettings {
  sampleInvoice: boolean;
  cascadingDiscounts: boolean;
  /** 'C' (credit) / 'D' (debit) — legacy inverts the branches for FormType starting with 'SV'. */
  ccenterSide: 'C' | 'D';
  selectAllAccounts: boolean;
  serviceInvoice: boolean;
  /** 'A' auto / 'M' manual. */
  serialAutomatic: 'A' | 'M';
  /** 'C' continuous / 'P' per fiscal year. */
  serialContanious: 'C' | 'P';
  notCreateGL: boolean;
  postTostore: boolean;
  autoPost: boolean;
  autoPrint: boolean;
  salesDariba: boolean;
  autoCreateEshar: boolean;
  autoPrintEshar: boolean;
  showAdvancedOptions: boolean;
  manbaDariba: boolean;
  showOtherModules: boolean;
  showSeller: boolean;
  loadDownPayment: boolean;
  /** Forced false when the company WorkType setting isn't 'AVG' (legacy untRInovice.pas:1625). */
  allowFreeReturn: boolean;
  rowOneColor: string;
  rowTwoColor: string;
  serialStart: string;
  returnPayAccount: string | null;
  ccenter: string | null;
  defaultStore: string | null;
  modulePrice: string | null;
  /** Defaults 'BP01' for SR-prefixed FormType, else 'BR01'. */
  cashType: string;
  /** Defaults 'PC01' for SR-prefixed FormType, else 'RC01'. */
  checkType: string;
  allowChangePrice: boolean;
}

export class InvoiceModuleSettingsService {
  async resolve(companyId: string, formType: string): Promise<InvoiceModuleSettings> {
    const isSR = formType.slice(0, 2) === 'SR';
    const isSV = formType.slice(0, 2) === 'SV';
    const s = companySettingService;

    const [
      sampleInvoice,
      cascadingDiscounts,
      ccenterSideRaw,
      selectAllAccounts,
      serviceInvoice,
      serialAutomatic,
      serialContanious,
      notCreateGL,
      postTostore,
      autoPost,
      autoPrint,
      salesDariba,
      autoCreateEshar,
      autoPrintEshar,
      showAdvancedOptions,
      manbaDariba,
      showOtherModules,
      showSeller,
      loadDownPayment,
      allowFreeReturnRaw,
      rowOneColorRaw,
      rowTwoColorRaw,
      serialStartRaw,
      returnPayAccount,
      ccenter,
      defaultStore,
      modulePrice,
      cashTypeRaw,
      checkTypeRaw,
      allowChangePriceRaw,
      workType,
    ] = await Promise.all([
      s.getModuleFlag(companyId, 'SampleInvoice', formType, { offLiteral: 'T' }),
      s.getModuleFlag(companyId, 'CascadingDiscounts', formType, { offLiteral: 'T' }),
      s.getModuleEntry(companyId, 'CCenterSide', formType),
      s.getModuleFlag(companyId, 'SelectAllAccounts', formType, { offLiteral: 'T' }),
      s.getModuleFlag(companyId, 'ServiceInvoice', formType, { offLiteral: 'T' }),
      s.getModuleEnum(companyId, 'SerialAutomatic', formType, { defaultValue: 'A', otherValue: 'M' }),
      s.getModuleEnum(companyId, 'SerialContanious', formType, { defaultValue: 'C', otherValue: 'P' }),
      s.getModuleFlag(companyId, 'NotCreateGL', formType, { offLiteral: 'T' }),
      s.getModuleFlag(companyId, 'PostTostore', formType, { offLiteral: 'F' }),
      s.getModuleFlag(companyId, 'AutoPost', formType, { offLiteral: 'F' }),
      s.getModuleFlag(companyId, 'AutoPrint', formType, { offLiteral: 'F' }),
      s.getModuleFlag(companyId, 'SalesDariba', formType, { offLiteral: 'F' }),
      s.getModuleFlag(companyId, 'AutoCreateEshar', formType, { offLiteral: 'F' }),
      s.getModuleFlag(companyId, 'AutoPrintEshar', formType, { offLiteral: 'F' }),
      s.getModuleFlag(companyId, 'ShowAdvancedOptions', formType, { offLiteral: 'F' }),
      s.getModuleFlag(companyId, 'ManbaDariba', formType, { offLiteral: 'F' }),
      s.getModuleFlag(companyId, 'ShowOtherModules', formType, { offLiteral: 'F' }),
      s.getModuleFlag(companyId, 'ShowSeller', formType, { offLiteral: 'T' }),
      s.getModuleFlag(companyId, 'LoadDownPayment', formType, { offLiteral: 'F' }),
      s.getModuleFlag(companyId, 'AllowFreeReturn', formType, { offLiteral: 'F' }),
      s.getModuleEntry(companyId, 'RowOneColor', formType),
      s.getModuleEntry(companyId, 'RowTwoColor', formType),
      s.getModuleEntry(companyId, 'SerialStart', formType),
      s.getModuleEntry(companyId, 'ReturnPayAccount', formType),
      s.getModuleEntry(companyId, 'CCenter', formType),
      s.getModuleEntry(companyId, 'DefaultStore', formType),
      s.getModuleEntry(companyId, 'ModulePrice', formType),
      s.getModuleEntry(companyId, 'CashType', formType),
      s.getModuleEntry(companyId, 'CheckType', formType),
      s.getModuleFlag(companyId, 'AllowChangePrice', formType, { offLiteral: 'T' }),
      s.getEntryOrLegacyDefault(companyId, 'WorkType'),
    ]);

    const ccenterSide: 'C' | 'D' = isSV
      ? ccenterSideRaw === 'D' ? 'D' : 'C'
      : ccenterSideRaw === 'C' ? 'C' : 'D';

    // untRInovice.pas:1625 — `if WorkType<>'AVG' then AllowFreeReturn:='F'`.
    const allowFreeReturn = workType === 'AVG' ? allowFreeReturnRaw : false;

    return {
      sampleInvoice,
      cascadingDiscounts,
      ccenterSide,
      selectAllAccounts,
      serviceInvoice,
      serialAutomatic,
      serialContanious,
      notCreateGL,
      postTostore,
      autoPost,
      autoPrint,
      salesDariba,
      autoCreateEshar,
      autoPrintEshar,
      showAdvancedOptions,
      manbaDariba,
      showOtherModules,
      showSeller,
      loadDownPayment,
      allowFreeReturn,
      rowOneColor: rowOneColorRaw || 'FFFFFF',
      rowTwoColor: rowTwoColorRaw || 'FFFFE1',
      serialStart: serialStartRaw || '00000001',
      returnPayAccount: returnPayAccount || null,
      ccenter: ccenter || null,
      defaultStore: defaultStore || null,
      modulePrice: modulePrice || null,
      cashType: cashTypeRaw || (isSR ? 'BP01' : 'BR01'),
      checkType: checkTypeRaw || (isSR ? 'PC01' : 'RC01'),
      allowChangePrice: allowChangePriceRaw,
    };
  }
}

export const invoiceModuleSettingsService = new InvoiceModuleSettingsService();
