export type CommercialPaperKind = 'PAYMENT' | 'RECEIPT';

export interface MultiCollectionLineDto {
  accountId: string;
  amount: number;
  description?: string;
}

export interface ExecuteMultiCollectionDto {
  paperId?: string;
  collectionDate: Date | string;
  hijriDate?: string;
  commissionAmount?: number;
  commissionAccountId?: string | null;
  destinationAccountId: string;
  lines: MultiCollectionLineDto[];
  notes?: string;
}
