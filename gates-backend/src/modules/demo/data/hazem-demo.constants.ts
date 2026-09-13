export const HAZEM_EMAIL = 'hazem@gmail.com';
export const HAZEM_DEMO_MARKER = 'HAZEM_DEMO_TRANSACTIONS_V1';
export const HAZEM_COMPANY_AR = 'شركة جيتس للتجارة والتوريدات';
export const HAZEM_COMPANY_EN = 'Gates Trading & Contracting';

export const DEMO_UNITS = [
  { code: 'PCS', arabicName: 'قطعة', englishName: 'Piece' },
  { code: 'BOX', arabicName: 'علبة', englishName: 'Box' },
  { code: 'SET', arabicName: 'طقم', englishName: 'Set' },
  { code: 'HR', arabicName: 'ساعة عمل', englishName: 'Hour' },
  { code: 'M', arabicName: 'متر', englishName: 'Meter' },
  { code: 'KG', arabicName: 'كيلو', englishName: 'Kilogram' },
  { code: 'LTR', arabicName: 'لتر', englishName: 'Liter' },
] as const;

export const DEMO_BRANCHES = [
  { code: 'BR-CAI', arabicName: 'الفرع الرئيسي - القاهرة', branchNumber: '01' },
  { code: 'BR-ALX', arabicName: 'فرع الإسكندرية', branchNumber: '02' },
] as const;

export const DEMO_WAREHOUSES = [
  { code: 'WH-GEN', arabicName: 'مخزن البضاعة العامة', englishName: 'General Goods WH', branchCode: 'BR-CAI' },
  { code: 'WH-SPR', arabicName: 'مخزن قطع الغيار', englishName: 'Spare Parts WH', branchCode: 'BR-CAI' },
  { code: 'WH-RAW', arabicName: 'مخزن الخامات', englishName: 'Raw Materials WH', branchCode: 'BR-ALX' },
] as const;

export const DEMO_SAFES = [
  { code: 'SAFE-MAIN', arabicName: 'الخزينة الرئيسية', englishName: 'Main Treasury' },
  { code: 'SAFE-SHOW', arabicName: 'خزينة المعرض', englishName: 'Showroom Safe' },
] as const;

export const DEMO_BANKS = [
  { bankCode: 'BANK-NBE', bankName: 'البنك الأهلي المصري', accountCode: 'BANK-NBE-01' },
  { bankCode: 'BANK-BM', bankName: 'بنك مصر', accountCode: 'BANK-BM-01' },
] as const;

export const DEMO_CUSTOMERS = [
  { code: 'CUST-001', arabicName: 'مجموعة طلعت مصطفى', phone: '0221234567', taxId: '123456789', city: 'القاهرة', street: 'التجمع الخامس', balance: 45000 },
  { code: 'CUST-002', arabicName: 'شركة النور للمقاولات', phone: '0233344556', taxId: '234567890', city: 'الجيزة', street: '6 أكتوبر', balance: 28000 },
  { code: 'CUST-003', arabicName: 'مستشفى السلام الدولي', phone: '0244455667', taxId: '345678901', city: 'القاهرة', street: 'مدينة نصر', balance: 62000 },
  { code: 'CUST-004', arabicName: 'مكتب استشارات هندسية', phone: '0255566778', taxId: '456789012', city: 'الإسكندرية', street: 'سموحة', balance: 12000 },
  { code: 'CUST-005', arabicName: 'شركة دلتا للتجارة', phone: '0266677889', taxId: '567890123', city: 'طنطا', street: 'شارع الجيش', balance: 8500 },
  { code: 'CUST-006', arabicName: 'مؤسسة الأهرام للمقاولات', phone: '0277788990', taxId: '678901234', city: 'القاهرة', street: 'المعادي', balance: 33000 },
  { code: 'CUST-007', arabicName: 'فندق النيل رitz', phone: '0288899001', taxId: '789012345', city: 'القاهرة', street: 'كورنيش النيل', balance: 15000 },
  { code: 'CUST-008', arabicName: 'مدرسة الج future', phone: '0299900112', taxId: '890123456', city: '6 أكتوبر', street: 'الحي 11', balance: 7000 },
  { code: 'CUST-009', arabicName: 'شركة إيسترن للاستيراد', phone: '0211223344', taxId: '901234567', city: 'بورسعيد', street: 'الميناء', balance: 41000 },
  { code: 'CUST-010', arabicName: 'مكتب محاسبة الضوء', phone: '0222334455', taxId: '012345678', city: 'المنصورة', street: 'شارع الجمهورية', balance: 5000 },
] as const;

