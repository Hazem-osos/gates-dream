import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { Decimal } from '@prisma/client/runtime/library';
import { realEstateUnitService } from './real-estate-unit.service';

export interface CreateReservationData {
  propertyId: string;
  customerId: string;
  reservationDate: Date;
  reservationAmount?: number;
  notes?: string;
  expiryDate?: Date;
}

export interface UpdateReservationData extends Partial<CreateReservationData> {
  status?: 'pending' | 'confirmed' | 'cancelled' | 'expired';
}

function normalizeStatus(status: string): string {
  return status.toUpperCase();
}

export class ReservationService {
  async createReservation(companyId: string, data: CreateReservationData) {
    const unitId = data.propertyId;
    const unit = await realEstateUnitService.getUnit(companyId, unitId);
    if (unit.status !== 'AVAILABLE') {
      throw new AppError(422, 'Unit is not available for reservation');
    }

    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, companyId },
    });
    if (!customer) throw new AppError(404, 'Customer not found');

    return prisma.$transaction(async (tx) => {
      await tx.realEstateUnit.update({
        where: { id: unitId },
        data: { status: 'RESERVED' },
      });

      return tx.realEstateReservation.create({
        data: {
          companyId,
          unitId,
          customerId: data.customerId,
          reservationDate: data.reservationDate,
          reservationAmount:
            data.reservationAmount != null
              ? new Decimal(data.reservationAmount)
              : undefined,
          notes: data.notes,
          expiryDate: data.expiryDate,
          status: 'PENDING',
        },
        include: {
          unit: {
            include: {
              building: { include: { project: true } },
            },
          },
          customer: { select: { id: true, arabicName: true, code: true } },
        },
      });
    });
  }

  async listReservations(
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
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 200);
    const skip = (page - 1) * limit;

    const where = {
      companyId,
      ...(options.propertyId ? { unitId: options.propertyId } : {}),
      ...(options.customerId ? { customerId: options.customerId } : {}),
      ...(options.status ? { status: normalizeStatus(options.status) } : {}),
      ...(options.fromDate || options.toDate
        ? {
            reservationDate: {
              ...(options.fromDate ? { gte: options.fromDate } : {}),
              ...(options.toDate ? { lte: options.toDate } : {}),
            },
          }
        : {}),
    };

    const [reservations, total] = await Promise.all([
      prisma.realEstateReservation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { reservationDate: 'desc' },
        include: {
          unit: {
            include: {
              building: { include: { project: true } },
            },
          },
          customer: { select: { id: true, arabicName: true, code: true } },
        },
      }),
      prisma.realEstateReservation.count({ where }),
    ]);

    return {
      reservations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async confirmReservation(companyId: string, reservationId: string) {
    const row = await prisma.realEstateReservation.findFirst({
      where: { id: reservationId, companyId },
    });
    if (!row) throw new AppError(404, 'Reservation not found');
    if (row.status === 'CANCELLED') {
      throw new AppError(400, 'Cannot confirm a cancelled reservation');
    }

    return prisma.realEstateReservation.update({
      where: { id: reservationId },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });
  }

  async extendReservation(companyId: string, reservationId: string, extraDays = 7) {
    const row = await prisma.realEstateReservation.findFirst({
      where: { id: reservationId, companyId },
    });
    if (!row) throw new AppError(404, 'Reservation not found');
    if (!['PENDING', 'CONFIRMED'].includes(row.status)) {
      throw new AppError(400, 'Only open reservations can be extended');
    }
    const days = Math.min(90, Math.max(1, extraDays));
    const base = row.expiryDate && row.expiryDate > new Date() ? row.expiryDate : new Date();
    const expiryDate = new Date(base);
    expiryDate.setDate(expiryDate.getDate() + days);
    return prisma.realEstateReservation.update({
      where: { id: reservationId },
      data: { expiryDate },
    });
  }

  async cancelReservation(companyId: string, reservationId: string, reason?: string) {
    const row = await prisma.realEstateReservation.findFirst({
      where: { id: reservationId, companyId },
    });
    if (!row) throw new AppError(404, 'Reservation not found');
    if (row.status === 'CANCELLED') {
      throw new AppError(400, 'Reservation already cancelled');
    }

    return prisma.$transaction(async (tx) => {
      // Wave 3 fix: a sale contract can be signed on a RESERVED unit without
      // closing the reservation (the two flows aren't linked). Unconditionally
      // flipping the unit back to AVAILABLE here would free an already-sold
      // unit for resale. Only release the unit if it's still sitting in the
      // RESERVED state this reservation put it in.
      const unit = await tx.realEstateUnit.findFirst({
        where: { id: row.unitId },
        select: { status: true },
      });
      if (unit?.status === 'RESERVED') {
        await tx.realEstateUnit.update({
          where: { id: row.unitId },
          data: { status: 'AVAILABLE' },
        });
      }

      return tx.realEstateReservation.update({
        where: { id: reservationId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      });
    });
  }
}

export const reservationService = new ReservationService();
