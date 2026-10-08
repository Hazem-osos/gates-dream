import {
  formatManufacturingOrderSerial,
  stripManufacturingOrderSourceSuffix,
} from './order-serial';

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

assert(stripManufacturingOrderSourceSuffix('42-OH') === '42', 'strip OH suffix');
assert(formatManufacturingOrderSerial('7') === '0000000007', 'pad to 10 digits');
assert(formatManufacturingOrderSerial('000012') === '0000000012', 'normalize short padded');
