import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';

export interface CreateClosureData {
  propertyId: string;
  customerId: string;
  closureDate: Date;
  salePrice: number;
  paymentMethod?: string;
  notes?: string;
}

export interface UpdateClosureData extends Partial<CreateClosureData> {
  status?: 'pending' | 'completed' | 'cancelled';
}

export class ClosureService {
  private notImplemented(): never {
    throw new AppError(
      501,
      'Real-estate unit closure is not persisted yet (Closure model pending). Use reservations workflow instead.'
    );
  }

  async createClosure(companyId: string, data: CreateClosureData) {
    logger.warn({ companyId, data }, 'Closure create rejected — not implemented');
    this.notImplemented();
  }

  async listClosures(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      propertyId?: string;
      customerId?: string;
      status?: string;
      fromDate?: Date;
      toDate?: Date;
    } = {}
  ) {
    logger.info({ companyId, options }, 'Listing closures (empty — not implemented)');
    return {
      closures: [],
      pagination: {
        page: options.page || 1,
        limit: options.limit || 50,
        total: 0,
        totalPages: 0,
      },
    };
  }

  async completeClosure(companyId: string, closureId: string) {
    logger.warn({ companyId, closureId }, 'Closure complete rejected — not implemented');
    this.notImplemented();
  }
}

export const closureService = new ClosureService();
