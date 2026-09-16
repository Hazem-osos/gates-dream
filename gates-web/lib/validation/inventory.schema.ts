import { z } from 'zod';

const id = z.string().min(1);

/** سطر صنف شائع (نقل / إضافة / صرف …) */
export const inventoryStdLineSchema = z.object({
  itemId: id,
  quantity: z.coerce.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  unitPrice: z.coerce.number().min(0),
});

export type InventoryStdLineInput = z.infer<typeof inventoryStdLineSchema>;

/** رأس نقل مخزني */
export const inventoryTransferHeaderFormSchema = z
  .object({
    serialNumber: z.string().optional(),
    description: z.string().optional(),
    date: z.string().min(1, 'التاريخ مطلوب'),
    hijriDate: z.string().optional(),
    fromWarehouseId: z.string(),
    toWarehouseId: z.string(),
    fromCostCenterId: z.string().optional(),
    toCostCenterId: z.string().optional(),
    statusPosted: z.boolean(),
    useBarcode: z.boolean(),
    hideExistingQty: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (!d.fromWarehouseId.trim()) {
      ctx.addIssue({ code: 'custom', message: 'يرجى اختيار المخزن المصدر', path: ['fromWarehouseId'] });
    }
    if (!d.toWarehouseId.trim()) {
      ctx.addIssue({ code: 'custom', message: 'يرجى اختيار المخزن الهدف', path: ['toWarehouseId'] });
    }
    if (
      d.fromWarehouseId.trim() &&
      d.toWarehouseId.trim() &&
      d.fromWarehouseId === d.toWarehouseId
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'المخزن المصدر والهدف يجب أن يكونا مختلفين',
        path: ['toWarehouseId'],
      });
    }
  });

export type InventoryTransferHeaderFormInput = z.infer<typeof inventoryTransferHeaderFormSchema>;

/** مستند بمخزن واحد (إضافة، صرف، مخزون افتتاحي، تسوية، مرتجع شراء …) */
export const inventoryWarehouseDocHeaderFormSchema = z.object({
  serialNumber: z.string().optional(),
  description: z.string().optional(),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
  warehouseId: z.string().min(1, 'يرجى اختيار المخزن'),
  record: z.string().optional(),
  isPosted: z.boolean(),
  isApproved: z.boolean(),
  useBarcode: z.boolean(),
  hideExistingQty: z.boolean(),
});

export type InventoryWarehouseDocHeaderFormInput = z.infer<typeof inventoryWarehouseDocHeaderFormSchema>;

/** بضاعة أول المدة — رأس */
export const inventoryOpeningStockHeaderFormSchema = z.object({
  date: z.string().min(1, 'يرجى اختيار التاريخ'),
  description: z.string().optional().default(''),
  warehouseId: z.string().optional().default(''),
});

export type InventoryOpeningStockHeaderFormInput = z.infer<typeof inventoryOpeningStockHeaderFormSchema>;

export const inventoryOpeningStockLineSchema = z.object({
  itemId: id,
  warehouseId: z.string().min(1),
  quantity: z.coerce.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  unitPrice: z.coerce.number().min(0),
});

export const inventoryReceiptLineSchema = z.object({
  itemId: id,
  locationId: z.string().optional(),
  quantity: z.coerce.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  unitPrice: z.coerce.number().min(0).optional(),
  total: z.coerce.number().min(0).optional(),
});

/** تسوية مخزنية — سطر */
export const inventoryAdjustmentLineSchema = z.object({
  itemId: id,
  locationId: z.string().optional(),
  bookQuantity: z.coerce.number().min(0).optional(),
  actualQuantity: z.coerce.number().min(0, 'أدخل الكمية الفعلية'),
  unitPrice: z.coerce.number().min(0).optional(),
  adjustmentQuantity: z.coerce.number().optional(),
  adjustmentTotal: z.coerce.number().min(0).optional(),
});

