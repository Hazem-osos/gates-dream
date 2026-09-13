import type { DocumentLayoutConfig } from './types';
import type { ContractorInvoiceMock, PreviewMockData, RealEstateReceiptMock, TaxInvoiceMock } from './mockData';
import { buildDocumentStyles, googleFontsLinkHref, PAGE_BOX_PX } from './presetStyles';
import { escapeHtml, formatDate, formatMoney, formatNumber, ltrSpan, renderPlaceholders } from './formatters';

export interface GenerateDocumentHtmlOptions {
  /** Precomputed base64 QR data URL (the engine itself stays sync/pure — QR generation is async). */
  qrDataUrl?: string | null;
  /** Renders only the inner page markup without the outer <html>/<head> wrapper (for embedding). */
  fragmentOnly?: boolean;
}

function headerAlignClass(config: DocumentLayoutConfig): string {
  if (config.logoPosition === 'CENTER') return 'logo-center';
  if (config.logoPosition === 'RIGHT') return 'logo-right';
  return '';
}

function renderHeader(config: DocumentLayoutConfig, docTitle: string): string {
  const logo = config.logoUrl
    ? `<img class="gdl-logo" src="${escapeHtml(config.logoUrl)}" alt="logo" style="width:${config.logoWidth}px;" />`
    : '';
  return `
    <div class="gdl-header ${headerAlignClass(config)}">
      ${logo}
      <div style="flex:1;">
        <p class="gdl-company-name-ar">${escapeHtml(config.companyNameAr || 'اسم الشركة')}</p>
        ${config.companyNameEn ? `<p class="gdl-company-name-en">${escapeHtml(config.companyNameEn)}</p>` : ''}
        ${config.tagline ? `<p class="gdl-tagline">${escapeHtml(config.tagline)}</p>` : ''}
        <div class="gdl-header-ids">
          ${config.taxId ? `<span>الرقم الضريبي: ${ltrSpan(config.taxId)}</span>` : ''}
          ${config.commercialReg ? `<span>س.ت: ${ltrSpan(config.commercialReg)}</span>` : ''}
        </div>
      </div>
      <div>
        <span class="gdl-doc-title-badge">${escapeHtml(docTitle)}</span>
      </div>
    </div>
  `;
}

function renderWatermark(config: DocumentLayoutConfig): string {
  if (!config.watermarkText) return '';
  return `<div class="gdl-watermark">${escapeHtml(config.watermarkText)}</div>`;
}

function renderSignatures(config: DocumentLayoutConfig): string {
  if (!config.showStampAndSignatures) return '';
  const labels = config.signatureLabels?.length
    ? config.signatureLabels
    : ['مهندس الموقع', 'الاستشاري', 'المراجعة المالية', 'المدير العام'];
  return `
    <div class="gdl-signature-grid">
      ${labels
        .slice(0, 8)
        .map((label) => `<div class="gdl-signature-cell"><div class="gdl-sig-space"></div>${escapeHtml(label)}</div>`)
        .join('')}
    </div>
  `;
}

function renderBankAndQr(config: DocumentLayoutConfig, qrDataUrl?: string | null): string {
  const hasBank = Boolean(config.bankDetails && config.bankDetails.length > 0);
  if (!hasBank && !config.showQrCode) return '';

  const bankBlock = hasBank
    ? `
      <div class="gdl-bank-block">
        <h4>بيانات الحساب البنكي</h4>
        ${config.bankDetails!
          .map(
            (b) => `
          <div style="margin-bottom:5px;">
            <strong>${escapeHtml(b.bankName)}</strong>
            ${b.accountName ? `<br/>${escapeHtml(b.accountName)}` : ''}
            ${b.accountNumber ? `<br/>حساب: ${ltrSpan(b.accountNumber)}` : ''}
            ${b.iban ? `<br/>IBAN: ${ltrSpan(b.iban)}` : ''}
            ${b.swift ? `<br/>SWIFT: ${ltrSpan(b.swift)}` : ''}
          </div>
        `
          )
          .join('')}
      </div>
    `
    : '<div class="gdl-bank-block"></div>';

  const qrBlock = config.showQrCode
    ? `
      <div class="gdl-qr-block">
        ${
          qrDataUrl
            ? `<img src="${qrDataUrl}" alt="QR" style="width:96px;height:96px;" />`
            : `<div class="gdl-qr-placeholder">QR</div>`
        }
        <div>رمز الاستجابة السريعة</div>
      </div>
    `
    : '';

  return `<div class="gdl-bottom-grid">${bankBlock}${qrBlock}</div>`;
}

