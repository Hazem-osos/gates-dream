import {
  canStartEtaSigning,
  nextEtaSigningState,
} from './eta-signing-state';

describe('ETA signing state machine', () => {
  it('blocks a second start while preparing or submitting', () => {
    expect(canStartEtaSigning('IDLE')).toBe(true);
    expect(canStartEtaSigning('PREPARING_DOCUMENT')).toBe(false);
    expect(canStartEtaSigning('SUBMITTING_TO_ETA')).toBe(false);
    expect(nextEtaSigningState('PREPARING_DOCUMENT', 'prepare')).toBe('PREPARING_DOCUMENT');
  });

  it('walks the happy path without skipping submit', () => {
    let state = nextEtaSigningState('IDLE', 'prepare');
    expect(state).toBe('PREPARING_DOCUMENT');
    state = nextEtaSigningState(state, 'prepared');
    expect(state).toBe('OPENING_SIGNER');
    state = nextEtaSigningState(state, 'waiting');
    expect(state).toBe('WAITING_FOR_SIGNATURE');
    state = nextEtaSigningState(state, 'signed');
    expect(state).toBe('SIGNED');
    state = nextEtaSigningState(state, 'submit');
    expect(state).toBe('SUBMITTING_TO_ETA');
    state = nextEtaSigningState(state, 'accepted');
    expect(state).toBe('ACCEPTED');
  });

  it('maps local signer failures without blaming the server', () => {
    expect(nextEtaSigningState('OPENING_SIGNER', 'signer-missing')).toBe('SIGNER_NOT_INSTALLED');
    expect(nextEtaSigningState('WAITING_FOR_SIGNATURE', 'token-missing')).toBe('TOKEN_NOT_FOUND');
    expect(nextEtaSigningState('WAITING_FOR_SIGNATURE', 'cancelled')).toBe('USER_CANCELLED');
    expect(nextEtaSigningState('SUBMITTING_TO_ETA', 'rejected')).toBe('REJECTED');
  });
});
