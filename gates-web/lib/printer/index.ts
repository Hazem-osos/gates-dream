export type { ThermalInvoiceData, ThermalInvoiceItem, ThermalRollWidth } from './types';
export { renderReceiptToCanvas, THERMAL_PX } from './receipt-canvas';
export { canvasToEscPos, uint8ToBase64 } from './escpos-encoder';
export {
  BluetoothThermalPrinter,
  bluetoothThermalPrinter,
  isWebBluetoothAvailable,
  readCachedPrinterName,
} from './web-bluetooth';
export {
  printViaRawBT,
  printEscPosViaRawBT,
  printThermalViaBrowser,
  isLikelyIOS,
} from './rawbt-fallback';
export { thermalDataFromPrintModel } from './from-invoice-print-model';
export {
  readSalesPrintPrefs,
  writeSalesPrintPrefs,
  dispatchAutoPrintAfterSave,
  AUTO_PRINT_A4_EVENT,
  AUTO_PRINT_THERMAL_EVENT,
} from './print-prefs';