function renderFooter(config: DocumentLayoutConfig, placeholders: Record<string, string>): string {
  if (!config.footerText) return '';
  return `<div class="gdl-footer-text">${escapeHtml(renderPlaceholders(config.footerText, placeholders))}</div>`;
}

// ---------------------------------------------------------------------------
// Per-document-type bodies
// ---------------------------------------------------------------------------

function moneyRow(label: string, value: number, currency: string, negative = false): string {
  const shown = negative ? `(${formatMoney(value, currency)})` : formatMoney(value, currency);
  return `<tr><td>${escapeHtml(label)}</td><td>${ltrSpan(shown)}</td></tr>`;
}

function contractorInvoiceBody(data: ContractorInvoiceMock, config: DocumentLayoutConfig): string {
  const cols = config.columnSettings || {};
  const showRetention = cols.showRetention !== false;
  const showAdvance = cols.showAdvanceDeductions !== false;
  const showOverhead = Boolean(cols.showOverhead) && data.overheadAmount > 0;
  const showWht = cols.showWht !== false;
  const showSocial = cols.showSocialInsurance !== false;
  const showScrap = cols.showMaterialScrap !== false;
  const showPenalties = cols.showPenalties !== false;
  const showDirect = cols.showDirectExecution !== false;
  const showEarly = cols.showEarlyPay !== false;

  const rows = data.lines
    .map(
      (l) => `
    <tr>
      <td>${escapeHtml(l.boqNo)}</td>
      <td>${escapeHtml(l.description)}</td>
      <td>${escapeHtml(l.unit)}</td>
      <td>${ltrSpan(formatNumber(l.previousQty))}</td>
      <td>${ltrSpan(formatNumber(l.currentQty))}</td>
      <td>${ltrSpan(formatNumber(l.cumulativeQty))}</td>
      <td>${ltrSpan(formatNumber(l.unitPrice, 2))}</td>
      <td>${ltrSpan(formatNumber(l.currentAmount, 2))}</td>
    </tr>
  `
    )
    .join('');

  const deductionRows = [
    moneyRow('إجمالي المستخلص الحالي (+)', data.currentExtractTotal, data.currency),
    showAdvance && data.advanceRecoveryAmount
      ? moneyRow(`استرداد دفعة مقدمة (${data.advancePaymentPercent}%) (−)`, data.advanceRecoveryAmount, data.currency, true)
      : '',
    showRetention && data.retentionAmount
      ? moneyRow(`ضمان أعمال محتجز (${data.retentionPercent}%) (−)`, data.retentionAmount, data.currency, true)
      : '',
    showWht && data.taxWithholdingAmount
      ? moneyRow(`ضريبة خصم منبع 1% — نموذج 41 (−)`, data.taxWithholdingAmount, data.currency, true)
      : '',
    showSocial && data.socialInsuranceAmount
      ? moneyRow(`تأمينات اجتماعية (${data.socialInsurancePercent}%) (−)`, data.socialInsuranceAmount, data.currency, true)
      : '',
    showScrap && data.materialScrapAmount
      ? moneyRow('هالك خامات و scrap (−)', data.materialScrapAmount, data.currency, true)
      : '',
    showPenalties && data.hsePenaltiesAmount
      ? moneyRow('غرامات سلامة مهنية HSE (−)', data.hsePenaltiesAmount, data.currency, true)
      : '',
    showPenalties && data.otherPenaltiesAmount
      ? moneyRow('غرامات موقع أخرى (−)', data.otherPenaltiesAmount, data.currency, true)
      : '',
    showDirect && data.directExecutionAmount
      ? moneyRow('تنفيذ مباشر على حساب المقاول (−)', data.directExecutionAmount, data.currency, true)
      : '',
    showEarly && data.earlyPaymentAmount
      ? moneyRow(`خصم تعجيل صرف (${data.earlyPaymentPercent}%) (−)`, data.earlyPaymentAmount, data.currency, true)
      : '',
    showOverhead ? moneyRow(`مصاريف إدارية وعمومية (${data.overheadPercent}%) (−)`, data.overheadAmount, data.currency, true) : '',
  ].join('');

  return `
    <table class="gdl-meta-box"><tbody>
      <tr><td class="gdl-meta-label">المشروع</td><td>${escapeHtml(data.projectName)}</td><td class="gdl-meta-label">رقم المستخلص</td><td>${ltrSpan(data.documentNo)}</td></tr>
      <tr><td class="gdl-meta-label">المقاول</td><td>${escapeHtml(data.contractorName)}</td><td class="gdl-meta-label">مسلسل</td><td>${ltrSpan(String(data.extractSequence))}</td></tr>
      <tr><td class="gdl-meta-label">رقم العقد</td><td>${ltrSpan(data.contractNo)}</td><td class="gdl-meta-label">فترة الأعمال</td><td>${ltrSpan(`${formatDate(data.periodStartDate)} — ${formatDate(data.periodEndDate)}`)}</td></tr>
      <tr><td class="gdl-meta-label">الموقع</td><td>${escapeHtml(data.siteLocation)}</td><td class="gdl-meta-label">التاريخ</td><td>${ltrSpan(formatDate(data.documentDate))}</td></tr>
    </tbody></table>

    <p class="gdl-section-title">جدول الكميات المنفذة (BOQ)</p>
    <table class="gdl-table">
      <thead><tr>
        <th>م.البند</th><th>الوصف</th><th>الوحدة</th>
        <th>كمية سابقة</th><th>كمية حالية</th><th>كمية تراكمية</th>
        <th>سعر الوحدة</th><th>قيمة الحالي</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="gdl-totals-box">
      <table>
        <tr><td>إجمالي المستخلصات السابقة</td><td>${ltrSpan(formatMoney(data.previousExtractsTotal, data.currency))}</td></tr>
        <tr><td>الإجمالي التراكمي</td><td>${ltrSpan(formatMoney(data.cumulativeTotal, data.currency))}</td></tr>
        ${deductionRows}
        <tr class="gdl-total-final"><td>صافي المستحق للسداد (=)</td><td>${ltrSpan(formatMoney(data.netPayable, data.currency))}</td></tr>
      </table>
    </div>
  `;
}

