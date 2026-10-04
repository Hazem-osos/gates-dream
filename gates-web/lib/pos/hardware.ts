export type PosHardwareKind = 'scanner' | 'printer' | 'drawer' | 'display' | 'scale' | 'payment-terminal';

export type PosHardwareStatus = 'ready' | 'manual' | 'unavailable';

export interface PosHardwareAdapter {
  kind: PosHardwareKind;
  status: PosHardwareStatus;
}

/** Keyboard wedge scanners type into the focused field. No vendor SDK. */
export const wedgeScanner: PosHardwareAdapter = { kind: 'scanner', status: 'ready' };

/** Cash drawer kick is an ESC/POS pulse sent through the existing printer path. */
export function drawerPulse(): Uint8Array {
  return Uint8Array.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);
}

export interface ScaleReading {
  quantity: number;
  unit: 'kg';
}

export interface ScaleAdapter extends PosHardwareAdapter {
  read(): Promise<ScaleReading>;
}

/** Browser pages cannot claim a scale. A desktop bridge would implement ScaleAdapter. */
export const unavailableScale: ScaleAdapter = {
  kind: 'scale',
  status: 'unavailable',
  read() {
    return Promise.reject(new Error('Scale needs the local hardware bridge'));
  },
};

export interface PaymentTerminalResult {
  status: 'APPROVED' | 'DECLINED' | 'CANCELLED';
  providerRef?: string;
  provider?: string;
}

export interface PaymentTerminalAdapter extends PosHardwareAdapter {
  charge(amount: number): Promise<PaymentTerminalResult>;
}

/** Manual card entry never reports provider approval. */
export const manualCardAdapter: PaymentTerminalAdapter = {
  kind: 'payment-terminal',
  status: 'manual',
  charge() {
    return Promise.reject(new Error('No payment provider is configured'));
  },
};
