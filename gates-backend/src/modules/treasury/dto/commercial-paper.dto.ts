export type CommercialPaperKind = 'PAYMENT' | 'RECEIPT';

export interface ExecuteMultiCollectionDto {
  paperId?: string;
  collectionDate: Date | string;
  hijriDate?: string;
  accountId: string;
  amount: number;
  notes?: string;
}
