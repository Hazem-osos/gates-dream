import type { InstallmentFrequency, InstallmentType } from './types';
import { toMoney } from './format';

const PERIODS: Record<InstallmentFrequency, number> = {
  MONTHLY: 12,
  QUARTERLY: 4,
  SEMI_ANNUAL: 2,
  ANNUAL: 1,
};

export type BalloonDraft = { dueDate: string; amount: string; ratePercent: string };

export type SchedulePreviewInput = {
  sellingPrice: number;
  maintenanceDeposit: number;
  reservationPercent: number;
  contractingPercent: number;
  deliveryPercent: number;
  frequency: InstallmentFrequency;
  durationYears: number;
  deliveryDueDate: string;
  maintenanceDueDate: string;
  balloons: BalloonDraft[];
};

export type PreviewLine = {
  installmentType: InstallmentType;
  amount: number;
  dueDate: string;
};

export function installmentCountFromYears(frequency: InstallmentFrequency, years: number): number {
  return Math.max(0, Math.round(toMoney(years) * PERIODS[frequency]));
}

export function previewSchedule(input: SchedulePreviewInput): {
  lines: PreviewLine[];
  total: number;
  target: number;
  balanced: boolean;
  error?: string;
} {
  const selling = toMoney(input.sellingPrice);
  const maintenance = toMoney(input.maintenanceDeposit);
  const reservation = selling * (toMoney(input.reservationPercent) / 100);
  const contracting = selling * (toMoney(input.contractingPercent) / 100);
  const delivery = selling * (toMoney(input.deliveryPercent) / 100);
  const balloons = input.balloons
    .map((row) => {
      const amount = row.amount ? toMoney(row.amount) : selling * (toMoney(row.ratePercent) / 100);
      return { amount, dueDate: row.dueDate };
    })
    .filter((row) => row.amount > 0);

  const allocated = reservation + contracting + delivery + balloons.reduce((sum, row) => sum + row.amount, 0);
  const remainder = selling - allocated;
  const count = installmentCountFromYears(input.frequency, input.durationYears);
  const lines: PreviewLine[] = [];

  if (reservation > 0) lines.push({ installmentType: 'RESERVATION_DEPOSIT', amount: reservation, dueDate: '' });
  if (contracting > 0) lines.push({ installmentType: 'CONTRACTING_DOWNPAYMENT', amount: contracting, dueDate: '' });
  if (delivery > 0) {
    lines.push({ installmentType: 'DELIVERY_PAYMENT', amount: delivery, dueDate: input.deliveryDueDate });
  }
  for (const balloon of balloons) {
    lines.push({ installmentType: 'ANNUAL_BALLOON', amount: balloon.amount, dueDate: balloon.dueDate });
  }

  if (remainder < -0.01) {
    return {
      lines,
      total: allocated + maintenance,
      target: selling + maintenance,
      balanced: false,
      error: 'مجموع النسب والمبالغ يتجاوز سعر البيع',
    };
  }

  if (remainder > 0.01 && count < 1) {
    return {
      lines,
      total: allocated + maintenance,
      target: selling + maintenance,
      balanced: false,
      error: 'المتبقي من سعر البيع يحتاج أقساطًا دورية أو دفعة تسليم',
    };
  }

  if (remainder > 0 && count > 0) {
    const base = remainder / count;
    for (let i = 0; i < count; i += 1) {
      const amount = i === count - 1 ? remainder - base * (count - 1) : base;
      lines.push({ installmentType: 'REGULAR_INSTALLMENT', amount, dueDate: '' });
    }
  }

  if (maintenance > 0) {
    lines.push({ installmentType: 'MAINTENANCE_DEPOSIT', amount: maintenance, dueDate: input.maintenanceDueDate });
  }

  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const target = selling + maintenance;
  return {
    lines,
    total,
    target,
    balanced: Math.abs(total - target) < 0.02,
  };
}