export const DEMO_SUPPLIERS = [
  { code: 'SUP-001', arabicName: 'شركة التوريدات الكهربائية الحديثة', phone: '0220112233', taxId: '111222333', city: 'القاهرة', balance: -22000 },
  { code: 'SUP-002', arabicName: 'السويدي للكابلات', phone: '0230223344', taxId: '222333444', city: '6 أكتوبر', balance: -85000 },
  { code: 'SUP-003', arabicName: 'مصر للأسمنت', phone: '0240334455', taxId: '333444555', city: 'حلوان', balance: -120000 },
  { code: 'SUP-004', arabicName: 'الرواد لتكنولوجيا المعلومات', phone: '0250445566', taxId: '444555666', city: 'القاهرة', balance: -34000 },
  { code: 'SUP-005', arabicName: 'توشiba مصر', phone: '0260556677', taxId: '555666777', city: 'الجيزة', balance: -56000 },
  { code: 'SUP-006', arabicName: 'شركة HP مصر', phone: '0270667788', taxId: '666777888', city: 'القاهرة', balance: -18000 },
  { code: 'SUP-007', arabicName: 'مورد شبكات عالمي', phone: '0280778899', taxId: '777888999', city: 'الإسكندرية', balance: -27000 },
  { code: 'SUP-008', arabicName: 'مؤسسة الصيانة المتكاملة', phone: '0290889900', taxId: '888999000', city: 'القاهرة', balance: -9000 },
] as const;

export const DEMO_COST_CENTERS = [
  { code: 'CC-ADM', arabicName: 'الإدارة العامة' },
  { code: 'CC-NAC', arabicName: 'مشروع العاصمة الإدارية' },
  { code: 'CC-TG', arabicName: 'مشروع التجمع الخامس' },
  { code: 'CC-MNT', arabicName: 'قسم الصيانة والدعم' },
  { code: 'CC-SHR', arabicName: 'معرض مدينة نصر' },
] as const;

/** property1 stores item group label until dedicated item-groups API exists */
export const DEMO_ITEMS = [
  { serial: 'FG-DELL-G15', arabicName: 'لاب توب Dell G15', group: 'منتجات تامة للبيع', unit: 'PCS', cost: 24000, price: 30000, qty: 25, wh: 'WH-GEN' },
  { serial: 'FG-SAM-27', arabicName: 'شاشة سامسونج 27 بوصة', group: 'منتجات تامة للبيع', unit: 'PCS', cost: 5500, price: 7200, qty: 40, wh: 'WH-GEN' },
  { serial: 'FG-HP-LJ', arabicName: 'طابعة ليزر HP', group: 'منتجات تامة للبيع', unit: 'PCS', cost: 8000, price: 10500, qty: 15, wh: 'WH-GEN' },
  { serial: 'FG-KEY-MK', arabicName: 'لوحة مفاتيح ميكانيكية', group: 'منتجات تامة للبيع', unit: 'PCS', cost: 1200, price: 1800, qty: 60, wh: 'WH-GEN' },
  { serial: 'FG-UPS-1K', arabicName: 'UPS 1000VA', group: 'منتجات تامة للبيع', unit: 'PCS', cost: 3500, price: 4800, qty: 20, wh: 'WH-GEN' },
  { serial: 'RM-CAT6-305', arabicName: 'كابل شبكة Cat6 - 305م', group: 'مواد خام', unit: 'M', cost: 1800, price: 2400, qty: 50, wh: 'WH-RAW' },
  { serial: 'RM-SCH-16A', arabicName: 'مفتاح أوتوماتيك شنايدر 16A', group: 'مواد خام', unit: 'PCS', cost: 120, price: 180, qty: 200, wh: 'WH-RAW' },
  { serial: 'RM-COND-2.5', arabicName: 'كابل نحاس 2.5 مم', group: 'مواد خام', unit: 'M', cost: 45, price: 65, qty: 500, wh: 'WH-RAW' },
  { serial: 'TL-SCREW-SET', arabicName: 'طقم مفكات صيانة', group: 'أدوات ومهمات', unit: 'SET', cost: 350, price: 550, qty: 30, wh: 'WH-SPR' },
  { serial: 'TL-LADDER-3M', arabicName: 'سلم ألومنيوم 3م', group: 'أدوات ومهمات', unit: 'PCS', cost: 2200, price: 3200, qty: 8, wh: 'WH-SPR' },
  { serial: 'SRV-NET-MAINT', arabicName: 'خدمة صيانة شبكات', group: 'خدمات واستشارات', unit: 'HR', cost: 0, price: 1500, qty: 0, wh: 'WH-GEN', service: true },
  { serial: 'SRV-INSTALL', arabicName: 'استشارات تركيب أنظمة', group: 'خدمات واستشارات', unit: 'HR', cost: 0, price: 5000, qty: 0, wh: 'WH-GEN', service: true },
  { serial: 'FG-RTR-WIFI6', arabicName: 'راوتر WiFi 6', group: 'منتجات تامة للبيع', unit: 'PCS', cost: 2800, price: 3900, qty: 35, wh: 'WH-GEN' },
  { serial: 'FG-FW-UTM', arabicName: 'جدار ناري UTM', group: 'منتجات تامة للبيع', unit: 'PCS', cost: 15000, price: 19500, qty: 10, wh: 'WH-GEN' },
  { serial: 'RM-RACK-42U', arabicName: 'كابينة شبكات 42U', group: 'مواد خام', unit: 'PCS', cost: 9000, price: 12000, qty: 6, wh: 'WH-RAW' },
] as const;

export const ITEM_GROUP_ROOT = 'دليل مجموعات الأصناف';
