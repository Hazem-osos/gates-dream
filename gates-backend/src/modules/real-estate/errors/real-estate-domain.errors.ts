import { AppError } from '../../../shared/middleware/error-handler';

export class RealEstateDomainError extends AppError {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(statusCode, message, true);
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InstallmentMismatchError extends RealEstateDomainError {
  constructor(expected: string, actual: string) {
    super(
      422,
      'INSTALLMENT_MISMATCH',
      'Installment schedule total does not equal selling price plus maintenance deposit',
      { expected, actual }
    );
  }
}

export class ResaleTransferBlockedError extends RealEstateDomainError {
  constructor(contractId: string, reason: string) {
    super(409, 'RESALE_TRANSFER_BLOCKED', reason, { contractId });
  }
}

export class ChequeInvalidStateError extends RealEstateDomainError {
  constructor(chequeId: string, currentStatus: string, expected: string[]) {
    super(409, 'CHEQUE_INVALID_STATE', `Cheque status must be one of: ${expected.join(', ')}`, {
      chequeId,
      currentStatus,
      expected,
    });
  }
}

export class UnitContractNotFoundError extends RealEstateDomainError {
  constructor(companyId: string, contractId: string) {
    super(404, 'UNIT_CONTRACT_NOT_FOUND', 'Unit contract not found', { companyId, contractId });
  }
}

export class UnitInstallmentNotFoundError extends RealEstateDomainError {
  constructor(companyId: string, installmentId: string) {
    super(404, 'UNIT_INSTALLMENT_NOT_FOUND', 'Unit installment not found', {
      companyId,
      installmentId,
    });
  }
}

export class PostDatedChequeNotFoundError extends RealEstateDomainError {
  constructor(companyId: string, chequeId: string) {
    super(404, 'PDC_NOT_FOUND', 'Post-dated cheque not found', { companyId, chequeId });
  }
}

export class RentalPoolAgreementNotFoundError extends RealEstateDomainError {
  constructor(companyId: string, agreementId: string) {
    super(404, 'RENTAL_POOL_NOT_FOUND', 'Rental pool agreement not found', {
      companyId,
      agreementId,
    });
  }
}

export class ContractStateError extends RealEstateDomainError {
  constructor(contractId: string, currentStatus: string, expected: string[]) {
    super(409, 'INVALID_CONTRACT_STATE', `Contract status must be one of: ${expected.join(', ')}`, {
      contractId,
      currentStatus,
      expected,
    });
  }
}

export class InstallmentPaymentOverAppliedError extends RealEstateDomainError {
  constructor(installmentId: string, paymentAmount: string, maxApplicable: string) {
    super(422, 'INSTALLMENT_OVERPAYMENT', 'Payment exceeds principal balance plus outstanding late fees', {
      installmentId,
      paymentAmount,
      maxApplicable,
    });
  }
}

export class BuyerCustomerNotFoundError extends RealEstateDomainError {
  constructor(companyId: string, customerId: string) {
    super(404, 'BUYER_CUSTOMER_NOT_FOUND', 'Buyer customer not found for this company', {
      companyId,
      customerId,
    });
  }
}

export class BankAccountNotFoundError extends RealEstateDomainError {
  constructor(companyId: string, bankAccountId: string) {
    super(404, 'BANK_ACCOUNT_NOT_FOUND', 'Bank account not found for this company', {
      companyId,
      bankAccountId,
    });
  }
}

export class RentalPoolInactiveError extends RealEstateDomainError {
  constructor(agreementId: string) {
    super(409, 'RENTAL_POOL_INACTIVE', 'Rental pool agreement is not active', { agreementId });
  }
}
