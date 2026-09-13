/** Industry catalog. Capability labels only — not production claims. */
export const INDUSTRIES = [
  {
    id: 'trading',
    en: 'Trading & Distribution',
    ar: 'التجارة والتوزيع',
    caps: {
      en: ['Warehouses', 'Price lists', 'Distribution', 'Lots', 'Transfers', 'Customers'],
      ar: ['المستودعات', 'قوائم الأسعار', 'التوزيع', 'التشغيلة', 'التحويلات', 'العملاء'],
    },
  },
  {
    id: 'manufacturing',
    en: 'Manufacturing',
    ar: 'التصنيع',
    caps: {
      en: ['BOM', 'Production Orders', 'Material Consumption', 'Costing', 'Waste', 'Quality'],
      ar: ['قوائم المواد', 'أوامر الإنتاج', 'استهلاك المواد', 'التكلفة', 'الهالك', 'الجودة'],
    },
  },
  {
    id: 'retail',
    en: 'Retail & POS',
    ar: 'التجزئة ونقاط البيع',
    caps: {
      en: ['POS', 'Branches', 'Inventory', 'Promotions', 'Cashiers', 'Customers'],
      ar: ['نقاط البيع', 'الفروع', 'المخزون', 'العروض', 'الكاشير', 'العملاء'],
    },
  },
  {
    id: 'construction',
    en: 'Construction',
    ar: 'المقاولات',
    caps: {
      en: ['Projects', 'Contractors', 'Budgets', 'Progress Billing', 'Cost Control', 'Extracts'],
      ar: ['المشاريع', 'المقاولون', 'الميزانيات', 'مستخلصات الإنجاز', 'ضبط التكلفة', 'المستخلصات'],
    },
  },
  {
    id: 'real-estate',
    en: 'Real Estate',
    ar: 'العقارات',
    caps: {
      en: ['Units', 'Contracts', 'Collections', 'Brokers', 'Portfolios', 'Reservations'],
      ar: ['الوحدات', 'العقود', 'التحصيل', 'الوسطاء', 'المحافظ', 'الحجز'],
    },
  },
  {
    id: 'schools',
    en: 'Schools',
    ar: 'المدارس',
    caps: {
      en: ['Students', 'Fees', 'Classes', 'Attendance', 'Guardians', 'Terms'],
      ar: ['الطلاب', 'المصروفات', 'الصفوف', 'الحضور', 'أولياء الأمور', 'الفصول الدراسية'],
    },
  },
  {
    id: 'professional',
    en: 'Professional Services',
    ar: 'الخدمات المهنية',
    caps: {
      en: ['Engagements', 'Time', 'Retainers', 'Billing', 'Resources', 'Clients'],
      ar: ['التعاقدات', 'الوقت', 'الاتعاب المقدمة', 'الفوترة', 'الموارد', 'العملاء'],
    },
  },
] as const;
