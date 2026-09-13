import { AppError } from '../../../../shared/middleware/error-handler';

export class CostControlDomainError extends AppError {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(statusCode, message, true);
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ContractingProjectNotFoundError extends CostControlDomainError {
  constructor(companyId: string, projectId: string) {
    super(404, 'CONTRACTING_PROJECT_NOT_FOUND', 'Contracting project not found', {
      companyId,
      projectId,
    });
  }
}
