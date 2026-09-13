/**
 * Runs on the client before React hydration (Next.js 15+).
 * Ensures abort noise from RSC navigation is swallowed before the dev overlay attaches.
 */
import { registerAbortNoiseGuard } from '@/lib/providers/register-abort-noise-guard';

export function register() {
  registerAbortNoiseGuard();
}
