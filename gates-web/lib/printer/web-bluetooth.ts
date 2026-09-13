const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
];

const DEVICE_ID_KEY = 'gates:bluetooth-thermal-printer-id';
const DEVICE_NAME_KEY = 'gates:bluetooth-thermal-printer-name';
const CHUNK_SIZE = 180;
const CHUNK_DELAY_MS = 15;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.bluetooth?.requestDevice);
}

function rememberDevice(device: BluetoothDevice): void {
  try {
    localStorage.setItem(DEVICE_ID_KEY, device.id);
    localStorage.setItem(DEVICE_NAME_KEY, device.name?.trim() || 'طابعة حرارية');
  } catch {
    /* ignore quota / private mode */
  }
}

export function readCachedPrinterName(): string | null {
  try {
    return localStorage.getItem(DEVICE_NAME_KEY);
  } catch {
    return null;
  }
}

async function findWritableCharacteristic(
  server: BluetoothRemoteGATTServer
): Promise<BluetoothRemoteGATTCharacteristic> {
  let services: BluetoothRemoteGATTService[] = [];
  try {
    services = await server.getPrimaryServices();
  } catch {
    for (const uuid of PRINTER_SERVICES) {
      try {
        services.push(await server.getPrimaryService(uuid));
      } catch {
        /* service not advertised */
      }
    }
  }

  for (const service of services) {
    let chars: BluetoothRemoteGATTCharacteristic[] = [];
    try {
      chars = await service.getCharacteristics();
    } catch {
      continue;
    }
    const writable = chars.find(
      (c) => c.properties.writeWithoutResponse || c.properties.write
    );
    if (writable) return writable;
  }
  throw new Error('تعذّر إيجاد قناة كتابة على الطابعة. جرّب طابعة ESC/POS متوافقة.');
}

async function writeChunks(
  characteristic: BluetoothRemoteGATTCharacteristic,
  data: Uint8Array
): Promise<void> {
  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const slice = data.slice(offset, offset + CHUNK_SIZE);
    const buffer = slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength);
    if (characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(buffer);
    } else if (characteristic.writeValueWithResponse) {
      await characteristic.writeValueWithResponse(buffer);
    } else {
      await characteristic.writeValue(buffer);
    }
    if (offset + CHUNK_SIZE < data.length) {
      await sleep(CHUNK_DELAY_MS);
    }
  }
}

export class BluetoothThermalPrinter {
  private device: BluetoothDevice | null = null;

  get deviceName(): string | null {
    return this.device?.name?.trim() || readCachedPrinterName();
  }

  get connected(): boolean {
    return Boolean(this.device?.gatt?.connected);
  }

  async requestDevice(): Promise<BluetoothDevice> {
    if (!isWebBluetoothAvailable() || !navigator.bluetooth) {
      throw new Error('المتصفح لا يدعم Web Bluetooth. استخدم Chrome على أندرويد أو سطح المكتب.');
    }

    const optionalServices = [...PRINTER_SERVICES];
    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'MTP' },
          { namePrefix: 'POS' },
          { namePrefix: 'RP' },
          { namePrefix: 'Bluetooth' },
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
        ],
        optionalServices,
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'NotFoundError') {
        this.device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices,
        });
      } else {
        throw error;
      }
    }

    rememberDevice(this.device);
    return this.device;
  }

  async reconnectCached(): Promise<BluetoothDevice | null> {
    if (!navigator.bluetooth?.getDevices) return this.device;
    let cachedId: string | null = null;
    try {
      cachedId = localStorage.getItem(DEVICE_ID_KEY);
    } catch {
      cachedId = null;
    }
    if (!cachedId) return this.device;
    try {
      const devices = await navigator.bluetooth.getDevices();
      const match = devices.find((d) => d.id === cachedId);
      if (match) {
        this.device = match;
        rememberDevice(match);
        return match;
      }
    } catch {
      return this.device;
    }
    return this.device;
  }

  async connectAndWrite(
    data: Uint8Array,
    onProgress?: (phase: 'connecting' | 'sending') => void,
    allowPicker = true
  ): Promise<void> {
    if (!this.device) {
      const reused = await this.reconnectCached();
      if (!reused && allowPicker) {
        await this.requestDevice();
      }
    }
    if (!this.device?.gatt) {
      throw new Error('لم يتم اختيار طابعة بلوتوث.');
    }

    onProgress?.('connecting');
    const server = this.device.gatt.connected
      ? this.device.gatt
      : await this.device.gatt.connect();
    const characteristic = await findWritableCharacteristic(server);

    onProgress?.('sending');
    await writeChunks(characteristic, data);
    rememberDevice(this.device);
  }
}

export const bluetoothThermalPrinter = new BluetoothThermalPrinter();
