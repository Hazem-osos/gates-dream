import { AppError } from '../../../shared/middleware/error-handler';

export class VariationDomainError extends AppError {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(statusCode, message, true);
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface ContractVariationOverCertificationDetail {
  projectBOQItemId: string;
  itemCode: string;
  previousCertifiedQuantity: string;
  effectiveQuantityAfter: string;
}

export class ContractVariationOverCertificationError extends VariationDomainError {
  constructor(breaches: ContractVariationOverCertificationDetail[]) {
    super(
      422,
      'CONTRACT_VARIATION_OVER_CERTIFICATION',
      'Approved variation would leave cumulative certified quantity above effective contract quantity',
      { breaches }
    );
  }
}

export interface SubcontractVariationOverCertificationDetail {
  subcontractBOQItemId: string;
  itemCode: string;
  previousCertifiedQuantity: string;
  effectiveQuantityAfter: string;
}

export class SubcontractVariationOverCertificationError extends VariationDomainError {
  constructor(breaches: SubcontractVariationOverCertificationDetail[]) {
    super(
      422,
      'SUBCONTRACT_VARIATION_OVER_CERTIFICATION',
      'Approved variation would leave cumulative certified quantity above effective subcontract quantity',
      { breaches }
    );
  }
}

export class ContractVariationOrderNotFoundError extends VariationDomainError {
  constructor(companyId: string, variationOrderId: string) {
    super(404, 'CONTRACT_VARIATION_ORDER_NOT_FOUND', 'Contract variation order not found', {
      companyId,
      variationOrderId,
    });
  }
}

export class SubcontractVariationOrderNotFoundError extends VariationDomainError {
  constructor(companyId: string, variationOrderId: string) {
    super(404, 'SUBCONTRACT_VARIATION_ORDER_NOT_FOUND', 'Subcontract variation order not found', {
      companyId,
      variationOrderId,
    });
  }
}

export class OwnerBoqItemNotCertifiableError extends VariationDomainError {
  constructor(projectBOQItemId: string, itemCode: string) {
    super(
      422,
      'OWNER_BOQ_ITEM_NOT_CERTIFIABLE',
      'BOQ item is not certifiable until its variation order is approved',
      { projectBOQItemId, itemCode }
    );
  }
}
