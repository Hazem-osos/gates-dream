import { AppError } from '../../../shared/middleware/error-handler';

export class SubcontractDomainError extends AppError {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(statusCode, message, true);
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface BoqLimitExceededDetail {
  subcontractBOQItemId: string;
  itemCode: string;
  previousQuantity: string;
  currentQuantity: string;
  totalCumulativeQuantity: string;
  maxAllowedQuantity: string;
}

export class BoqLimitExceededError extends SubcontractDomainError {
  constructor(breaches: BoqLimitExceededDetail[]) {
    super(
      422,
      'BOQ_LIMIT_EXCEEDED',
      'Cumulative executed quantity exceeds the BOQ maxAllowedQuantity',
      { breaches }
    );
  }
}

export class SubcontractNotFoundError extends SubcontractDomainError {
  constructor(companyId: string, subcontractId: string) {
    super(404, 'SUBCONTRACT_NOT_FOUND', 'Subcontract not found', { companyId, subcontractId });
  }
}

export class SubcontractInvoiceNotFoundError extends SubcontractDomainError {
  constructor(companyId: string, invoiceId: string) {
    super(404, 'SUBCONTRACT_INVOICE_NOT_FOUND', 'Subcontract invoice not found', {
      companyId,
      invoiceId,
    });
  }
}

export class InvoiceStateError extends SubcontractDomainError {
  constructor(invoiceId: string, currentStatus: string, expected: string[]) {
    super(409, 'INVALID_INVOICE_STATE', `Invoice status must be one of: ${expected.join(', ')}`, {
      invoiceId,
      currentStatus,
      expected,
    });
  }
}

export class InvoiceImmutableError extends SubcontractDomainError {
  constructor(invoiceId: string, status: string) {
    super(409, 'INVOICE_IMMUTABLE', 'Posted or paid invoices cannot be edited', {
      invoiceId,
      status,
    });
  }
}

export class SubcontractorNotFoundError extends SubcontractDomainError {
  constructor(companyId: string, subcontractorId: string) {
    super(404, 'SUBCONTRACTOR_NOT_FOUND', 'Subcontractor not found', { companyId, subcontractorId });
  }
}

export class ContractingProjectNotFoundError extends SubcontractDomainError {
  constructor(companyId: string, projectId: string) {
    super(404, 'CONTRACTING_PROJECT_NOT_FOUND', 'Contracting project not found', { companyId, projectId });
  }
}

export class InvoiceAlreadyPostedError extends SubcontractDomainError {
  constructor(invoiceId: string) {
    super(409, 'INVOICE_ALREADY_POSTED', 'Invoice already has a journal entry', { invoiceId });
  }
}

export class MaterialItemNotFoundError extends SubcontractDomainError {
  constructor(companyId: string, itemId: string) {
    super(404, 'MATERIAL_ITEM_NOT_FOUND', 'Material item not found in this company', {
      companyId,
      itemId,
    });
  }
}