function realEstateReceiptBody(data: RealEstateReceiptMock, config: DocumentLayoutConfig): string {
  const cols = config.columnSettings || {};
  const showUnitDetails = cols.showUnitDetails !== false;

  return `
    <table class="gdl-meta-box"><tbody>
      <tr><td class="gdl-meta-label">المشروع</td><td>${escapeHtml(data.projectName)}</td><td class="gdl-meta-label">رقم الإيصال</td><td>${ltrSpan(data.documentNo)}</td></tr>
      <tr><td class="gdl-meta-label">العميل</td><td>${escapeHtml(data.buyerName)}</td><td class="gdl-meta-label">التاريخ</td><td>${ltrSpan(formatDate(data.documentDate))}</td></tr>
      <tr><td class="gdl-meta-label">رقم العقد</td><td>${ltrSpan(data.contractNo)}</td><td class="gdl-meta-label">الرقم القومي</td><td>${ltrSpan(data.buyerNationalId)}</td></tr>
      ${
        showUnitDetails
          ? `<tr><td class="gdl-meta-label">الوحدة</td><td>${ltrSpan(data.unitNo)} — ${escapeHtml(data.unitType)}</td><td class="gdl-meta-label">المرحلة / المبنى</td><td>${escapeHtml(data.phaseName)}${data.buildingNo ? ` — ${ltrSpan(data.buildingNo)}` : ''}</td></tr>
             <tr><td class="gdl-meta-label">المساحة</td><td>${ltrSpan(formatNumber(data.unitArea))} م²</td><td class="gdl-meta-label">نوع القسط</td><td>${escapeHtml(data.installmentType)}</td></tr>`
          : ''
      }
    </tbody></table>

    <p class="gdl-section-title">تفاصيل القسط</p>
    <table class="gdl-table">
      <thead><tr>
        <th>رقم القسط</th><th>تاريخ الاستحقاق</th><th>المستحق</th><th>المدفوع سابقاً</th><th>المدفوع الآن</th><th>غرامة التأخير</th>
      </tr></thead>
      <tbody>
        <tr>
          <td>${ltrSpan(`${data.installmentNo} / ${data.totalInstallments}`)}</td>
          <td>${ltrSpan(formatDate(data.installmentDueDate))}</td>
          <td>${ltrSpan(formatMoney(data.installmentAmount, data.currency))}</td>
          <td>${ltrSpan(formatMoney(data.previouslyPaid, data.currency))}</td>
          <td>${ltrSpan(formatMoney(data.amountPaidNow, data.currency))}</td>
          <td>${ltrSpan(formatMoney(data.lateFeesAmount, data.currency))}</td>
        </tr>
      </tbody>
    </table>

    <div class="gdl-totals-box">
      <table>
        <tr><td>إجمالي قيمة الوحدة</td><td>${ltrSpan(formatMoney(data.totalUnitPrice, data.currency))}</td></tr>
        <tr><td>طريقة السداد</td><td>${escapeHtml(data.paymentMethod)}</td></tr>
        <tr><td>رقم سند القبض</td><td>${ltrSpan(data.receiptNo)}</td></tr>
        <tr class="gdl-total-final"><td>الرصيد المتبقي</td><td>${ltrSpan(formatMoney(data.remainingBalance, data.currency))}</td></tr>
      </table>
    </div>
  `;
}

