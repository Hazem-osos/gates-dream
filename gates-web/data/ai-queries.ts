export const AI_QUERIES = [
  {
    id: '01',
    question: {
      en: 'Why did gross profit decrease this month?',
      ar: 'لماذا انخفض مجمل الربح هذا الشهر؟',
    },
    response: {
      en: {
        title: 'Gross profit ↓ 8.4%',
        items: ['Branch performance', 'Material cost', 'Discounting'],
        action: 'View analysis',
      },
      ar: {
        title: 'مجمل الربح ↓ 8.4%',
        items: ['أداء الفروع', 'تكلفة المواد', 'الخصومات'],
        action: 'عرض التحليل',
      },
    },
  },
  {
    id: '02',
    question: {
      en: 'Which customers have not purchased recently?',
      ar: 'أي العملاء لم يشتروا مؤخراً؟',
    },
    response: {
      en: {
        title: 'Customer segments',
        items: ['Dormant 90+ days', 'Low frequency', 'High historic value'],
        action: 'View segments',
      },
      ar: {
        title: 'شرائح العملاء',
        items: ['خاملون أكثر من 90 يوماً', 'تكرار منخفض', 'قيمة تاريخية مرتفعة'],
        action: 'عرض الشرائح',
      },
    },
  },
  {
    id: '03',
    question: {
      en: 'Forecast our cash position.',
      ar: 'توقّع مركزنا النقدي.',
    },
    response: {
      en: {
        title: 'Cash forecast',
        items: ['Next 30 days', 'Receivables window', 'Payables pressure'],
        action: 'View forecast',
      },
      ar: {
        title: 'توقع نقدي',
        items: ['الثلاثون يوماً القادمة', 'نافذة التحصيل', 'ضغط المدفوعات'],
        action: 'عرض التوقع',
      },
    },
  },
  {
    id: '04',
    question: {
      en: 'Show unusual inventory movements.',
      ar: 'أظهر حركات المخزون غير المعتادة.',
    },
    response: {
      en: {
        title: 'Anomalies',
        items: ['Out-of-pattern issues', 'Branch outliers', 'Negative adjustments'],
        action: 'View anomalies',
      },
      ar: {
        title: 'حالات شاذة',
        items: ['صرف خارج النمط', 'فروع شاذة', 'تسويات سالبة'],
        action: 'عرض الحالات',
      },
    },
  },
] as const;

export const AI_CAPABILITIES = [
  { en: 'Ask your business', ar: 'اسأل عملك' },
  { en: 'Explain reports', ar: 'اشرح التقارير' },
  { en: 'Detect anomalies', ar: 'اكتشف الشذوذ' },
  { en: 'Forecast', ar: 'توقّع' },
  { en: 'Recommend actions', ar: 'اقترح إجراءات' },
  { en: 'Generate summaries', ar: 'ولّد ملخصات' },
] as const;
