import {
  buildEinvoiceSettingsPatch,
  isMaskedSecret,
  toPublicEinvoiceSettings,
} from '../../modules/electronic-invoices/utils/einvoice-settings-map';

describe('einvoice settings map', () => {
  it('maps the settings screen aliases onto stored columns', () => {
    const patch = buildEinvoiceSettingsPatch({
      username: 'eta-user',
      password1: 'secret-1',
      password2: 'pin-2',
      tokenAPI: 'https://id.eta.gov.eg',
      invoiceAPI: 'https://api.invoicing.eta.gov.eg',
      certThumbPrint: 'AB:CD',
      enabledSalesProfileIds: ['p1', ''],
    });

    expect(patch).toEqual({
      clientId: 'eta-user',
      clientSecret: 'secret-1',
      tokenPin: 'pin-2',
      apiBaseUrl: 'https://id.eta.gov.eg',
      enabledSalesProfileIds: ['p1'],
      issuerAddress: {
        invoiceAPI: 'https://api.invoicing.eta.gov.eg',
        certThumbPrint: 'AB:CD',
      },
    });
  });

  it('saves a new screen secret even if the alias clientSecret is blank', () => {
    const patch = buildEinvoiceSettingsPatch({
      username: 'eta-user',
      clientSecret: '',
      password1: 'new-secret-1',
      tokenPin: '***',
      password2: 'new-secret-2',
    });
    expect(patch.clientSecret).toBe('new-secret-1');
    expect(patch.tokenPin).toBe('new-secret-2');
  });

  it('does not wipe a saved secret when the screen sends the mask or a blank', () => {
    const patch = buildEinvoiceSettingsPatch(
      {
        username: 'eta-user',
        password1: '***',
        password2: '',
        tokenAPI: 'https://id.eta.gov.eg',
      },
      {
        clientSecret: 'kept-secret',
        tokenPin: 'kept-pin',
        issuerAddress: { governate: 'Cairo' },
      }
    );

    expect(patch.clientSecret).toBeUndefined();
    expect(patch.tokenPin).toBeUndefined();
    expect(patch.issuerAddress).toBeUndefined();
    expect(isMaskedSecret('***')).toBe(true);
  });

  it('returns screen fields from the stored row so the form can reload', () => {
    const publicSettings = toPublicEinvoiceSettings('c1', {
      clientId: 'eta-user',
      clientSecret: 'secret-1',
      tokenPin: 'pin-2',
      apiBaseUrl: 'https://id.eta.gov.eg',
      enabledSalesProfileIds: ['p1'],
      issuerAddress: { invoiceAPI: 'https://inv', certThumbPrint: 'THUMB' },
    });

    expect(publicSettings.username).toBe('eta-user');
    expect(publicSettings.password1).toBe('***');
    expect(publicSettings.password2).toBe('***');
    expect(publicSettings.tokenAPI).toBe('https://id.eta.gov.eg');
    expect(publicSettings.invoiceAPI).toBe('https://inv');
    expect(publicSettings.certThumbPrint).toBe('THUMB');
    expect(publicSettings.enabledSalesProfileIds).toEqual(['p1']);
    expect(publicSettings.password1Set).toBe(true);
  });
});