/** أمر شراء */
export const inventoryPurchaseOrderHeaderFormSchema = z.object({
  orderNumber: z.string().optional(),
  description: z.string().optional(),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
  supplierId: z.string().min(1, 'يرجى اختيار المورد'),
  warehouseId: z.string().min(1, 'يرجى اختيار المخزن'),
  costCenterId: z.string().optional(),
  currencyId: z.string().optional(),
  isPosted: z.boolean(),
  isApproved: z.boolean(),
  useBarcode: z.boolean(),
  hideExistingQty: z.boolean(),
});

export type InventoryPurchaseOrderHeaderFormInput = z.infer<typeof inventoryPurchaseOrderHeaderFormSchema>;

export const inventoryPurchaseOrderLineSchema = z.object({
  itemId: id,
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).optional(),
  tax: z.coerce.number().min(0).optional(),
});

/** عروض أصناف / عرض سعر — عميل اختياري + مخزن */
export const inventoryCustomerWarehouseHeaderFormSchema = z.object({
  serialNumber: z.string().optional(),
  description: z.string().optional(),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
  warehouseId: z.string().min(1, 'يرجى اختيار المخزن'),
  customerId: z.string().optional(),
  isPosted: z.boolean(),
  isApproved: z.boolean(),
  useBarcode: z.boolean(),
  hideExistingQty: z.boolean(),
});

export type InventoryCustomerWarehouseHeaderFormInput = z.infer<typeof inventoryCustomerWarehouseHeaderFormSchema>;

/** فاتورة شراء نهائية — مورد + مخزن */
export const inventorySupplierWarehouseHeaderFormSchema = z.object({
  serialNumber: z.string().optional(),
  description: z.string().optional(),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
  warehouseId: z.string().min(1, 'يرجى اختيار المخزن'),
  supplierId: z.string().min(1, 'يرجى اختيار المورد'),
  record: z.string().optional(),
  isPosted: z.boolean(),
  isApproved: z.boolean(),
  useBarcode: z.boolean(),
  hideExistingQty: z.boolean(),
});

export type InventorySupplierWarehouseHeaderFormInput = z.infer<typeof inventorySupplierWarehouseHeaderFormSchema>;

/** تجميع / تفكيك — مخزن + ملاحظات */
export const inventoryAssemblyHeaderFormSchema = z.object({
  serialNumber: z.string().optional(),
  description: z.string().optional(),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
  warehouseId: z.string().min(1, 'يرجى اختيار المخزن'),
  isPosted: z.boolean(),
  isApproved: z.boolean(),
  useBarcode: z.boolean(),
  hideExistingQty: z.boolean(),
});

export type InventoryAssemblyHeaderFormInput = z.infer<typeof inventoryAssemblyHeaderFormSchema>;

/** جرد مخزني */
export const inventoryStocktakingHeaderFormSchema = z.object({
  serialNumber: z.string().optional(),
  description: z.string().optional(),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
  warehouseId: z.string().min(1, 'يرجى اختيار المخزن'),
  isPosted: z.boolean(),
  isApproved: z.boolean(),
  useBarcode: z.boolean(),
  hideExistingQty: z.boolean(),
});

export type InventoryStocktakingHeaderFormInput = z.infer<typeof inventoryStocktakingHeaderFormSchema>;

/** جرد — حقول إضافية للواجهة */
export const inventoryStocktakingPageFormSchema = inventoryStocktakingHeaderFormSchema.extend({
  excludeZeroValue: z.boolean(),
});

export type InventoryStocktakingPageFormInput = z.infer<typeof inventoryStocktakingPageFormSchema>;

/** إضافات وخصومات أخرى على التسعير */
export const inventoryPricingAdjustmentHeaderFormSchema = z.object({
  serialNumber: z.string().optional(),
  description: z.string().optional(),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
  warehouseId: z.string().min(1, 'يرجى اختيار المخزن'),
  adjustmentType: z.string().optional(),
  isPosted: z.boolean(),
  isApproved: z.boolean(),
  useBarcode: z.boolean(),
  hideExistingQty: z.boolean(),
});