function taxInvoiceBody(data: TaxInvoiceMock, config: DocumentLayoutConfig): string {
  const cols = config.columnSettings || {};
  const showMultiCurrency = Boolean(cols.showMultiCurrency);

  const rows = data.lines
    .map(
      (l) => `
    <tr>
      <td>${escapeHtml(l.description)}</td>
      <td>${ltrSpan(formatNumber(l.quantity))}</td>
      <td>${ltrSpan(formatNumber(l.unitPrice, 2))}</td>
      <td>${ltrSpan(`${l.taxPercent}%`)}</td>
      <td>${ltrSpan(formatNumber(l.taxAmount, 2))}</td>
      <td>${ltrSpan(formatNumber(l.total, 2))}</td>
    </tr>
  `
    )
    .join('');

  return `
    <table class="gdl-meta-box"><tbody>
      <tr><td class="gdl-meta-label">البائع</td><td>${escapeHtml(data.sellerName)} (${ltrSpan(data.sellerTaxId)})</td><td class="gdl-meta-label">رقم المستند</td><td>${ltrSpan(data.documentNo)}</td></tr>
      <tr><td class="gdl-meta-label">المشتري</td><td>${escapeHtml(data.buyerName)}${data.buyerTaxId ? ` (${ltrSpan(data.buyerTaxId)})` : ''}</td><td class="gdl-meta-label">التاريخ</td><td>${ltrSpan(formatDate(data.documentDate))}</td></tr>
      <tr><td class="gdl-meta-label">عنوان المشتري</td><td>${escapeHtml(data.buyerAddress)}</td><td class="gdl-meta-label">${showMultiCurrency ? 'العملة' : 'رقم UUID (ETA)'}</td><td>${ltrSpan(showMultiCurrency ? data.currency : data.etaUuid)}</td></tr>
      ${
        data.documentKind === 'DEBIT_NOTE'
          ? `<tr><td class="gdl-meta-label">المستند الأصلي</td><td>${ltrSpan(data.originalInvoiceNo || '—')}</td><td class="gdl-meta-label">سبب الإشعار</td><td>${escapeHtml(data.penaltyReason || '—')}</td></tr>`
          : ''
      }
    </tbody></table>

    <p class="gdl-section-title">${data.documentKind === 'DEBIT_NOTE' ? 'بنود إشعار الخصم' : 'بنود الفاتورة الضريبية'}</p>
    <table class="gdl-table">
      <thead><tr><th>الوصف</th><th>الكمية</th><th>سعر الوحدة</th><th>نسبة الضريبة</th><th>قيمة الضريبة</th><th>الإجمالي</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="gdl-totals-box">
      <table>
        <tr><td>الإجمالي قبل الضريبة</td><td>${ltrSpan(formatMoney(data.subTotal, data.currency))}</td></tr>
        ${data.totalDiscount ? `<tr><td>الخصم</td><td>${ltrSpan(`(${formatMoney(data.totalDiscount, data.currency)})`)}</td></tr>` : ''}
        <tr><td>إجمالي ضريبة القيمة المضافة</td><td>${ltrSpan(formatMoney(data.totalTax, data.currency))}</td></tr>
        <tr class="gdl-total-final"><td>الإجمالي المستحق</td><td>${ltrSpan(formatMoney(data.grandTotal, data.currency))}</td></tr>
      </table>
    </div>
  `;
}

