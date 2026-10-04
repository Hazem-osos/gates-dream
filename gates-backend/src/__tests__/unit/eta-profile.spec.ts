import {
  composeEtaAddress,
  missingCustomerEtaFields,
  missingIssuerEtaFields,
  missingItemEtaFields,
} from '../../modules/electronic-invoices/utils/eta-profile';

describe('ETA master-data readiness', () => {
  it('lists missing customer, item, and issuer fields', () => {
    expect(missingCustomerEtaFields({}, '')).toEqual(
      expect.arrayContaining([
        'نوع العميل (B/P/F)',
        'الرقم الضريبي أو الرقم القومي',
        'اسم العميل في الفاتورة الإلكترونية',
        'محافظة العميل',
      ])
    );
    expect(missingItemEtaFields({}, 'تراخيص')).toEqual(
      expect.arrayContaining(['نوع كود الصنف تراخيص', 'كود ETA للصنف تراخيص', 'وحدة ETA للصنف تراخيص'])
    );
    expect(missingIssuerEtaFields({})).toEqual(
      expect.arrayContaining(['الرقم الضريبي للشركة', 'كود النشاط taxpayerActivityCode', 'محافظة الشركة'])
    );
  });

  it('accepts a complete ETA profile like the tax-authority sample', () => {
    expect(
      missingCustomerEtaFields(
        {
          receiverType: 'B',
          taxId: '769542956',
          name: 'زيورخ للتطوير',
          governate: 'القاهرة',
          regionCity: 'قسم ثان مدينة نصر',
          street: 'بلوك 124',
          buildingNumber: '1',
        },
        ''
      )
    ).toEqual([]);
    expect(
      missingItemEtaFields(
        { itemType: 'EGS', itemCode: 'EG-262290472-102020', unitType: 'JOB' },
        'تراخيص'
      )
    ).toEqual([]);
    expect(
      missingIssuerEtaFields({
        taxId: '262290472',
        name: 'شركة المصدر',
        activityCode: '6201',
        governate: 'الجيزة',
        regionCity: 'قسم الجيزة',
        street: 'حدائق الأهرام',
        buildingNumber: '134',
      })
    ).toEqual([]);
  });

  it('composes the issuer address from the branch parts', () => {
    expect(
      composeEtaAddress({
        buildingNumber: '12',
        street: 'شارع التحرير',
        district: 'الدقي',
        city: 'الجيزة',
        governorate: 'الجيزة',
        country: 'EG',
        postalCode: '12611',
      })
    ).toBe('12، شارع التحرير، الدقي، الجيزة، الجيزة، مصر، 12611');
  });
});
