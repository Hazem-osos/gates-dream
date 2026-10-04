export interface BatchReceiptPaperItemDto {
  paperNumber: string;
  amount: number;
  dueDate: Date | string;
  hijriDueDate?: string;
  bankName?: string;
  branchName?: string;
  description?: string;
  /** حساب القيد لهذه الورقة في شاشة الأوراق المالية السابقة. */
  accountId?: string;
}

export interface CreateBatchReceiptPapersDto {
  issueDate: Date | string;
  hijriIssueDate?: string;
  partyId: string;
  entityName?: string;
  entityId?: string;
  partyName?: string;
  currencyCode?: string;
  partyType?: 'customer' | 'supplier' | 'account';
  /** أوراق مالية سابقة: تُحفظ مرحّلة بدون قيد تحرير، وقيمتها تتحمّل في الرصيد الافتتاحي. */
  opening?: boolean;
  papers: BatchReceiptPaperItemDto[];
}
