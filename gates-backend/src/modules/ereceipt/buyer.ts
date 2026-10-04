import { ETA_NATIONAL_ID_REGEX, ETA_RIN_REGEX, normalizeDigits } from '../electronic-invoices/utils/eta-egypt-validation';

export type EtaBuyerType = 'B' | 'P' | 'F';

export type EtaBuyer = {
  type: EtaBuyerType;
  id?: string;
  name?: string;
  mobileNumber?: string;
};

export type BuyerSource = {
  arabicName?: string | null;
  customerType?: string | null;
  how?: string | null;
  nationality?: string | null;
  taxAuthority?: string | null;
  mobile?: string | null;
};

export type BuyerIssue = { code: string; message: string; messageAr: string };

const EGYPT = new Set(['', 'EG', 'EGYPT', 'مصر', 'مصري', 'مصرية']);

function isForeign(source: BuyerSource): boolean {
  const how = String(source.how ?? '').trim().toLowerCase();
  if (how === 'export') return true;
  const nationality = String(source.nationality ?? '').trim();
  if (!nationality) return false;
  return !EGYPT.has(nationality.toUpperCase()) && !EGYPT.has(nationality);
}

/** Walk-in and named buyers. Never invents an id. */
export function buildBuyer(input: {
  customer: BuyerSource | null;
  totalAmount: number;
  threshold: number;
  sellerRin: string;
}): { buyer: EtaBuyer; errors: BuyerIssue[] } {
  const errors: BuyerIssue[] = [];
  const customer = input.customer;
  const mobile = customer?.mobile?.trim();
  if (!customer) {
    if (input.totalAmount >= input.threshold) {
      errors.push({
        code: 'BUYER_ID_REQUIRED',
        message: 'A natural person at or above the identity threshold needs a national id and name',
        messageAr: 'المشتري الشخص الطبيعي عند هذا المبلغ يحتاج رقمًا قوميًا واسمًا',
      });
    }
    return { buyer: { type: 'P' }, errors };
  }

  const name = customer.arabicName?.trim() || undefined;
  const rawId = String(customer.taxAuthority ?? '').trim();
  const digits = normalizeDigits(rawId);
  const company = String(customer.customerType ?? '').toLowerCase() === 'company';

  let buyer: EtaBuyer;
  if (company || (digits.length === 9 && String(customer.customerType ?? '').toLowerCase() !== 'individual')) {
    buyer = { type: 'B', id: digits, name, mobileNumber: mobile || undefined };
    if (!ETA_RIN_REGEX.test(digits)) {
      errors.push({
        code: 'BUYER_RIN',
        message: 'Business buyer id must be a 9-digit registration number',
        messageAr: 'رقم تسجيل المشتري التاجر يجب أن يكون 9 أرقام',
      });
    }
    if (!name) {
      errors.push({
        code: 'BUYER_NAME',
        message: 'Business buyer name is required',
        messageAr: 'اسم المشتري التاجر مطلوب',
      });
    }
    if (digits && digits === normalizeDigits(input.sellerRin)) {
      errors.push({
        code: 'BUYER_IS_SELLER',
        message: 'Buyer registration must not be the issuer registration',
        messageAr: 'لا يجوز أن يكون المشتري هو نفس تسجيل البائع',
      });
    }
  } else if (isForeign(customer)) {
    buyer = { type: 'F', id: rawId || undefined, name, mobileNumber: mobile || undefined };
    if (!rawId) {
      errors.push({
        code: 'BUYER_FOREIGN_ID',
        message: 'Foreign buyer identification is required',
        messageAr: 'رقم هوية المشتري الأجنبي مطلوب',
      });
    }
    if (!name) {
      errors.push({
        code: 'BUYER_NAME',
        message: 'Foreign buyer name is required',
        messageAr: 'اسم المشتري الأجنبي مطلوب',
      });
    }
  } else {
    buyer = { type: 'P', mobileNumber: mobile || undefined };
    const needsIdentity = input.totalAmount >= input.threshold;
    if (needsIdentity || digits) {
      if (!ETA_NATIONAL_ID_REGEX.test(digits)) {
        if (needsIdentity || rawId) {
          errors.push({
            code: 'BUYER_NATIONAL_ID',
            message: 'Natural person id must be a 14-digit national id when it is required or supplied',
            messageAr: 'الرقم القومي يجب أن يكون 14 رقمًا',
          });
        }
      } else {
        buyer.id = digits;
      }
    }
    if (needsIdentity && !name) {
      errors.push({
        code: 'BUYER_NAME',
        message: 'Natural person name is required at or above the identity threshold',
        messageAr: 'اسم المشتري مطلوب عند هذا المبلغ',
      });
    } else if (name && (needsIdentity || buyer.id)) {
      buyer.name = name;
    }
  }

  if (!buyer.mobileNumber) delete buyer.mobileNumber;
  return { buyer, errors };
}