export type InventoryPricingAdjustmentHeaderFormInput = z.infer<typeof inventoryPricingAdjustmentHeaderFormSchema>;

export const inventoryQuoteLineSchema = z.object({
  itemId: id,
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).optional(),
});

export const inventoryPriceQuoteFormSchema = inventoryCustomerWarehouseHeaderFormSchema
  .extend({
    customerId: z.string().min(1, 'يرجى اختيار العميل'),
    costCenterId: z.string().optional(),
    currencyId: z.string().optional(),
    delegateId: z.string().optional(),
  })
  .merge(
    z.object({
      lines: z.array(inventoryQuoteLineSchema).min(1, 'أضف سطراً واحداً على الأقل'),
    })
  );

export type InventoryPriceQuoteFormInput = z.infer<typeof inventoryPriceQuoteFormSchema>;

export const inventoryPriceQuoteHeaderFormSchema = inventoryPriceQuoteFormSchema.omit({ lines: true });
export type InventoryPriceQuoteHeaderFormInput = z.infer<typeof inventoryPriceQuoteHeaderFormSchema>;

export const inventoryPurchaseOrderFormSchema = inventoryPurchaseOrderHeaderFormSchema.merge(
  z.object({
    lines: z.array(inventoryPurchaseOrderLineSchema).min(1, 'أضف سطراً واحداً على الأقل'),
  })
);

export type InventoryPurchaseOrderFormInput = z.infer<typeof inventoryPurchaseOrderFormSchema>;

export const inventorySupplierInvoiceFormSchema = inventorySupplierWarehouseHeaderFormSchema.merge(
  z.object({
    lines: z.preprocess(
      dropBlankInvoiceLines,
      z.array(inventoryPurchaseOrderLineSchema)
    ),
  })
);

export type InventorySupplierInvoiceFormInput = z.infer<typeof inventorySupplierInvoiceFormSchema>;

export const inventorySupplierInvoiceHeaderFormSchema = inventorySupplierInvoiceFormSchema.omit({ lines: true });
export type InventorySupplierInvoiceHeaderFormInput = z.infer<typeof inventorySupplierInvoiceHeaderFormSchema>;

export const inventoryPurchaseReturnFormSchema = inventorySupplierWarehouseHeaderFormSchema.merge(
  z.object({
    lines: z.array(inventoryPurchaseOrderLineSchema).min(1, 'أضف سطراً واحداً على الأقل'),
  })
);

export type InventoryPurchaseReturnFormInput = z.infer<typeof inventoryPurchaseReturnFormSchema>;

export const inventoryPurchaseReturnHeaderFormSchema = inventoryPurchaseReturnFormSchema.omit({ lines: true });
export type InventoryPurchaseReturnHeaderFormInput = z.infer<typeof inventoryPurchaseReturnHeaderFormSchema>;

/** تجميع / تفكيك — مخزنان + صنف رئيسي + كمية */
export const inventoryBomOperationFormSchema = z
  .object({
    serialNumber: z.string().optional(),
    description: z.string().optional(),
    date: z.string().min(1, 'التاريخ مطلوب'),
    hijriDate: z.string().optional(),
    fromWarehouseId: z.string().min(1, 'يرجى اختيار المخزن'),
    toWarehouseId: z.string().min(1, 'يرجى اختيار المخزن الهدف'),
    fromCostCenterId: z.string().optional(),
    toCostCenterId: z.string().optional(),
    mainItemId: z.string().min(1, 'يرجى اختيار الصنف'),
    quantity: z.coerce.number().positive('الكمية يجب أن تكون أكبر من صفر'),
    isPosted: z.boolean(),
    isApproved: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (
      d.fromWarehouseId.trim() &&
      d.toWarehouseId.trim() &&
      d.fromWarehouseId === d.toWarehouseId
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'المخزن المصدر والهدف يجب أن يكونا مختلفين',
        path: ['toWarehouseId'],
      });
    }
  });

