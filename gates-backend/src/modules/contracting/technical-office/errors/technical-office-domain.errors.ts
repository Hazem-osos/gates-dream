import { AppError } from '../../../../shared/middleware/error-handler';

export class TechnicalOfficeDomainError extends AppError {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(statusCode, message, true);
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MeasurementSheetInvalidError extends TechnicalOfficeDomainError {
  constructor(message: string, details?: unknown) {
    super(422, 'MEASUREMENT_SHEET_INVALID', message, details);
  }
}

export class ProjectBOQItemNotFoundError extends TechnicalOfficeDomainError {
  constructor(companyId: string, boqItemId: string) {
    super(404, 'PROJECT_BOQ_ITEM_NOT_FOUND', 'Owner BOQ item not found', {
      companyId,
      boqItemId,
    });
  }
}

export class RateAnalysisEmptyError extends TechnicalOfficeDomainError {
  constructor(boqItemId: string) {
    super(422, 'RATE_ANALYSIS_EMPTY', 'BOQ item has no cost-element breakdown', { boqItemId });
  }
}

export class ContractingProjectNotFoundError extends TechnicalOfficeDomainError {
  constructor(companyId: string, projectId: string) {
    super(404, 'CONTRACTING_PROJECT_NOT_FOUND', 'Contracting project not found', {
      companyId,
      projectId,
    });
  }
}

export class MeasurementSheetNotFoundError extends TechnicalOfficeDomainError {
  constructor(companyId: string, sheetId: string) {
    super(404, 'MEASUREMENT_SHEET_NOT_FOUND', 'Measurement sheet not found', {
      companyId,
      sheetId,
    });
  }
}

export class MeasurementSheetStateError extends TechnicalOfficeDomainError {
  constructor(sheetId: string, currentStatus: string, expected: string[]) {
    super(409, 'INVALID_MEASUREMENT_SHEET_STATE', `Measurement sheet status must be one of: ${expected.join(', ')}`, {
      sheetId,
      currentStatus,
      expected,
    });
  }
}
