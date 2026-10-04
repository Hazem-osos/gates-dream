import { parseDecimal } from './parseDecimal';

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

assert(parseDecimal('١٬٢٥٠٫٥٠') === 1250.5, 'arabic money');
assert(parseDecimal('12.5') === 12.5, 'western decimal');
assert(parseDecimal('') === 0, 'empty');

console.log('parseDecimal.test.ts ok');
test('parse decimal assertions', () => {});