export type InventoryBomOperationFormInput = z.infer<typeof inventoryBomOperationFormSchema>;

export const inventoryItemOfferFormSchema = z
  .object({
    nameAr: z.string().trim().min(1, 'يرجى إدخال اسم العرض'),
    description: z.string().optional(),
    targetType: z.enum(['SALES', 'PURCHASES']),
    promotionType: z.enum(['BUY_X_GET_Y', 'DISCOUNT_PERCENTAGE', 'INVOICE_TOTAL_THRESHOLD']),
    sourceItemId: z.string().optional(),
    sourceQuantity: z.string().optional(),
    giftItemId: z.string().optional(),
    giftQuantity: z.string().optional(),
    invoiceThresholdAmount: z.string().optional(),
    discountPercentage: z.string().optional(),
    startDate: z.string().min(1, 'يرجى اختيار تاريخ البداية'),
    endDate: z.string().min(1, 'يرجى اختيار تاريخ النهاية'),
    applyToAllParties: z.boolean(),
    targetPartyIds: z.array(z.string()),
    applyToAllPatterns: z.boolean(),
    targetPatternIds: z.array(z.string()),
    isActive: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'تاريخ النهاية يجب أن يكون بعد البداية' });
    }
    if (data.promotionType !== 'INVOICE_TOTAL_THRESHOLD' && !data.sourceItemId?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['sourceItemId'], message: 'يرجى اختيار الصنف الأساسي' });
    }
    if (data.promotionType !== 'INVOICE_TOTAL_THRESHOLD') {
      const q = parseFloat(data.sourceQuantity ?? '');
      if (!data.sourceQuantity?.trim() || Number.isNaN(q) || q <= 0) {
        ctx.addIssue({ code: 'custom', path: ['sourceQuantity'], message: 'يرجى إدخال كمية صحيحة' });
      }
    }
    if (data.promotionType === 'BUY_X_GET_Y') {
      if (!data.giftItemId?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['giftItemId'], message: 'يرجى اختيار الصنف الهدية' });
      }
      const gq = parseFloat(data.giftQuantity ?? '');
      if (!data.giftQuantity?.trim() || Number.isNaN(gq) || gq <= 0) {
        ctx.addIssue({ code: 'custom', path: ['giftQuantity'], message: 'يرجى إدخال كمية الهدية' });
      }
    }
    if (data.promotionType === 'DISCOUNT_PERCENTAGE' || data.promotionType === 'INVOICE_TOTAL_THRESHOLD') {
      const p = parseFloat(data.discountPercentage ?? '');
      if (!data.discountPercentage?.trim() || Number.isNaN(p) || p < 0 || p > 100) {
        ctx.addIssue({ code: 'custom', path: ['discountPercentage'], message: 'يرجى إدخال نسبة خصم صحيحة (0-100)' });
      }
    }
    if (data.promotionType === 'INVOICE_TOTAL_THRESHOLD') {
      const v = parseFloat(data.invoiceThresholdAmount ?? '');
      if (!data.invoiceThresholdAmount?.trim() || Number.isNaN(v) || v < 0) {
        ctx.addIssue({ code: 'custom', path: ['invoiceThresholdAmount'], message: 'يرجى إدخال الحد الأدنى لقيمة الفاتورة' });
      }
    }
    if (!data.applyToAllParties && data.targetPartyIds.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetPartyIds'],
        message: 'اختر طرفاً واحداً على الأقل أو فعّل تطبيق على كافة الأطراف',
      });
    }
    if (!data.applyToAllPatterns && data.targetPatternIds.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetPatternIds'],
        message: 'اختر نمط إدخال واحد على الأقل أو فعّل تطبيق على كافة الوحدات',
      });
    }
  });

export type InventoryItemOfferFormInput = z.infer<typeof inventoryItemOfferFormSchema>;

