export interface BatchReceiptPaperItemDto {
  paperNumber: string;
  amount: number;
  dueDate: Date | string;
  hijriDueDate?: string;
  bankName?: string;
  branchName?: string;
  description?: string;
}

export interface CreateBatchReceiptPapersDto {
  issueDate: Date | string;
  hijriIssueDate?: string;
  partyId: string;
  entityName?: string;
  entityId?: string;
  partyName?: string;
  currencyCode?: string;
  partyType?: 'customer' | 'supplier';
  papers: BatchReceiptPaperItemDto[];
}
