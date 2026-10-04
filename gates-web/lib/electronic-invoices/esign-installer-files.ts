import { existsSync } from 'node:fs';
import path from 'node:path';

export const GATES_ESIGN_SETUP_FILENAME = 'GatesESignSetup.exe';

export function esignInstallerCandidates(cwd = process.cwd()): string[] {
  const fromEnv = process.env.GATES_ESIGN_INSTALLER_PATH?.trim();
  return [
    fromEnv,
    path.join(cwd, 'public', 'downloads', GATES_ESIGN_SETUP_FILENAME),
    path.join(cwd, 'gates-web', 'public', 'downloads', GATES_ESIGN_SETUP_FILENAME),
    path.join(cwd, '..', 'gates-esign-agent', 'release', '1.1.4', GATES_ESIGN_SETUP_FILENAME),
    path.join(cwd, '..', '..', 'gates-esign-agent', 'release', '1.1.4', GATES_ESIGN_SETUP_FILENAME),
    path.join(cwd, '..', 'gates-esign-agent', 'release', '1.1.3', GATES_ESIGN_SETUP_FILENAME),
    path.join(cwd, '..', '..', 'gates-esign-agent', 'release', '1.1.3', GATES_ESIGN_SETUP_FILENAME),
    path.join(cwd, '..', 'gates-esign-agent', 'release', '1.1.2', GATES_ESIGN_SETUP_FILENAME),
    path.join(cwd, '..', '..', 'gates-esign-agent', 'release', '1.1.2', GATES_ESIGN_SETUP_FILENAME),
    path.join(cwd, '..', 'gates-esign-agent', 'release', '1.1.1', GATES_ESIGN_SETUP_FILENAME),
    path.join(cwd, '..', '..', 'gates-esign-agent', 'release', '1.1.1', GATES_ESIGN_SETUP_FILENAME),
    path.join(cwd, '..', 'gates-esign-agent', 'release', '1.1.0', GATES_ESIGN_SETUP_FILENAME),
    path.join(cwd, '..', '..', 'gates-esign-agent', 'release', '1.1.0', GATES_ESIGN_SETUP_FILENAME),
    path.join(cwd, '..', 'gates-esign-agent', 'release', '1.0.1', GATES_ESIGN_SETUP_FILENAME),
    path.join(cwd, '..', '..', 'gates-esign-agent', 'release', '1.0.1', GATES_ESIGN_SETUP_FILENAME),
    path.join(cwd, '..', 'gates-esign-agent', 'release', '1.0.0', GATES_ESIGN_SETUP_FILENAME),
    path.join(cwd, '..', '..', 'gates-esign-agent', 'release', '1.0.0', GATES_ESIGN_SETUP_FILENAME),
  ].filter((value): value is string => Boolean(value));
}

export function findEsignInstallerPath(cwd = process.cwd()): string | null {
  return esignInstallerCandidates(cwd).find((candidate) => existsSync(candidate)) ?? null;
}