export const inventoryOtherAdditionDiscountTypeFormSchema = z.object({
  serialNumber: z.string().optional(),
  name: z.string().trim().min(1, 'الاسم مطلوب'),
  accountId: z.string().optional(),
  offsetAccountId: z.string().optional(),
  abbreviation: z.string().optional(),
  isActive: z.boolean(),
  base: z.enum(['amount', 'discount-origin']),
  type: z.enum(['addition', 'discount']),
});

export type InventoryOtherAdditionDiscountTypeFormInput = z.infer<
  typeof inventoryOtherAdditionDiscountTypeFormSchema
>;

/** فاتورة مبيعات — يستخدمها `sales-invoice/page.tsx` */
export const salesInvoiceLineSchema = z.object({
  itemId: z.string().min(1, 'اختر الصنف'),
  unitId: z.string().optional(),
  quantity: z.coerce.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  baseQuantity: z.coerce.number().positive().optional(),
  conversionFactor: z.coerce.number().positive().optional(),
  baseUnitId: z.string().optional(),
  unitPrice: z.coerce.number().min(0),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().default('PERCENTAGE'),
  discountValue: z.coerce.number().min(0, 'الخصم لا يمكن أن يكون سالباً').optional(),
  discount: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).optional(),
  barcode: z.string().optional(),
  costCenterId: z.string().optional(),
  lineAccountId: z.string().optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  productionDate: z.string().optional(),
  serialNumbers: z.string().optional(),
  lineNotes: z.string().optional(),
  taxExemptionReason: z.string().optional(),
  warehouseId: z.string().optional(),
  withholdingTaxRate: z.coerce.number().min(0).optional(),
  withholdingTaxAmount: z.coerce.number().min(0).optional(),
  batchAllocations: z
    .array(
      z.object({
        batchId: z.string().optional(),
        batchNumber: z.string(),
        qty: z.coerce.number(),
        expiryDate: z.string().optional().nullable(),
      })
    )
    .optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  customRevenueAccountId: z.string().optional(),
}).superRefine((data, ctx) => {
  const type = data.discountType === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
  const value = Number(data.discountValue ?? data.discount ?? 0);
  if (!Number.isFinite(value) || value < 0) return;
  if (type === 'PERCENTAGE' && value > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discountValue'],
      message: 'نسبة الخصم يجب أن تكون بين 0 و 100%',
    });
  }
  if (type === 'FIXED') {
    const itemSubtotal = (Number(data.unitPrice) || 0) * (Number(data.quantity) || 0);
    if (value > itemSubtotal + 0.0001) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'قيمة الخصم لا يمكن أن تتجاوز إجمالي البند قبل الخصم',
      });
    }
  }
});

const emptyOptional = (value: unknown) =>
  value === '' || value === null || (typeof value === 'number' && Number.isNaN(value))
    ? undefined
    : value;

export function dropBlankInvoiceLines<T extends { itemId?: string | null }>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((line): line is T => Boolean(String((line as T | undefined)?.itemId ?? '').trim()));
}

