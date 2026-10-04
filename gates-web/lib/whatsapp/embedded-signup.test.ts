import { interpretEmbeddedSignupMessage, selectableTemplates } from './embedded-signup';

describe('embedded signup messages', () => {
  it('reads the finish payload and ignores other origins', () => {
    expect(
      interpretEmbeddedSignupMessage(
        'https://www.facebook.com',
        JSON.stringify({
          type: 'WA_EMBEDDED_SIGNUP',
          event: 'FINISH',
          data: { waba_id: 'waba', phone_number_id: 'phone' },
        })
      )
    ).toEqual({ event: 'FINISH', finishEvent: 'FINISH', session: { wabaId: 'waba', phoneNumberId: 'phone' } });
    expect(interpretEmbeddedSignupMessage('https://evil.example', '{"type":"WA_EMBEDDED_SIGNUP"}')).toBeNull();
    expect(interpretEmbeddedSignupMessage('https://notfacebook.com', '{"type":"WA_EMBEDDED_SIGNUP","event":"FINISH"}')).toBeNull();
  });

  it('maps cancel and keeps only approved templates selectable', () => {
    expect(interpretEmbeddedSignupMessage('https://facebook.com', { type: 'WA_EMBEDDED_SIGNUP', event: 'CANCEL' })).toEqual({
      event: 'CANCEL',
    });
    expect(
      selectableTemplates([
        { name: 'ok', usable: true },
        { name: 'no', usable: false },
      ]).map((row) => row.name)
    ).toEqual(['ok']);
  });
});