function docTitleFor(data: PreviewMockData): string {
  if (data.kind === 'CONTRACTOR_INVOICE') return `مستخلص أعمال رقم ${data.extractSequence}`;
  if (data.kind === 'REAL_ESTATE_RECEIPT') return 'إيصال سداد قسط عقاري';
  return data.documentKind === 'DEBIT_NOTE' ? 'إشعار خصم' : 'فاتورة ضريبية';
}

function bodyFor(data: PreviewMockData, config: DocumentLayoutConfig): string {
  if (data.kind === 'CONTRACTOR_INVOICE') return contractorInvoiceBody(data, config);
  if (data.kind === 'REAL_ESTATE_RECEIPT') return realEstateReceiptBody(data, config);
  return taxInvoiceBody(data, config);
}

function placeholdersFor(data: PreviewMockData): Record<string, string> {
  const base: Record<string, string> = { invoice_no: data.documentNo, doc_no: data.documentNo, date: formatDate(data.documentDate) };
  if (data.kind === 'REAL_ESTATE_RECEIPT') base.due_date = formatDate(data.installmentDueDate);
  else base.due_date = formatDate(data.documentDate);
  return base;
}

/**
 * Pure, synchronous HTML/CSS document renderer. No React, no side effects —
 * safe to call on every keystroke for the live preview, and reused verbatim
 * for print / "Download Test PDF" so the output is guaranteed pixel-identical
 * to what the user has been previewing.
 */
export function generateDocumentPageInner(
  data: PreviewMockData,
  config: DocumentLayoutConfig,
  options: GenerateDocumentHtmlOptions = {}
): string {
  const docTitle = docTitleFor(data);
  const placeholders = placeholdersFor(data);
  return `
    <div class="gdl-page gdl-avoid-break" dir="rtl">
      ${renderWatermark(config)}
      ${renderHeader(config, docTitle)}
      ${bodyFor(data, config)}
      ${renderBankAndQr(config, options.qrDataUrl)}
      ${renderSignatures(config)}
      ${renderFooter(config, placeholders)}
    </div>
  `;
}

export function wrapDocumentHtml(pageInner: string, config: DocumentLayoutConfig, title: string): string {
  const styles = buildDocumentStyles(config);
  const fontLink = googleFontsLinkHref(config.fontFamily);
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
${fontLink ? `<link rel="stylesheet" href="${fontLink}" />` : ''}
<style>${styles}</style>
</head>
<body>
${pageInner}
</body>
</html>`;
}

export function generateDocumentHtml(
  data: PreviewMockData,
  config: DocumentLayoutConfig,
  options: GenerateDocumentHtmlOptions = {}
): string {
  const docTitle = docTitleFor(data);
  const pageInner = generateDocumentPageInner(data, config, options);
  if (options.fragmentOnly) return pageInner;
  return wrapDocumentHtml(pageInner, config, docTitle);
}

export { PAGE_BOX_PX };