export const salesInvoiceSchema = z.object({
  customerId: z.string().min(1, 'اختر العميل'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  /** Enterprise redesign: optional explicit due date — left blank lets the
   * backend derive it from the customer's payment terms (resolveDueDate). */
  dueDate: z.string().optional(),
  paymentMethod: z.enum(['cash', 'credit', 'split']),
  /** Free-text payment terms (e.g. "شيك بنكي 60 يوم") — not cash/credit/split. */
  paymentTermsMethod: z.string().optional(),
  pricingCalculationBasis: z.enum(['SELECTED_UNIT_QTY', 'BASE_UNIT_QTY']).optional(),
  /** Credit invoices: optional cash collected now (rest stays AR). */
  advancePaidAmount: z.preprocess(
    emptyOptional,
    z.coerce.number().min(0, 'مبلغ المقدم لا يمكن أن يكون سالباً').optional()
  ),
  advanceSafeId: z.string().optional(),
  warehouseId: z.string().min(1, 'اختر المخزن'),
  invoiceNumber: z.string().optional(),
  description: z.string().optional(),
  hijriDate: z.string().optional(),
  currencyId: z.string().optional(),
  /** Auto-filled from the selected currency's maintained rate, editable.
   * Empty number inputs become NaN via valueAsNumber — treat as unset. */
  exchangeRate: z.preprocess(
    emptyOptional,
    z.coerce.number().positive('سعر الصرف يجب أن يكون أكبر من صفر').optional()
  ),
  costCenterId: z.string().optional(),
  delegateId: z.string().optional(),
  /** Distinct "Salesman" — separate from the sales-rep delegate above. */
  sellerId: z.string().optional(),
  taxTreatmentType: z.preprocess(
    emptyOptional,
    z.enum(['taxable', 'exempt', 'export']).optional()
  ),
  allowReturn: z.boolean().optional(),
  returnDays: z.number().int().positive().optional(),
  isDelivered: z.boolean().optional(),
  handoverDate: z.string().optional(),
  printTermsOnInvoice: z.boolean().optional(),
  /** خزنة التحصيل النقدي — إجبارية عندما طريقة الدفع نقدي */
  treasuryId: z.string().optional(),
  salesOrderNumber: z.string().optional(),
  salesOrderDescription: z.string().optional(),
  purchaseOrderNumber: z.string().optional(),
  purchaseOrderDescription: z.string().optional(),
  sourceType: z
    .enum(['NONE', 'QUOTATION', 'SALES_ORDER', 'PURCHASE_ORDER', 'PURCHASE_INVOICE', 'DELIVERY_NOTE'])
    .optional(),
  sourceId: z.string().optional(),
  sourceNumber: z.string().optional(),
  developmentFeeEnabled: z.boolean().optional(),
  developmentFeeMode: z.enum(['percent', 'fixed']).optional(),
  developmentFeeRate: z.preprocess(
    emptyOptional,
    z.coerce.number().min(0, 'نسبة رسم التنمية لا يمكن أن تكون سالبة').max(100).optional()
  ),
  developmentFeeFixedAmount: z.preprocess(
    emptyOptional,
    z.coerce.number().min(0, 'قيمة رسم التنمية لا يمكن أن تكون سالبة').optional()
  ),
  lines: z.preprocess(
    dropBlankInvoiceLines,
    z.array(salesInvoiceLineSchema)
  ),
}).superRefine((data, ctx) => {
  const method = String(data.paymentMethod ?? '').toLowerCase();
  if (method === 'cash' && !String(data.treasuryId ?? '').trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'يجب تحديد الخزنة في الفاتورة النقدية',
      path: ['treasuryId'],
    });
  }
  if (method === 'credit' && (Number(data.advancePaidAmount) || 0) > 0 && !String(data.advanceSafeId ?? '').trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'حدد الخزينة عند دفع مبلغ في الأول',
      path: ['advanceSafeId'],
    });
  }
});

export type SalesInvoiceFormValues = z.infer<typeof salesInvoiceSchema>;

const optionalNonNegPrice = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return undefined;
  const n = typeof val === 'number' ? val : Number(String(val).replace(/,/g, ''));
  return Number.isFinite(n) ? n : val;
}, z.number().nonnegative('السعر لا يمكن أن يكون سالباً').optional());

/** بطاقة الصنف — الحقول الأساسية + الأعلام وشرائح الأسعار. */
export const itemCardFormSchema = z.object({
  serial: z.string().optional(),
  arabicName: z.string().trim().min(1, 'يرجى إدخال الإسم العربي'),
  englishName: z.string().optional(),
  isService: z.boolean(),
  isAssembly: z.boolean(),
  isTaxExempt: z.boolean(),
  beginningCostPrice: optionalNonNegPrice,
  priceRetail: optionalNonNegPrice,
  consumerPrice: optionalNonNegPrice,
  retailPrice: optionalNonNegPrice,
  representativePrice: optionalNonNegPrice,
  exportPrice: optionalNonNegPrice,
});

export type ItemCardFormInput = z.infer<typeof itemCardFormSchema>;
