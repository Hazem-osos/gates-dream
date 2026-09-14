/** Production never seeds unless ALLOW_PROD_SEED is an explicit opt-in. */
export function isProdSeedAllowed(): boolean {
  return ['true', '1', 'yes', 'on'].includes(
    (process.env.ALLOW_PROD_SEED ?? '').trim().toLowerCase()
  );
}

export function refuseProductionSeed(): boolean {
  return process.env.NODE_ENV === 'production' && !isProdSeedAllowed();
}