/** Manual test / explicit B|P|F from a form. Never invents id or type. */
export function validateExplicitBuyer(input: {
  buyer: EtaBuyer;
  totalAmount: number;
  threshold: number;
  sellerRin: string;
  paymentNumber?: string | null;
}): { buyer: EtaBuyer; errors: BuyerIssue[] } {
  const errors: BuyerIssue[] = [];
  const type = input.buyer.type;
  const name = input.buyer.name?.trim() || undefined;
  const rawId = String(input.buyer.id ?? '').trim();
  const digits = normalizeDigits(rawId);
  const mobile = input.buyer.mobileNumber?.trim();
  const buyer: EtaBuyer = { type, mobileNumber: mobile || undefined, name, id: rawId || digits || undefined };

  if (type === 'B') {
    buyer.id = digits;
    if (!ETA_RIN_REGEX.test(digits)) {
      errors.push({ code: 'BUYER_RIN', message: 'Business buyer id must be a 9-digit registration number', messageAr: 'رقم تسجيل المشتري التاجر يجب أن يكون 9 أرقام' });
    }
    if (!name) errors.push({ code: 'BUYER_NAME', message: 'Business buyer name is required', messageAr: 'اسم المشتري التاجر مطلوب' });
    if (digits && digits === normalizeDigits(input.sellerRin)) {
      errors.push({ code: 'BUYER_IS_SELLER', message: 'Buyer registration must not be the issuer registration', messageAr: 'لا يجوز أن يكون المشتري هو نفس تسجيل البائع' });
    }
  } else if (type === 'F') {
    if (!rawId) errors.push({ code: 'BUYER_FOREIGN_ID', message: 'Foreign buyer identification is required', messageAr: 'رقم هوية المشتري الأجنبي مطلوب' });
    if (!name) errors.push({ code: 'BUYER_NAME', message: 'Foreign buyer name is required', messageAr: 'اسم المشتري الأجنبي مطلوب' });
  } else {
    const needsIdentity = input.totalAmount >= input.threshold;
    if (needsIdentity || digits) {
      if (!ETA_NATIONAL_ID_REGEX.test(digits)) {
        if (needsIdentity || rawId) {
          errors.push({ code: 'BUYER_NATIONAL_ID', message: 'Natural person id must be a 14-digit national id when it is required or supplied', messageAr: 'الرقم القومي يجب أن يكون 14 رقمًا' });
        }
      } else {
        buyer.id = digits;
      }
    }
    if (needsIdentity && !name) {
      errors.push({ code: 'BUYER_NAME', message: 'Natural person name is required at or above the identity threshold', messageAr: 'اسم المشتري مطلوب عند هذا المبلغ' });
    }
  }
  if (input.paymentNumber?.trim()) {
    (buyer as EtaBuyer & { paymentNumber?: string }).paymentNumber = input.paymentNumber.trim().slice(0, 30);
  }
  return { buyer, errors };
}
