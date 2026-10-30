/**
 * Tiny CLI used by the on-prem launcher (GatesERP.exe). Prints one JSON line.
 *
 *   node license-cli.js machine-id   → {"machineId":"XXXXX-XXXXX-XXXXX-XXXXX"}
 *   node license-cli.js check        → {"ok":true,"customer":…,"maxUsers":…,"expiresAt":…}
 *                                       or {"ok":false,"reason":…,"message":…,"machineId":…}
 *
 * Reads GATES_LICENSE_FILE (default ./gates.lic). The backend itself repeats the check at
 * boot, so bypassing this CLI does not bypass the license.
 */
import { LICENSE_FAILURE_MESSAGES } from './license-codec';
import { getMachineId } from './machine-id';
import { checkLicenseFile } from './license-file';

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

const command = process.argv[2];
try {
  if (command === 'machine-id') {
    print({ machineId: getMachineId() });
  } else if (command === 'check') {
    const result = checkLicenseFile();
    if (result.ok) {
      const { customer, licenseId, maxUsers, expiresAt } = result.license;
      print({ ok: true, machineId: result.machineId, customer, licenseId, maxUsers, expiresAt });
    } else {
      print({
        ok: false,
        machineId: result.machineId,
        reason: result.reason,
        message: LICENSE_FAILURE_MESSAGES[result.reason],
      });
      process.exitCode = 1;
    }
  } else {
    print({ ok: false, message: 'usage: license-cli machine-id | check' });
    process.exitCode = 2;
  }
} catch (error) {
  print({ ok: false, message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
}
