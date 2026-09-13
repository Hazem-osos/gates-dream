import { AppError } from '../../../../shared/middleware/error-handler';

export class ClientBillingDomainError extends AppError {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(statusCode, message, true);
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface ClientBoqLimitExceededDetail {
  projectBOQItemId: string;
  itemCode: string;
  previousQuantity: string;
  currentQuantity: string;
  cumulativeQuantity: string;
  contractQuantity: string;
}

export class ClientBoqLimitExceededError extends ClientBillingDomainError {
  constructor(breaches: ClientBoqLimitExceededDetail[]) {
    super(
      422,
      'CLIENT_BOQ_LIMIT_EXCEEDED',
      'Cumulative executed quantity exceeds the owner BOQ contract quantity',
      { breaches }
    );
  }
}

export class ClientContractNotFoundError extends ClientBillingDomainError {
  constructor(companyId: string, clientContractId: string) {
    super(404, 'CLIENT_CONTRACT_NOT_FOUND', 'Client contract not found', {
      companyId,
      clientContractId,
    });
  }
}

export class ClientInvoiceNotFoundError extends ClientBillingDomainError {
  constructor(companyId: string, invoiceId: string) {
    super(404, 'CLIENT_INVOICE_NOT_FOUND', 'Client invoice not found', { companyId, invoiceId });
  }
}

export class ClientInvoiceStateError extends ClientBillingDomainError {
  constructor(invoiceId: string, currentStatus: string, expected: string[]) {
    super(409, 'INVALID_CLIENT_INVOICE_STATE', `Invoice status must be one of: ${expected.join(', ')}`, {
      invoiceId,
      currentStatus,
      expected,
    });
  }
}

export class ClientInvoiceImmutableError extends ClientBillingDomainError {
  constructor(invoiceId: string, status: string) {
    super(409, 'CLIENT_INVOICE_IMMUTABLE', 'Posted or paid client invoices cannot be edited', {
      invoiceId,
      status,
    });
  }
}

export class ClientInvoiceAlreadyPostedError extends ClientBillingDomainError {
  constructor(invoiceId: string) {
    super(409, 'CLIENT_INVOICE_ALREADY_POSTED', 'Client invoice already has a journal entry', {
      invoiceId,
    });
  }
}

export class ClientContractInactiveError extends ClientBillingDomainError {
  constructor(clientContractId: string, status: string) {
    super(409, 'CLIENT_CONTRACT_INACTIVE', 'Invoices can only be drafted against an ACTIVE client contract', {
      clientContractId,
      status,
    });
  }
}

export class ClientContractDuplicateError extends ClientBillingDomainError {
  constructor(projectId: string) {
    super(409, 'CLIENT_CONTRACT_EXISTS', 'A client contract is already registered for this project', {
      projectId,
    });
  }
}

export class ClientCustomerNotFoundError extends ClientBillingDomainError {
  constructor(companyId: string, clientCustomerId: string) {
    super(404, 'CLIENT_CUSTOMER_NOT_FOUND', 'Client customer not found', {
      companyId,
      clientCustomerId,
    });
  }
}

export class ContractingProjectNotFoundError extends ClientBillingDomainError {
  constructor(companyId: string, projectId: string) {
    super(404, 'CONTRACTING_PROJECT_NOT_FOUND', 'Contracting project not found', {
      companyId,
      projectId,
    });
  }
}
