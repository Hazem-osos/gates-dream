import { AppError } from '../../../../shared/middleware/error-handler';

export class LgDomainError extends AppError {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(statusCode, message, true);
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LgInvalidStateError extends LgDomainError {
  constructor(lgId: string, currentStatus: string, expected: string[]) {
    super(409, 'LG_INVALID_STATE', `Letter of guarantee status must be one of: ${expected.join(', ')}`, {
      lgId,
      currentStatus,
      expected,
    });
  }
}

export class LgInsufficientMarginError extends LgDomainError {
  constructor(details?: unknown) {
    super(
      422,
      'LG_INSUFFICIENT_MARGIN',
      'Cash margin adjustment would leave a negative cover balance',
      details
    );
  }
}

export class ProjectLetterOfGuaranteeNotFoundError extends LgDomainError {
  constructor(companyId: string, lgId: string) {
    super(404, 'PROJECT_LG_NOT_FOUND', 'Project letter of guarantee not found', { companyId, lgId });
  }
}

export class ContractingProjectNotFoundError extends LgDomainError {
  constructor(companyId: string, projectId: string) {
    super(404, 'CONTRACTING_PROJECT_NOT_FOUND', 'Contracting project not found', {
      companyId,
      projectId,
    });
  }
}

export class LgBankAccountNotFoundError extends LgDomainError {
  constructor(companyId: string, bankAccountId: string) {
    super(404, 'LG_BANK_ACCOUNT_NOT_FOUND', 'Bank account not found for this company', {
      companyId,
      bankAccountId,
    });
  }
}

export class LgAlreadyPostedError extends LgDomainError {
  constructor(lgId: string) {
    super(409, 'LG_ALREADY_POSTED', 'Letter of guarantee already has an issuance journal entry', {
      lgId,
    });
  }
}
