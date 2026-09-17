# Deep Legacy Mining Report

Generated 2026-09-06T13:45:54.693Z.

Forensic extract of Delphi line grids, pre-save guards, and post-save side effects,
cross-referenced against Prisma line models, gates-web Zod line schemas, and `invoiceLineColumns.ts`.

## Summary

| Metric | Count |
|---|---:|
| PAS units scanned | 586 |
| LangMessages codes in file | 2422 |
| Distinct ShowLangMessage codes | 2189 |
| ShowLangMessage codes resolving to Arabic | 2184 |
| Save_Trace call sites | 677 |
| InvoiceTrxDetail columns (Insert Into union) | 66 |
| Detail tables discovered | 55 |
| Sales & Purchasing Invoicing screens | 34 |
| Treasury & Cheques screens | 26 |
| Contracting & Subcontractors screens | 9 |
| Manufacturing & Assembly screens | 6 |
| Inventory & Stock Movements screens | 12 |

## Requested-identifier verdicts

| Identifier | Verdict | Real equivalent | Note |
|---|---|---|---|
| `Length` | absent | — | No Length/Width/Thickness/Height columns on any detail table or grid. |
| `Width` | absent | — | No dimensional columns in InvoiceTrxDetail / StoreTransDetail / ManufactProcessD*. |
| `Thickness` | absent | — | Absent. |
| `Height` | absent | — | Absent. |
| `FreeQty` | absent | — | No FreeQty/BonusQty. Web grid has optional freeBonus UI only. |
| `BonusQty` | absent | — | Absent. |
| `PatchNo` | absent | — | No PatchNo/BatchNo in legacy detail tables. |
| `BatchNo` | absent | `InvoiceLine.batchNumber (web-only addition)` | Legacy has no batch column. Web/Prisma added batchNumber later. |
| `AltUnit` | equivalent | `UnitCode2 + Qty2 + ChangeConst` | Second unit pair, not a named AltUnit/MinorUnit/UnitFactor field. |
| `MinorUnit` | equivalent | `UnitCode2 / Qty2` | Same as AltUnit. |
| `UnitFactor` | equivalent | `ChangeConst` | Conversion flag/factor lives on ChangeConst. |
| `TableTax` | absent | — | No TableTax/Damga/Stamp columns. |
| `Damga` | absent | — | Absent. |
| `Stamp` | absent | — | Absent. |
| `DaribaItemDetail` | absent | `DaribaMabiat / DaribaSadad / DaribaAlarms` | Table does not exist. |
| `DaribaTransactions` | absent | `DaribaMabiat / DaribaMabiatPaid / DaribaSadad` | Table does not exist. |
| `EsharDetail` | absent | `Eshar / SalesDaribaEshar` | Table does not exist. |
| `IsPosted` | absent | `Status='Post'|'UnPost'` | Status is a string, not a boolean. |
| `IsAudited` | absent | — | No IsAudited flag. |
| `IsPrinted` | absent | — | No IsPrinted flag. Print is a Save_Trace Action. |
| `Save_Trace.IP` | absent | — | Trace insert is Usercode, ScreenName, Action, Date, RecordCode, ActionDate, Name, CompanyCode, BranchCode. |
| `Save_Trace.oldValue` | absent | — | No old/new value captured. |
| `Person.Balance cache` | absent | `dynamic Mozana / open-item sum` | No Update Person Set Balance. Balances recomputed. |

## Verbatim detail-table column lists

### InvoiceTrxDetail (66 columns)

```
CompanyCode, BranchCode, YearID, InvoiceNum, Type, ItemCode, UnitCode1, Qty1, UnitCode2, Qty2, Price, TotalValue, DiscPercent, DiscValue, DaribaPercent, DaribaValue, Value1, Value2, Value3, Value4, Value5, Value6, NetValue, ExpDate, ExpDateH, StoreCode, ChangeConst, Value1Type, Value2Type, Value3Type, Value4Type, Value5Type, Value6Type, ItemType, GridNum, Serial, PriceAgain, DaribaCustomPercent1, DaribaCustomPercent2, DaribaCustomPercent3, DaribaCustomPercent4, DaribaCustomPercent5, DaribaCustomPercent6, DaribaCustomEquation1, DaribaCustomEquation2, DaribaCustomEquation3, DaribaCustomEquation4, DaribaCustomEquation5, DaribaCustomEquation6, QtyUsed1, QtyUsed2, QtyReturned1, QtyReturned2, CCenter, WorkPrice1, WorkPrice2, CostPrice, SerialNums, Special, Itemcat, SpecialData, ItemDesc, ItemColorSizeCode, userCode, ItemLossQty, ItemWeight
```

### StoreTransDetail (17 columns)

```
CompanyCode, BranchCode, YearID, StoreTransCode, Type, ItemCode, Qty, TransQty, UnitCode, Price, TotalPrice, Change, TransMainQty, Itemcat, SpecialData, ItemColorSizeCode, RowNum
```

### StoreCollDetail (12 columns)

```
CompanyCode, BranchCode, YearID, StoreCollCode, Type, ItemCode, Qty, TransQty, UnitCode, Price, TotalPrice, SerialNums
```

### ManufactProcessD1 (18 columns)

```
CompanyCode, BranchCode, ManufactProcessCode, ItemCode, Qty, UnitCode, Price, TotalPrice, CostPercent, OrgQty, OrgPrice, OrgTotalPrice, OrgItemCode, YearId, Type, MainQty, MainUnitCode, MainChange
```

### ManufactProcessD2 (14 columns)

```
CompanyCode, BranchCode, ManufactProcessCode, ItemCode, Qty, UnitCode, Price, TotalPrice, OrgQty, OrgPrice, OrgTotalPrice, OrgItemCode, YearId, Type
```

### ManufactProcessD3 (12 columns)

```
CompanyCode, BranchCode, ManufactProcessCode, AccountCode, Value, ValuePercent, Explain, CCenterCode, OrgValue, OrgAccountCode, YearId, Type
```

### ManufactProcessD4 (6 columns)

```
CompanyCode, BranchCode, ManufactProcessCode, ItemCode, SupplierAccountCode, Wanted
```

### ContractorsStatementsD1 (23 columns)

```
CompanyCode, BranchCode, ContractorStatementCode, ProjectCode, UnitNum, SampleNum, GroupNum, ItemCode, ItemDetailCode, ItemDetailUnit, AssignedQty, PrevQty, CurrentQty, TotalQty, Price, PricePercent, DonePercent, TotalValue, PrevQtyPercent, CurrentQtyPercent, TotalQtyPercent, ItemDetailType, PrevPricePercent
```

### ContractorsStatementsD2 (17 columns)

```
CompanyCode, BranchCode, ContractorStatementCode, ProjectCode, UnitNum, SampleNum, GroupNum, AdditionalDesc, ItemDetailUnit, AssignedQty, PrevQty, CurrentQty, TotalQty, Price, TotalValue, ContractorCode, IsTaken
```

### ContractorsStatementsD3 (10 columns)

```
CompanyCode, BranchCode, ContractorStatementCode, SerialNum, DiscountType, DiscountDesc, DiscountValue, OrgSourceCode, IsTaken, RefContractorStatementCode
```

### AbsGeneralItemDetails (4 columns)

```
GeneralItemDetailCode, GeneralItemDetailNameA, GeneralItemDetailNameE, GeneralItemCode
```

### AbsGeneralItemDetailsValues (8 columns)

```
CompanyCode, BranchCode, ProjectCode, GeneralItemCode, GeneralItemDetailCode, DetailsQtyValues, DetailsMoneyValues, DetailsUnit
```

### AbsProjectD1 (7 columns)

```
CompanyCode, BranchCode, ProjectCode, GroupNum, SampleNum, UnitNum, SourceNum
```

### AbsProjectD2 (11 columns)

```
CompanyCode, BranchCode, ProjectCode, UnitNum, ItemCode, ItemNameA, ItemNameE, TotalQty, TotalValue, TotalBudget, GeneralItemCode
```

### AbsProjectD3 (17 columns)

```
CompanyCode, BranchCode, ProjectCode, UnitNum, ItemCode, ItemDetailCode, ItemDetailNameA, ItemDetailNameE, ItemDetailUnit, ItemDetailQty, ItemDetailPrice, ItemDetailTotal, ItemDetailBudgetQty, ItemDetailBudgetValue, ItemDetailType, GeneralItemCode, GeneralItemDetailCode
```

### AbsProjectD4 (14 columns)

```
CompanyCode, BranchCode, ProjectCode, ContractorCode, AssignDate, AssignDateH, TotalAssignedValue, DownPaymentPercent, DownPaymentValue, InsurancePercent, InsuranceFinalPercent, TaxesPercent, SalesTaxesPercent, IsApproved
```

### AbsProjectD5 (17 columns)

```
CompanyCode, BranchCode, ProjectCode, ContractorCode, GroupNum, SampleNum, UnitNum, ItemCode, ItemDetailCode, ItemDetailQty, ItemDetailUnit, ItemDetailPrice, ItemDetailOther1, ItemDetailOther2, ItemDetailOther3, ItemDetailTotal, ItemDetailType
```

### BLUnitForSalesD1 (5 columns)

```
CompanyCode, UnitCode, Floor, UnitCount, Serial
```

### BLUnitForSalesD2 (17 columns)

```
CompanyCode, UnitCode, UnitNum, Floor, Area, RoomCount, BathCount, UnitView, Price, Total, Other1, Other2, Other3, Serial, ReadyForSales, Sold, ItemCode
```

### CKTrxDetail (35 columns)

```
CompanyCode, BranchCode, YearID, CKNum, DetailDescA, DetailDescE, Type, AccountNo, FromAccountNo, FromCCenterCode, CurrencyCode, Change, Amount, Name, GehaCode, EditDate, EditDateH, TakeDate, TakeDateH, EditGLNum, TakeGLNum, TazherGLNum, ReturnGLNum, IsTake, IsTazher, IsReturn, Status, Deleted, IsBank, BankAccountNo, BankDate, BankDateH, BankGLNum, BankYearID, IdNum
```

### CKTrxDetailSub (20 columns)

```
CompanyCode, BranchCode, CKNum, YearId, Type, TakeDescA, TakeDescE, TakeAmountDate, TakeAmountDateH, TakeAccountNo, TakeAmount, TakeComm, TakeCommAccountNo, TakeCommCreditAccountNo, TakeFromOriginal, TakeCCenterCode, TakeCommCCenterCode, TakeCommCreditCCenterCode, TakeGLNum, TakeYearId
```

### CashTrxDetail (20 columns)

```
CompanyCode, BranchCode, YearID, CashNum, DetailDescA, DetailDescE, Type, DetailNum, AccountNo, CCenterCode, Amount, CurrencyCode, Change, DaribaPercentCode, DaribaPercentValue, EsharCode, Accepted, InvoiceType, InvoiceYearId, InvoiceNum
```

### CashTrxOtherDetail (14 columns)

```
CompanyCode, BranchCode, YearID, CashNum, DetailDescA, DetailDescE, Type, DetailNum, AccountNo, CCenterCode, Amount, CurrencyCode, Change, Accepted
```

### Field1 (5 columns)

```
CompanyCode, BranchCode, Field1Code, Field1NameA, Field1NameE
```

### Field2 (5 columns)

```
CompanyCode, BranchCode, Field2Code, Field2NameA, Field2NameE
```

### Field3 (5 columns)

```
CompanyCode, BranchCode, Field3Code, Field3NameA, Field3NameE
```

### Field4 (5 columns)

```
CompanyCode, BranchCode, Field4Code, Field4NameA, Field4NameE
```

### Field5 (5 columns)

```
CompanyCode, BranchCode, Field5Code, Field5NameA, Field5NameE
```

### GLTrxDetail (20 columns)

```
CompanyCode, BranchCode, YearID, GlNum, DetailDescA, DetailDescE, Type, DetailNum, AccountNo, CCenterCode, DebitValue, CreditValue, CurrencyCode, Change, DaribaPercentCode, DaribaPercentValue, EsharCode, Accepted, Audit, MabiatAmount
```

### HREmployeeContractD1 (8 columns)

```
CompanyCode, BranchCode, EmployeeContractCode, AdditionCode, AdditionType, AdditionValue, AdditionValueType, AdditionMoneyValue
```

### HREmployeeContractD2 (8 columns)

```
CompanyCode, BranchCode, EmployeeContractCode, DeductionCode, DeductionType, DeductionValue, DeductionValueType, DeductionMoneyValue
```

### HREmployeeContractD3 (10 columns)

```
CompanyCode, BranchCode, EmployeeContractCode, AdditionCode, IsChoosed1, IsChoosed2, IsChoosed3, IsChoosed4, IsChoosed5, IsChoosed6
```

### HREmployeeD1 (6 columns)

```
CompanyCode, EmployeeCode, QualificationName, QualificationDate, QualificationFaculty, QualificationRemarks
```

### HREmployeeD2 (7 columns)

```
CompanyCode, EmployeeCode, TrainingName, TrainingDate, TrainingPeriod, TrainingFaculty, TrainingRemarks
```

### HREmployeeD3 (8 columns)

```
CompanyCode, EmployeeCode, ExpCompanyName, ExpFromDate, ExpToDate, ExpPlace, ExpJob, ExpRemarks
```

### HREmployeeD4 (8 columns)

```
CompanyCode, EmployeeCode, DocumentCode, DocFromDate, DocToDate, DocPlace, DocAlarmDays, DocRemarks
```

### HREmployeeD5 (7 columns)

```
CompanyCode, EmployeeCode, PersonName, PersonRelation, PersonGenderCode, PersonBirthDate, PersonRemarks
```

### HREmployeeMonthSalaryD1 (9 columns)

```
CompanyCode, SalaryYear, SalaryMonth, EmployeeCode, AdditionCode, AdditionValue, BranchCode, MonthSalaryCode, AdditionMoneyValue
```

### HREmployeeMonthSalaryD2 (9 columns)

```
CompanyCode, SalaryYear, SalaryMonth, EmployeeCode, DeductionCode, DeductionValue, BranchCode, MonthSalaryCode, DeductionMoneyValue
```

### HRSalaryPolicyD1 (7 columns)

```
CompanyCode, BranchCode, SalaryPolicyCode, AdditionCode, AdditionType, AdditionValue, AdditionValueType
```

### HRSalaryPolicyD2 (7 columns)

```
CompanyCode, BranchCode, SalaryPolicyCode, DeductionCode, DeductionType, DeductionValue, DeductionValueType
```

### HRSalaryPolicyD3 (10 columns)

```
CompanyCode, BranchCode, SalaryPolicyCode, AdditionCode, IsChoosed1, IsChoosed2, IsChoosed3, IsChoosed4, IsChoosed5, IsChoosed6
```

### IATrxDetail (15 columns)

```
CompanyCode, BranchCode, YearID, IANum, Type, ItemCode, UnitCode1, Qty1, UnitCode2, Qty2, StoreCode, Qty1Used, Qty2Used, ChangeConst, Serial
```

### ItemDetail (34 columns)

```
CompanyCode, ItemCode, DescA, FactoryCode, ColorCode, OriginalCode, TypeCode, SizeCode, Itemtype, ItemKind, UseExpDate, NoDisc, NoReturn, NoUnderCast, WantedPay, PicPath, Stopped, MaxValue, MinValue, WantedValue, MinOrder, OrderWay, PriceType, CurrencyCode, Change, AddCost, WantedPercent, UseSerial, Field1Code, Field2Code, Field3Code, Field4Code, Field5Code, IsColorSizeCombination
```

### ManufactWayD1 (9 columns)

```
CompanyCode, BranchCode, ManufactWayCode, ItemCode, Qty, UnitCode, Price, TotalPrice, CostPercent
```

### ManufactWayD2 (8 columns)

```
CompanyCode, BranchCode, ManufactWayCode, ItemCode, Qty, UnitCode, Price, TotalPrice
```

### ManufactWayD3 (8 columns)

```
CompanyCode, BranchCode, ManufactWayCode, AccountCode, Value, ValuePercent, Explain, CCenterCode
```

### OwnerStatementsD1 (23 columns)

```
CompanyCode, BranchCode, OwnerStatementCode, ProjectCode, UnitNum, SampleNum, GroupNum, ItemCode, ItemDetailCode, ItemDetailUnit, ContractorQty, PrevQty, CurrentQty, TotalQty, Price, PricePercent, TotalValue, CurrentValue, ItemDetailType, StatementType, AdditionalField, OrgCurrentQty, PrevPricePercent
```

### OwnerStatementsD2 (15 columns)

```
CompanyCode, BranchCode, OwnerStatementCode, ProjectCode, UnitNum, SampleNum, GroupNum, AdditionalDesc, ItemDetailUnit, ContractQty, PrevQty, CurrentQty, TotalQty, Price, TotalValue
```

### PKTrxDetail (30 columns)

```
CompanyCode, BranchCode, YearID, PKNum, DetailDescA, DetailDescE, Type, AccountNo, FromAccountNo, FromCCenterCode, CurrencyCode, Change, Amount, Name, GehaCode, EditDate, EditDateH, TakeDate, TakeDateH, EditGLNum, TakeGLNum, TazherGLNum, ReturnGLNum, IsTake, IsTazher, IsReturn, Status, Deleted, IdNum, CKNum
```

### PKTrxDetailSub (20 columns)

```
CompanyCode, BranchCode, PKNum, YearId, Type, TakeDescA, TakeDescE, TakeAmountDate, TakeAmountDateH, TakeAccountNo, TakeAmount, TakeComm, TakeCommAccountNo, TakeCommCreditAccountNo, TakeFromOriginal, TakeCCenterCode, TakeCommCCenterCode, TakeCommCreditCCenterCode, TakeGLNum, TakeYearId
```

### ProjectD1 (7 columns)

```
CompanyCode, BranchCode, YearID, ProjectCode, PartenerAccountCode, PayPercent, PayValue
```

### ProjectD2 (10 columns)

```
CompanyCode, BranchCode, YearID, ProjectCode, DepartmentNum, DepartmentArea, FloorNum, Description, UnitStatus, UnitCost
```

### StoreAdjustDetail (16 columns)

```
CompanyCode, BranchCode, YearID, StoreCheckCode, ItemCode, Qty, Remarks, ActualQty, ExpDate, ExpDateH, UnitCode, ItemAddQty, ItemRemoveQty, Price, ItemAddTotalPrice, ItemRemoveTotalPrice
```

### StoreCheckDetail (18 columns)

```
CompanyCode, BranchCode, YearID, StoreCheckCode, ItemCode, Qty, Remarks, ActualQty, ExpDate, ExpDateH, UnitCode, ItemAddQty, ItemRemoveQty, Price, ItemAddTotalPrice, ItemRemoveTotalPrice, SerialNums, ItemColorSizeCode
```

## Sales & Purchasing Invoicing

| Screen | Legacy Business Rule / Line Field | Web/Backend Status | Action Required |
|---|---|---|---|
| حسابات قائمة المركز المالي `FrmBalanceAccounts` | Save guard hardBlock ShowLangMessage(48): كل حساب يجب أن يقابله حساب مخصص | mapped | Port as a blocking validation |
| حسابات قائمة المركز المالي `FrmBalanceAccounts` | Save guard hardBlock ShowLangMessage(49): كل حساب يجب أن يقابله حساب مخصص | mapped | Port as a blocking validation |
| حسابات قائمة المركز المالي `FrmBalanceAccounts` | Save guard warningOnly ShowLangMessage(50): تمت عملية الحفظ بنجاح | mapped | Port as a warning (legacy does not Exit) |
| حسابات قائمة المركز المالي `FrmBalanceAccounts` | Save guard warningOnly ShowLangMessage(51): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `CompanyCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `BranchCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `YearID` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `CashNum` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `DetailDescA` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `DetailDescE` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `Type` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `DetailNum` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `AccountNo` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `CCenterCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `Amount` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `CurrencyCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `Change` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into CashTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into CashTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `EsharCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `Accepted` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `InvoiceType` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `InvoiceYearId` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `InvoiceNum` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Line field `Audit` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر توريد نقدية `FrmCustomerOrder` | Save guard hardBlock ShowLangMessage(1998) [CCType, Mozana]: النسخة غير مرخصة لا يمكنك حفظ أكثر من سجل | mapped | Port as a blocking validation |
| أمر توريد نقدية `FrmCustomerOrder` | Save guard hardBlock ShowLangMessage(225): يجب تحديد الصندوق | mapped | Port as a blocking validation |
| أمر توريد نقدية `FrmCustomerOrder` | Save guard hardBlock ShowLangMessage(226): يجب تحديد تاريخ السند | mapped | Port as a blocking validation |
| أمر توريد نقدية `FrmCustomerOrder` | Save guard hardBlock ShowLangMessage(227) [GetPeriod]: التاريخ المحدد لا يقع في نفس الفترة المحاسبية | mapped | Port as a blocking validation |
| أمر توريد نقدية `FrmCustomerOrder` | Save guard hardBlock ShowLangMessage(228) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| أمر توريد نقدية `FrmCustomerOrder` | Save guard hardBlock ShowLangMessage(229): التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| أمر توريد نقدية `FrmCustomerOrder` | Save guard hardBlock ShowLangMessage(230): يجب إدخال الرمز | mapped | Port as a blocking validation |
| أمر توريد نقدية `FrmCustomerOrder` | Save guard hardBlock ShowLangMessage(231): هذا الرمز موجود سابقا | mapped | Port as a blocking validation |
| أمر توريد نقدية `FrmCustomerOrder` | Save guard hardBlock ShowLangMessage(1999): الحساب يجب تحديد اسم له | mapped | Port as a blocking validation |
| أمر توريد نقدية `FrmCustomerOrder` | Save guard hardBlock ShowLangMessage(2000): الحساب يجب تحديد قيمة له | mapped | Port as a blocking validation |
| أمر توريد نقدية `FrmCustomerOrder` | Save guard hardBlock ShowLangMessage(2001): الحساب يجب أن تكون قيمته أكبر من الصفر | mapped | Port as a blocking validation |
| أمر توريد نقدية `FrmCustomerOrder` | Save guard hardBlock ShowLangMessage(2002): الحساب يجب تحديد عملة له | mapped | Port as a blocking validation |
| أمر توريد نقدية `FrmCustomerOrder` | Save_Trace actions: Browse@Other, Add@Save, Edit@Save, Delete@Delete, Print@Print | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| `FrmDistCashReturn` | Save guard hardBlock ShowLangMessage(387): من فضلك حدد المبلغ | unmapped | Port as a blocking validation |
| `FrmDistCashReturn` | Save guard hardBlock ShowLangMessage(388): من فضلك حدد تاريخ بداية أول دفعة | unmapped | Port as a blocking validation |
| `FrmDistCashReturn` | Save guard hardBlock ShowLangMessage(389): تاريخ البدء لا يمكن ان يكون أصغر من تاريخ الفاتورة | unmapped | Port as a blocking validation |
| اعدادات الفاتورة الالكترونية `FrmEInvoiceSettings` | Save guard warningOnly ShowLangMessage(1030): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `CompanyCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `ItemCode` (ops / item) via Insert Into ItemDetail | covered | Keep — already on Prisma / Zod / grid. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `DescA` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `FactoryCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `ColorCode` (traceability / traceOther) via Insert Into ItemDetail | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `OriginalCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `TypeCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `SizeCode` (traceability / traceOther) via Insert Into ItemDetail | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `Itemtype` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `ItemKind` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `UseExpDate` (traceability / traceOther) via Insert Into ItemDetail | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `NoDisc` (discount / discountOther) via Insert Into ItemDetail | missing | Decide whether discountOther is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `NoReturn` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `NoUnderCast` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `WantedPay` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `PicPath` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `Stopped` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `MaxValue` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `MinValue` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `WantedValue` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `MinOrder` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `OrderWay` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `PriceType` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| استيراد فواتير ضريبية `FrmImportTaxInvoices` | Line field `CurrencyCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| حد الطلب للأصناف `FrmItemsOrder` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| حد الطلب للأصناف `FrmItemsOrder` | Save_Trace actions: Add@Save, Edit@Save, Delete@Delete | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| تقرير يومية المبيعات `FrmPOSRep` | Save_Trace actions: Print@Other, Print@Print | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `CompanyCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `BranchCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `YearID` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `CashNum` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `DetailDescA` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `DetailDescE` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `Type` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `DetailNum` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `AccountNo` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `CCenterCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `Amount` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `CurrencyCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `Change` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into CashTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into CashTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `EsharCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `Accepted` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Line field `Audit` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أمر صرف نقدية `FrmPaymentOrder` | Save guard hardBlock ShowLangMessage(2076) [CCType, Mozana]: النسخة غير مرخصة لا يمكنك حفظ أكثر من سجل | mapped | Port as a blocking validation |
| أمر صرف نقدية `FrmPaymentOrder` | Save guard hardBlock ShowLangMessage(803): يجب تحديد الصندوق | mapped | Port as a blocking validation |
| أمر صرف نقدية `FrmPaymentOrder` | Save guard hardBlock ShowLangMessage(804): يجب تحديد تاريخ السند | mapped | Port as a blocking validation |
| أمر صرف نقدية `FrmPaymentOrder` | Save guard hardBlock ShowLangMessage(805) [GetPeriod]: التاريخ المحدد لا يقع في نفس الفترة المحاسبية | mapped | Port as a blocking validation |
| أمر صرف نقدية `FrmPaymentOrder` | Save guard hardBlock ShowLangMessage(806) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| أمر صرف نقدية `FrmPaymentOrder` | Save guard hardBlock ShowLangMessage(807): التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| أمر صرف نقدية `FrmPaymentOrder` | Save guard hardBlock ShowLangMessage(808): يجب إدخال الرمز | mapped | Port as a blocking validation |
| أمر صرف نقدية `FrmPaymentOrder` | Save guard hardBlock ShowLangMessage(809): هذا الرمز موجود سابقا | mapped | Port as a blocking validation |
| أمر صرف نقدية `FrmPaymentOrder` | Save guard hardBlock ShowLangMessage(2077): الحساب يجب تحديد اسم له | mapped | Port as a blocking validation |
| أمر صرف نقدية `FrmPaymentOrder` | Save guard hardBlock ShowLangMessage(2078): الحساب يجب تحديد قيمة له | mapped | Port as a blocking validation |
| أمر صرف نقدية `FrmPaymentOrder` | Save guard hardBlock ShowLangMessage(2079): الحساب يجب أن تكون قيمته أكبر من الصفر | mapped | Port as a blocking validation |
| أمر صرف نقدية `FrmPaymentOrder` | Save guard hardBlock ShowLangMessage(2080): الحساب يجب تحديد عملة له | mapped | Port as a blocking validation |
| أمر صرف نقدية `FrmPaymentOrder` | Save_Trace actions: Browse@Other, Add@Save, Edit@Save, Delete@Delete, Print@Print | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| مديري نقطة البيع `FrmPOSPassward` | Save guard hardBlock ShowLangMessage(974): حدد مدير نقطة البيع | unmapped | Port as a blocking validation |
| مردودات بدون فاتورة اصل `FrmRInvoiceRepair` | Save guard hardBlock ShowLangMessage(1191): حدد رقم الفاتورة | unmapped | Port as a blocking validation |
| مردودات بدون فاتورة اصل `FrmRInvoiceRepair` | Save guard hardBlock ShowLangMessage(1192): حدد نمط الفاتورة | unmapped | Port as a blocking validation |
| مردودات بدون فاتورة اصل `FrmRInvoiceRepair` | Save guard hardBlock ShowLangMessage(1193): حدد الفترة المحاسبية | unmapped | Port as a blocking validation |
| مردودات بدون فاتورة اصل `FrmRInvoiceRepair` | Save guard warningOnly ShowLangMessage(1194): تم تنفيذ العملية بنجاح | unmapped | Port as a warning (legacy does not Exit) |
| مردودات بدون فاتورة اصل `FrmRInvoiceRepair` | Save guard warningOnly ShowLangMessage(1195): يوجد مشكلة في تنفيذ العملية | unmapped | Port as a warning (legacy does not Exit) |
| تقرير مردودات المشتريات تقرير `FrmSTPRRep` | Save guard hardBlock ShowLangMessage(1838): ليس لك صلاحية الدخول على هذه الشاشة | mapped | Port as a blocking validation |
| تقرير مردودات المشتريات تقرير `FrmSTPRRep` | Save guard hardBlock ShowLangMessage(1857): لا توجد أقلام تحقق الشروط المحددة | mapped | Port as a blocking validation |
| تقرير مردودات المشتريات تقرير `FrmSTPRRep` | Save_Trace actions: Print@Other, Print@Print | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| تقرير مردودات المبيعات تقرير `FrmSTSRRep` | Save guard hardBlock ShowLangMessage(1850): ليس لك صلاحية الدخول على هذه الشاشة | mapped | Port as a blocking validation |
| تقرير مردودات المبيعات تقرير `FrmSTSRRep` | Save guard hardBlock ShowLangMessage(1857): لا توجد أقلام تحقق الشروط المحددة | mapped | Port as a blocking validation |
| تقرير مردودات المبيعات تقرير `FrmSTSRRep` | Save_Trace actions: Print@Other, Print@Print | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| تقرير الفواتير الالكترونية المعدلة ولم ترسل `FrmSendElectronicEditsRep` | Save guard hardBlock ShowLangMessage(1858): ليس لك صلاحية الدخول على هذه الشاشة | mapped | Port as a blocking validation |
| ارسال الفواتير الالكترونية `FrmSendElectronicInvoices` | Save guard hardBlock ShowLangMessage(1858): ليس لك صلاحية الدخول على هذه الشاشة | unmapped | Port as a blocking validation |
| `UntSendElectronicInvoices1` | Save guard hardBlock ShowLangMessage(1858): ليس لك صلاحية الدخول على هذه الشاشة | unmapped | Port as a blocking validation |
| تقرير فواتير المبيعات الالكترونية `FrmSendElectronicInvoicesRep` | Save guard hardBlock ShowLangMessage(1858): ليس لك صلاحية الدخول على هذه الشاشة | mapped | Port as a blocking validation |
| ارسال المرتجعات الاكترونية `FrmSendElectronicReturns` | Save guard hardBlock ShowLangMessage(1858): ليس لك صلاحية الدخول على هذه الشاشة | mapped | Port as a blocking validation |
| تقرير فواتير المرتجعات الالكترونية `FrmSendElectronicReturnsRep` | Save guard hardBlock ShowLangMessage(1858): ليس لك صلاحية الدخول على هذه الشاشة | unmapped | Port as a blocking validation |
| `untDelPOS` | Save guard hardBlock ShowLangMessage(375): ادخل كلمة المرور | unmapped | Port as a blocking validation |
| `untDelPOS` | Save guard hardBlock ShowLangMessage(376): ادخل كلمة المرور بشكل صحيح | unmapped | Port as a blocking validation |
| `untDelPOS` | Save guard hardBlock ShowLangMessage(377): هذه الفاتورة تم ردها ولا يمكن حذفها | unmapped | Port as a blocking validation |
| `untDelPOS` | Save guard warningOnly ShowLangMessage(378): يوجد خطأ في الحذف | unmapped | Port as a warning (legacy does not Exit) |
| `untDelPOSColor` | Save guard hardBlock ShowLangMessage(375): ادخل كلمة المرور | unmapped | Port as a blocking validation |
| `untDelPOSColor` | Save guard hardBlock ShowLangMessage(376): ادخل كلمة المرور بشكل صحيح | unmapped | Port as a blocking validation |
| `untDelPOSColor` | Save guard hardBlock ShowLangMessage(377): هذه الفاتورة تم ردها ولا يمكن حذفها | unmapped | Port as a blocking validation |
| `untDelPOSColor` | Save guard warningOnly ShowLangMessage(378): يوجد خطأ في الحذف | unmapped | Port as a warning (legacy does not Exit) |
| إشعارات خصم المنبع `frmEshar` | Line field `CompanyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إشعارات خصم المنبع `frmEshar` | Line field `BranchCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إشعارات خصم المنبع `frmEshar` | Line field `YearID` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إشعارات خصم المنبع `frmEshar` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إشعارات خصم المنبع `frmEshar` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إشعارات خصم المنبع `frmEshar` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إشعارات خصم المنبع `frmEshar` | Line field `Type` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إشعارات خصم المنبع `frmEshar` | Line field `DetailNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إشعارات خصم المنبع `frmEshar` | Line field `AccountNo` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إشعارات خصم المنبع `frmEshar` | Line field `CCenterCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إشعارات خصم المنبع `frmEshar` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إشعارات خصم المنبع `frmEshar` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إشعارات خصم المنبع `frmEshar` | Line field `CurrencyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إشعارات خصم المنبع `frmEshar` | Line field `Change` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إشعارات خصم المنبع `frmEshar` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| إشعارات خصم المنبع `frmEshar` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| إشعارات خصم المنبع `frmEshar` | Line field `EsharCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إشعارات خصم المنبع `frmEshar` | Line field `Accepted` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إشعارات خصم المنبع `frmEshar` | Save guard hardBlock ShowLangMessage(398): ليس لك صلاحية الدخول على شاشة قيد اليومية | unmapped | Port as a blocking validation |
| إشعارات خصم المنبع `frmEshar` | Save guard hardBlock ShowLangMessage(399): هذا الإشعار متعلق بفترة ضريبية مسددة ولا يمكن حذفه | unmapped | Port as a blocking validation |
| إشعارات خصم المنبع `frmEshar` | Save guard hardBlock ShowLangMessage(400): حدد تاريخ الغاء الإشعار | unmapped | Port as a blocking validation |
| إشعارات خصم المنبع `frmEshar` | Save guard hardBlock ShowLangMessage(401): تاريخ الالغاء لا يمكن أن يكون أصغر من تاريخ الإشعار | unmapped | Port as a blocking validation |
| إشعارات خصم المنبع `frmEshar` | Save guard hardBlock ShowLangMessage(402) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | unmapped | Port as a blocking validation |
| إشعارات خصم المنبع `frmEshar` | Save guard hardBlock ShowLangMessage(403) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | unmapped | Port as a blocking validation |
| إشعارات خصم المنبع `frmEshar` | Save guard hardBlock ShowLangMessage(404): ليس لك صلاحية الدخول على شاشة قيد اليومية | unmapped | Port as a blocking validation |
| إشعارات خصم المنبع `frmEshar` | Save_Trace actions: Browse@Other, Print@Print | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| مقاولين النقل `frmInvoiceContractor` | Save guard hardBlock ShowLangMessage(823): ادخل اسم المندوب | unmapped | Port as a blocking validation |
| مقاولين النقل `frmInvoiceContractor` | Save guard hardBlock ShowLangMessage(823): ادخل اسم المندوب | unmapped | Port as a blocking validation |
| مقاولين النقل `frmInvoiceContractor` | Save guard warningOnly ShowLangMessage(825): يوجد خطأ في حفظ البيانات | unmapped | Port as a warning (legacy does not Exit) |
| مقاولين النقل `frmInvoiceContractor` | Save_Trace actions: Add@Save, Edit@Save, Delete@Delete, Browse@Other | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| فاتورة مشتريات `FrmPInovice` | Line field `CompanyCode` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| فاتورة مشتريات `FrmPInovice` | Line field `BranchCode` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| فاتورة مشتريات `FrmPInovice` | Line field `YearID` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| فاتورة مشتريات `FrmPInovice` | Line field `InvoiceNum` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| فاتورة مشتريات `FrmPInovice` | Line field `Type` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| فاتورة مشتريات `FrmPInovice` | Line field `ItemCode` (ops / item) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| فاتورة مشتريات `FrmPInovice` | Line field `UnitCode1` (unit / primaryUnit) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| فاتورة مشتريات `FrmPInovice` | Line field `Qty1` (unit / primaryQty) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| فاتورة مشتريات `FrmPInovice` | Line field `UnitCode2` (unit / altUnit) via Insert Into InvoiceTrxDetail | partial | Complete altUnit mapping (legacy has a dedicated column). |
| فاتورة مشتريات `FrmPInovice` | Line field `Qty2` (unit / altQty) via Insert Into InvoiceTrxDetail | missing | Decide whether altQty is required for parity; not present on web/Prisma. |
| فاتورة مشتريات `FrmPInovice` | Line field `Price` (ops / unitPrice) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| فاتورة مشتريات `FrmPInovice` | Line field `TotalValue` (ops / lineTotal) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| فاتورة مشتريات `FrmPInovice` | Line field `DiscPercent` (discount / discountPercent) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| فاتورة مشتريات `FrmPInovice` | Line field `DiscValue` (discount / discountAmount) via Insert Into InvoiceTrxDetail | partial | Complete discountAmount mapping (legacy has a dedicated column). |
| فاتورة مشتريات `FrmPInovice` | Line field `DaribaPercent` (tax / taxPercent) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| فاتورة مشتريات `FrmPInovice` | Line field `DaribaValue` (tax / taxAmount) via Insert Into InvoiceTrxDetail | partial | Complete taxAmount mapping (legacy has a dedicated column). |
| فاتورة مشتريات `FrmPInovice` | Line field `Value1` (tax / extraValue1) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue1 is required for parity; not present on web/Prisma. |
| فاتورة مشتريات `FrmPInovice` | Line field `Value2` (tax / extraValue2) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue2 is required for parity; not present on web/Prisma. |
| فاتورة مشتريات `FrmPInovice` | Line field `Value3` (tax / extraValue3) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue3 is required for parity; not present on web/Prisma. |
| فاتورة مشتريات `FrmPInovice` | Line field `Value4` (tax / extraValue4) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue4 is required for parity; not present on web/Prisma. |
| فاتورة مشتريات `FrmPInovice` | Line field `Value5` (tax / extraValue5) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue5 is required for parity; not present on web/Prisma. |
| فاتورة مشتريات `FrmPInovice` | Line field `Value6` (tax / extraValue6) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue6 is required for parity; not present on web/Prisma. |
| فاتورة مشتريات `FrmPInovice` | Line field `NetValue` (ops / lineNet) via Insert Into InvoiceTrxDetail | partial | Complete lineNet mapping (legacy has a dedicated column). |
| فاتورة مشتريات `FrmPInovice` | Line field `ExpDate` (traceability / expiryDate) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| فاتورة مشتريات `FrmPInovice` | Save guard hardBlock ShowLangMessage(2098): النسخة غير مرخصة لا يمكنك حفظ أكثر من سجل | mapped | Port as a blocking validation |
| فاتورة مشتريات `FrmPInovice` | Save guard hardBlock ShowLangMessage(834): من فضلك حدد المورد | mapped | Port as a blocking validation |
| فاتورة مشتريات `FrmPInovice` | Save guard hardBlock ShowLangMessage(835): من فضلك حدد العميل | mapped | Port as a blocking validation |
| فاتورة مشتريات `FrmPInovice` | Save guard hardBlock ShowLangMessage(836): لابد من تحديد الاعتماد المستندي | mapped | Port as a blocking validation |
| فاتورة مشتريات `FrmPInovice` | Save guard hardBlock ShowLangMessage(837): يجب تحديد تاريخ الفاتورة | mapped | Port as a blocking validation |
| فاتورة مشتريات `FrmPInovice` | Save guard hardBlock ShowLangMessage(839): تاريخ الاعتماد لا يمكن أن يكون أكبر من تاريخ الفاتورة | mapped | Port as a blocking validation |
| فاتورة مشتريات `FrmPInovice` | Save guard hardBlock ShowLangMessage(842): هذه الفاتورة تؤثر على المخزن ولابد أن يتم تحميلها من إذن إضافة مخزني | mapped | Port as a blocking validation |
| فاتورة مشتريات `FrmPInovice` | Save guard hardBlock ShowLangMessage(843): هذه الفاتورة تؤثر على المخزن ولابد أن يتم تحميلها من إذن صرف مخزني | mapped | Port as a blocking validation |
| فاتورة مشتريات `FrmPInovice` | Save guard hardBlock ShowLangMessage(2275): قيمة الخصم لا يمكن أن تكون اقل من صفر للحساب | mapped | Port as a blocking validation |
| فاتورة مشتريات `FrmPInovice` | Save guard hardBlock ShowLangMessage(2276): قيمة الإضافة لا يمكن أن تكون اقل من صفر للحساب | mapped | Port as a blocking validation |
| فاتورة مشتريات `FrmPInovice` | Save guard hardBlock ShowLangMessage(2277): حدد رقم ورقة الدفع | mapped | Port as a blocking validation |
| فاتورة مشتريات `FrmPInovice` | Save guard hardBlock ShowLangMessage(2278): حدد رقم ورقة القبض | mapped | Port as a blocking validation |
| فاتورة مشتريات `FrmPInovice` | Save_Trace actions: Print@Save, Post@Post, UnPost@Other, Delete@Delete, UnDelete@Other, Print@Print | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| فاتورة مشتريات `FrmPInovice` | Tax ledgers: Eshar | partial | Real tables are Eshar / Dariba* — not DaribaItemDetail / EsharDetail. |
| فاتورة مشتريات `FrmPInovice` | Stored proc SaveInvoices | needs-db-access | SP body is not in the repo. |
| نقطة البيع `FrmPOS` | Line field `CompanyCode` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقطة البيع `FrmPOS` | Line field `BranchCode` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقطة البيع `FrmPOS` | Line field `YearID` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقطة البيع `FrmPOS` | Line field `InvoiceNum` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقطة البيع `FrmPOS` | Line field `Type` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقطة البيع `FrmPOS` | Line field `ItemCode` (ops / item) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| نقطة البيع `FrmPOS` | Line field `UnitCode1` (unit / primaryUnit) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| نقطة البيع `FrmPOS` | Line field `Qty1` (unit / primaryQty) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| نقطة البيع `FrmPOS` | Line field `UnitCode2` (unit / altUnit) via Insert Into InvoiceTrxDetail | partial | Complete altUnit mapping (legacy has a dedicated column). |
| نقطة البيع `FrmPOS` | Line field `Qty2` (unit / altQty) via Insert Into InvoiceTrxDetail | missing | Decide whether altQty is required for parity; not present on web/Prisma. |
| نقطة البيع `FrmPOS` | Line field `Price` (ops / unitPrice) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| نقطة البيع `FrmPOS` | Line field `TotalValue` (ops / lineTotal) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| نقطة البيع `FrmPOS` | Line field `DiscPercent` (discount / discountPercent) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| نقطة البيع `FrmPOS` | Line field `DiscValue` (discount / discountAmount) via Insert Into InvoiceTrxDetail | partial | Complete discountAmount mapping (legacy has a dedicated column). |
| نقطة البيع `FrmPOS` | Line field `DaribaPercent` (tax / taxPercent) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| نقطة البيع `FrmPOS` | Line field `DaribaValue` (tax / taxAmount) via Insert Into InvoiceTrxDetail | partial | Complete taxAmount mapping (legacy has a dedicated column). |
| نقطة البيع `FrmPOS` | Line field `Value1` (tax / extraValue1) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue1 is required for parity; not present on web/Prisma. |
| نقطة البيع `FrmPOS` | Line field `Value2` (tax / extraValue2) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue2 is required for parity; not present on web/Prisma. |
| نقطة البيع `FrmPOS` | Line field `Value3` (tax / extraValue3) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue3 is required for parity; not present on web/Prisma. |
| نقطة البيع `FrmPOS` | Line field `Value4` (tax / extraValue4) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue4 is required for parity; not present on web/Prisma. |
| نقطة البيع `FrmPOS` | Line field `Value5` (tax / extraValue5) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue5 is required for parity; not present on web/Prisma. |
| نقطة البيع `FrmPOS` | Line field `Value6` (tax / extraValue6) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue6 is required for parity; not present on web/Prisma. |
| نقطة البيع `FrmPOS` | Line field `NetValue` (ops / lineNet) via Insert Into InvoiceTrxDetail | partial | Complete lineNet mapping (legacy has a dedicated column). |
| نقطة البيع `FrmPOS` | Line field `ExpDate` (traceability / expiryDate) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| نقطة البيع `FrmPOS` | Save guard hardBlock ShowLangMessage(954): تاريخ الفاتورة أصغر من تاريخ البداية | mapped | Port as a blocking validation |
| نقطة البيع `FrmPOS` | Save guard hardBlock ShowLangMessage(955): نقطة البيع هذه لطيار لذلك لابد من تحديد طيار | mapped | Port as a blocking validation |
| نقطة البيع `FrmPOS` | Save guard hardBlock ShowLangMessage(956): غير مسموح بدفع قيمة أقل من قيمة الفاتورة | mapped | Port as a blocking validation |
| نقطة البيع `FrmPOS` | Save guard hardBlock ShowLangMessage(957): يجب ادخال صنف واحد على الأقل ومراعاة البدء من أول سطر وعدم ترك أي صفوف فارغة | mapped | Port as a blocking validation |
| نقطة البيع `FrmPOS` | Save guard hardBlock ShowLangMessage(2296) [AllowMinusQty]: الكمية بالمخزن تصبح بالسالب للصنف | mapped | Port as a blocking validation |
| نقطة البيع `FrmPOS` | Save guard hardBlock ShowLangMessage(958) [AllowMinusQty, GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| نقطة البيع `FrmPOS` | Save guard hardBlock ShowLangMessage(959) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| نقطة البيع `FrmPOS` | Save guard warningOnly ShowLangMessage(2297): تم تعليق الفاتورة رقم | mapped | Port as a warning (legacy does not Exit) |
| نقطة البيع `FrmPOS` | Save guard hardBlock ShowLangMessage(960): يوجد خطأ في حفظ البيانات | mapped | Port as a blocking validation |
| `untPOSColor` | Line field `CompanyCode` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColor` | Line field `BranchCode` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColor` | Line field `YearID` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColor` | Line field `InvoiceNum` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColor` | Line field `Type` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColor` | Line field `ItemCode` (ops / item) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSColor` | Line field `UnitCode1` (unit / primaryUnit) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSColor` | Line field `Qty1` (unit / primaryQty) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSColor` | Line field `UnitCode2` (unit / altUnit) via Insert Into InvoiceTrxDetail | partial | Complete altUnit mapping (legacy has a dedicated column). |
| `untPOSColor` | Line field `Qty2` (unit / altQty) via Insert Into InvoiceTrxDetail | missing | Decide whether altQty is required for parity; not present on web/Prisma. |
| `untPOSColor` | Line field `Price` (ops / unitPrice) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSColor` | Line field `TotalValue` (ops / lineTotal) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSColor` | Line field `DiscPercent` (discount / discountPercent) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSColor` | Line field `DiscValue` (discount / discountAmount) via Insert Into InvoiceTrxDetail | partial | Complete discountAmount mapping (legacy has a dedicated column). |
| `untPOSColor` | Line field `DaribaPercent` (tax / taxPercent) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSColor` | Line field `DaribaValue` (tax / taxAmount) via Insert Into InvoiceTrxDetail | partial | Complete taxAmount mapping (legacy has a dedicated column). |
| `untPOSColor` | Line field `Value1` (tax / extraValue1) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue1 is required for parity; not present on web/Prisma. |
| `untPOSColor` | Line field `Value2` (tax / extraValue2) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue2 is required for parity; not present on web/Prisma. |
| `untPOSColor` | Line field `Value3` (tax / extraValue3) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue3 is required for parity; not present on web/Prisma. |
| `untPOSColor` | Line field `Value4` (tax / extraValue4) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue4 is required for parity; not present on web/Prisma. |
| `untPOSColor` | Line field `Value5` (tax / extraValue5) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue5 is required for parity; not present on web/Prisma. |
| `untPOSColor` | Line field `Value6` (tax / extraValue6) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue6 is required for parity; not present on web/Prisma. |
| `untPOSColor` | Line field `NetValue` (ops / lineNet) via Insert Into InvoiceTrxDetail | partial | Complete lineNet mapping (legacy has a dedicated column). |
| `untPOSColor` | Line field `ExpDate` (traceability / expiryDate) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSColor` | Save guard hardBlock ShowLangMessage(954): تاريخ الفاتورة أصغر من تاريخ البداية | unmapped | Port as a blocking validation |
| `untPOSColor` | Save guard hardBlock ShowLangMessage(955): نقطة البيع هذه لطيار لذلك لابد من تحديد طيار | unmapped | Port as a blocking validation |
| `untPOSColor` | Save guard hardBlock ShowLangMessage(956): غير مسموح بدفع قيمة أقل من قيمة الفاتورة | unmapped | Port as a blocking validation |
| `untPOSColor` | Save guard hardBlock ShowLangMessage(957): يجب ادخال صنف واحد على الأقل ومراعاة البدء من أول سطر وعدم ترك أي صفوف فارغة | unmapped | Port as a blocking validation |
| `untPOSColor` | Save guard hardBlock ShowLangMessage(2296) [AllowMinusQty]: الكمية بالمخزن تصبح بالسالب للصنف | unmapped | Port as a blocking validation |
| `untPOSColor` | Save guard hardBlock ShowLangMessage(958) [AllowMinusQty, GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | unmapped | Port as a blocking validation |
| `untPOSColor` | Save guard hardBlock ShowLangMessage(959) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | unmapped | Port as a blocking validation |
| `untPOSColor` | Save guard warningOnly ShowLangMessage(2297): تم تعليق الفاتورة رقم | unmapped | Port as a warning (legacy does not Exit) |
| `untPOSColor` | Save guard hardBlock ShowLangMessage(960): يوجد خطأ في حفظ البيانات | unmapped | Port as a blocking validation |
| `untPOSColorFinish` | Line field `CompanyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColorFinish` | Line field `BranchCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColorFinish` | Line field `YearID` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColorFinish` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColorFinish` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColorFinish` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColorFinish` | Line field `Type` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColorFinish` | Line field `DetailNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColorFinish` | Line field `AccountNo` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColorFinish` | Line field `CCenterCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColorFinish` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColorFinish` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColorFinish` | Line field `CurrencyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColorFinish` | Line field `Change` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColorFinish` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| `untPOSColorFinish` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| `untPOSColorFinish` | Line field `EsharCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColorFinish` | Line field `Accepted` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColorFinish` | Line field `Audit` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSColorFinish` | Save guard hardBlock ShowLangMessage(967) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | unmapped | Port as a blocking validation |
| `untPOSColorFinish` | Save guard hardBlock ShowLangMessage(968) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | unmapped | Port as a blocking validation |
| `untPOSColorFinish` | Save guard warningOnly ShowLangMessage(969): تم إغلاق اليومية بنجاح | unmapped | Port as a warning (legacy does not Exit) |
| `untPOSColorFinish` | Save guard warningOnly ShowLangMessage(970): يوجد خطأ في اغلاق اليومية | unmapped | Port as a warning (legacy does not Exit) |
| `untPOSColorFinish` | Save guard hardBlock ShowLangMessage(971): ادخل كلمة المرور | unmapped | Port as a blocking validation |
| `untPOSColorFinish` | Save guard hardBlock ShowLangMessage(972): ادخل كلمة المرور بشكل صحيح | unmapped | Port as a blocking validation |
| يومية نقاط البيع `FrmPOSFinish` | Line field `CompanyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| يومية نقاط البيع `FrmPOSFinish` | Line field `BranchCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| يومية نقاط البيع `FrmPOSFinish` | Line field `YearID` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| يومية نقاط البيع `FrmPOSFinish` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| يومية نقاط البيع `FrmPOSFinish` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| يومية نقاط البيع `FrmPOSFinish` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| يومية نقاط البيع `FrmPOSFinish` | Line field `Type` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| يومية نقاط البيع `FrmPOSFinish` | Line field `DetailNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| يومية نقاط البيع `FrmPOSFinish` | Line field `AccountNo` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| يومية نقاط البيع `FrmPOSFinish` | Line field `CCenterCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| يومية نقاط البيع `FrmPOSFinish` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| يومية نقاط البيع `FrmPOSFinish` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| يومية نقاط البيع `FrmPOSFinish` | Line field `CurrencyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| يومية نقاط البيع `FrmPOSFinish` | Line field `Change` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| يومية نقاط البيع `FrmPOSFinish` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| يومية نقاط البيع `FrmPOSFinish` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| يومية نقاط البيع `FrmPOSFinish` | Line field `EsharCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| يومية نقاط البيع `FrmPOSFinish` | Line field `Accepted` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| يومية نقاط البيع `FrmPOSFinish` | Line field `Audit` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| يومية نقاط البيع `FrmPOSFinish` | Save guard hardBlock ShowLangMessage(967) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | unmapped | Port as a blocking validation |
| يومية نقاط البيع `FrmPOSFinish` | Save guard hardBlock ShowLangMessage(968) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | unmapped | Port as a blocking validation |
| يومية نقاط البيع `FrmPOSFinish` | Save guard warningOnly ShowLangMessage(969): تم إغلاق اليومية بنجاح | unmapped | Port as a warning (legacy does not Exit) |
| يومية نقاط البيع `FrmPOSFinish` | Save guard warningOnly ShowLangMessage(970): يوجد خطأ في اغلاق اليومية | unmapped | Port as a warning (legacy does not Exit) |
| يومية نقاط البيع `FrmPOSFinish` | Save guard hardBlock ShowLangMessage(971): ادخل كلمة المرور | unmapped | Port as a blocking validation |
| يومية نقاط البيع `FrmPOSFinish` | Save guard hardBlock ShowLangMessage(972): ادخل كلمة المرور بشكل صحيح | unmapped | Port as a blocking validation |
| يوميات نقطة البيع `frmPOSOption` | Save guard hardBlock ShowLangMessage(973): لا توجد نتائج تحقق الشروط المطلوبة | unmapped | Port as a blocking validation |
| `untPOSReturn` | Line field `CompanyCode` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSReturn` | Line field `BranchCode` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSReturn` | Line field `YearID` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSReturn` | Line field `InvoiceNum` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSReturn` | Line field `Type` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSReturn` | Line field `ItemCode` (ops / item) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSReturn` | Line field `UnitCode1` (unit / primaryUnit) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSReturn` | Line field `Qty1` (unit / primaryQty) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSReturn` | Line field `UnitCode2` (unit / altUnit) via Insert Into InvoiceTrxDetail | partial | Complete altUnit mapping (legacy has a dedicated column). |
| `untPOSReturn` | Line field `Qty2` (unit / altQty) via Insert Into InvoiceTrxDetail | missing | Decide whether altQty is required for parity; not present on web/Prisma. |
| `untPOSReturn` | Line field `Price` (ops / unitPrice) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSReturn` | Line field `TotalValue` (ops / lineTotal) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSReturn` | Line field `DiscPercent` (discount / discountPercent) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSReturn` | Line field `DiscValue` (discount / discountAmount) via Insert Into InvoiceTrxDetail | partial | Complete discountAmount mapping (legacy has a dedicated column). |
| `untPOSReturn` | Line field `DaribaPercent` (tax / taxPercent) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSReturn` | Line field `DaribaValue` (tax / taxAmount) via Insert Into InvoiceTrxDetail | partial | Complete taxAmount mapping (legacy has a dedicated column). |
| `untPOSReturn` | Line field `Value1` (tax / extraValue1) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue1 is required for parity; not present on web/Prisma. |
| `untPOSReturn` | Line field `Value2` (tax / extraValue2) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue2 is required for parity; not present on web/Prisma. |
| `untPOSReturn` | Line field `Value3` (tax / extraValue3) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue3 is required for parity; not present on web/Prisma. |
| `untPOSReturn` | Line field `Value4` (tax / extraValue4) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue4 is required for parity; not present on web/Prisma. |
| `untPOSReturn` | Line field `Value5` (tax / extraValue5) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue5 is required for parity; not present on web/Prisma. |
| `untPOSReturn` | Line field `Value6` (tax / extraValue6) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue6 is required for parity; not present on web/Prisma. |
| `untPOSReturn` | Line field `NetValue` (ops / lineNet) via Insert Into InvoiceTrxDetail | partial | Complete lineNet mapping (legacy has a dedicated column). |
| `untPOSReturn` | Line field `ExpDate` (traceability / expiryDate) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSReturn` | Save guard hardBlock ShowLangMessage(975): ادخل رقم الفاتورة التي تريد ردها | unmapped | Port as a blocking validation |
| `untPOSReturn` | Save guard hardBlock ShowLangMessage(976): لا توجد فاتورة نقطة بيع مرحلة بهذا الرقم | unmapped | Port as a blocking validation |
| `untPOSReturn` | Save guard hardBlock ShowLangMessage(977): هذه الفاتورة تم ردها من قبل | unmapped | Port as a blocking validation |
| `untPOSReturn` | Save guard hardBlock ShowLangMessage(978): لابد من ارجاع صنف واحد على الأقل | unmapped | Port as a blocking validation |
| `untPOSReturn` | Save guard hardBlock ShowLangMessage(979) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | unmapped | Port as a blocking validation |
| `untPOSReturn` | Save guard hardBlock ShowLangMessage(980) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | unmapped | Port as a blocking validation |
| `untPOSReturn` | Save guard warningOnly ShowLangMessage(981): تم حفظ البيانات بنجاح | unmapped | Port as a warning (legacy does not Exit) |
| `untPOSReturn` | Save guard warningOnly ShowLangMessage(982): يوجد خطأ في حفظ البيانات | unmapped | Port as a warning (legacy does not Exit) |
| `untPOSReturn` | Save guard hardBlock ShowLangMessage(983): ادخل كلمة المرور | unmapped | Port as a blocking validation |
| `untPOSReturn` | Save guard hardBlock ShowLangMessage(984): ادخل كلمة المرور بشكل صحيح | unmapped | Port as a blocking validation |
| `untPOSReturnColor` | Line field `CompanyCode` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSReturnColor` | Line field `BranchCode` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSReturnColor` | Line field `YearID` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSReturnColor` | Line field `InvoiceNum` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSReturnColor` | Line field `Type` (ops / other) via Insert Into InvoiceTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untPOSReturnColor` | Line field `ItemCode` (ops / item) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSReturnColor` | Line field `UnitCode1` (unit / primaryUnit) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSReturnColor` | Line field `Qty1` (unit / primaryQty) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSReturnColor` | Line field `UnitCode2` (unit / altUnit) via Insert Into InvoiceTrxDetail | partial | Complete altUnit mapping (legacy has a dedicated column). |
| `untPOSReturnColor` | Line field `Qty2` (unit / altQty) via Insert Into InvoiceTrxDetail | missing | Decide whether altQty is required for parity; not present on web/Prisma. |
| `untPOSReturnColor` | Line field `Price` (ops / unitPrice) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSReturnColor` | Line field `TotalValue` (ops / lineTotal) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSReturnColor` | Line field `DiscPercent` (discount / discountPercent) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSReturnColor` | Line field `DiscValue` (discount / discountAmount) via Insert Into InvoiceTrxDetail | partial | Complete discountAmount mapping (legacy has a dedicated column). |
| `untPOSReturnColor` | Line field `DaribaPercent` (tax / taxPercent) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSReturnColor` | Line field `DaribaValue` (tax / taxAmount) via Insert Into InvoiceTrxDetail | partial | Complete taxAmount mapping (legacy has a dedicated column). |
| `untPOSReturnColor` | Line field `Value1` (tax / extraValue1) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue1 is required for parity; not present on web/Prisma. |
| `untPOSReturnColor` | Line field `Value2` (tax / extraValue2) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue2 is required for parity; not present on web/Prisma. |
| `untPOSReturnColor` | Line field `Value3` (tax / extraValue3) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue3 is required for parity; not present on web/Prisma. |
| `untPOSReturnColor` | Line field `Value4` (tax / extraValue4) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue4 is required for parity; not present on web/Prisma. |
| `untPOSReturnColor` | Line field `Value5` (tax / extraValue5) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue5 is required for parity; not present on web/Prisma. |
| `untPOSReturnColor` | Line field `Value6` (tax / extraValue6) via Insert Into InvoiceTrxDetail | missing | Decide whether extraValue6 is required for parity; not present on web/Prisma. |
| `untPOSReturnColor` | Line field `NetValue` (ops / lineNet) via Insert Into InvoiceTrxDetail | partial | Complete lineNet mapping (legacy has a dedicated column). |
| `untPOSReturnColor` | Line field `ExpDate` (traceability / expiryDate) via Insert Into InvoiceTrxDetail | covered | Keep — already on Prisma / Zod / grid. |
| `untPOSReturnColor` | Save guard hardBlock ShowLangMessage(975): ادخل رقم الفاتورة التي تريد ردها | unmapped | Port as a blocking validation |
| `untPOSReturnColor` | Save guard hardBlock ShowLangMessage(976): لا توجد فاتورة نقطة بيع مرحلة بهذا الرقم | unmapped | Port as a blocking validation |
| `untPOSReturnColor` | Save guard hardBlock ShowLangMessage(977): هذه الفاتورة تم ردها من قبل | unmapped | Port as a blocking validation |
| `untPOSReturnColor` | Save guard hardBlock ShowLangMessage(978): لابد من ارجاع صنف واحد على الأقل | unmapped | Port as a blocking validation |
| `untPOSReturnColor` | Save guard hardBlock ShowLangMessage(979) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | unmapped | Port as a blocking validation |
| `untPOSReturnColor` | Save guard hardBlock ShowLangMessage(980) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | unmapped | Port as a blocking validation |
| `untPOSReturnColor` | Save guard warningOnly ShowLangMessage(981): تم حفظ البيانات بنجاح | unmapped | Port as a warning (legacy does not Exit) |
| `untPOSReturnColor` | Save guard warningOnly ShowLangMessage(982): يوجد خطأ في حفظ البيانات | unmapped | Port as a warning (legacy does not Exit) |
| `untPOSReturnColor` | Save guard hardBlock ShowLangMessage(983): ادخل كلمة المرور | unmapped | Port as a blocking validation |
| `untPOSReturnColor` | Save guard hardBlock ShowLangMessage(984): ادخل كلمة المرور بشكل صحيح | unmapped | Port as a blocking validation |
| إعدادات نقطة البيع `FrmPOSSetting` | Save guard hardBlock ShowLangMessage(985): حدد البائع | unmapped | Port as a blocking validation |
| إعدادات نقطة البيع `FrmPOSSetting` | Save guard hardBlock ShowLangMessage(986): حدد الصندوق الرئيسي | unmapped | Port as a blocking validation |
| إعدادات نقطة البيع `FrmPOSSetting` | Save guard hardBlock ShowLangMessage(987): حدد الصندوق الفرعي | unmapped | Port as a blocking validation |
| إعدادات نقطة البيع `FrmPOSSetting` | Save guard hardBlock ShowLangMessage(988): حدد حساب المبيعات | unmapped | Port as a blocking validation |
| إعدادات نقطة البيع `FrmPOSSetting` | Save guard hardBlock ShowLangMessage(989): حدد المخزن | unmapped | Port as a blocking validation |
| إعدادات نقطة البيع `FrmPOSSetting` | Save guard hardBlock ShowLangMessage(990): حدد مركز التكلفة | unmapped | Port as a blocking validation |
| إعدادات نقطة البيع `FrmPOSSetting` | Save guard hardBlock ShowLangMessage(991): حدد العميل الافتراضي | unmapped | Port as a blocking validation |
| إعدادات نقطة البيع `FrmPOSSetting` | Save guard hardBlock ShowLangMessage(992): حدد حساب مردودات المبيعات | unmapped | Port as a blocking validation |
| إعدادات نقطة البيع `FrmPOSSetting` | Save guard hardBlock ShowLangMessage(993): ادخل كلمة المرور | unmapped | Port as a blocking validation |
| إعدادات نقطة البيع `FrmPOSSetting` | Save guard hardBlock ShowLangMessage(994): ادخل كلمة المرور بشكل صحيح | unmapped | Port as a blocking validation |
| `untPOSSettingColor` | Save guard hardBlock ShowLangMessage(985): حدد البائع | unmapped | Port as a blocking validation |
| `untPOSSettingColor` | Save guard hardBlock ShowLangMessage(986): حدد الصندوق الرئيسي | unmapped | Port as a blocking validation |
| `untPOSSettingColor` | Save guard hardBlock ShowLangMessage(987): حدد الصندوق الفرعي | unmapped | Port as a blocking validation |
| `untPOSSettingColor` | Save guard hardBlock ShowLangMessage(988): حدد حساب المبيعات | unmapped | Port as a blocking validation |
| `untPOSSettingColor` | Save guard hardBlock ShowLangMessage(989): حدد المخزن | unmapped | Port as a blocking validation |
| `untPOSSettingColor` | Save guard hardBlock ShowLangMessage(990): حدد مركز التكلفة | unmapped | Port as a blocking validation |
| `untPOSSettingColor` | Save guard hardBlock ShowLangMessage(991): حدد العميل الافتراضي | unmapped | Port as a blocking validation |
| `untPOSSettingColor` | Save guard hardBlock ShowLangMessage(992): حدد حساب مردودات المبيعات | unmapped | Port as a blocking validation |
| `untPOSSettingColor` | Save guard hardBlock ShowLangMessage(993): ادخل كلمة المرور | unmapped | Port as a blocking validation |
| `untPOSSettingColor` | Save guard hardBlock ShowLangMessage(994): ادخل كلمة المرور بشكل صحيح | unmapped | Port as a blocking validation |
| ترحيل كل القيود `frmPostAll` | Save guard hardBlock ShowLangMessage(995): كلمة المرور غير صحيحة | mapped | Port as a blocking validation |
| مردودات مشتريات `FrmRInovice` | Line field `CompanyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `BranchCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `YearID` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `Type` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `DetailNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `AccountNo` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `CCenterCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `CurrencyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `Change` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `EsharCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `Accepted` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `Audit` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `MabiatAmount` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `CashNum` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `Amount` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `PKNum` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Line field `FromAccountNo` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| مردودات مشتريات `FrmRInovice` | Save guard hardBlock ShowLangMessage(2129): النسخة غير مرخصة لا يمكنك حفظ أكثر من سجل | mapped | Port as a blocking validation |
| مردودات مشتريات `FrmRInovice` | Save guard hardBlock ShowLangMessage(1081): من فضلك حدد المورد | mapped | Port as a blocking validation |
| مردودات مشتريات `FrmRInovice` | Save guard hardBlock ShowLangMessage(1082): من فضلك حدد العميل | mapped | Port as a blocking validation |
| مردودات مشتريات `FrmRInovice` | Save guard hardBlock ShowLangMessage(1083): يجب تحديد تاريخ الرد | mapped | Port as a blocking validation |
| مردودات مشتريات `FrmRInovice` | Save guard hardBlock ShowLangMessage(1084): هذه الفاتورة تؤثر على المخزن ولابد أن يتم تحميلها من إذن إضافة مخزني | mapped | Port as a blocking validation |
| مردودات مشتريات `FrmRInovice` | Save guard hardBlock ShowLangMessage(1085): هذه الفاتورة تؤثر على المخزن ولابد أن يتم تحميلها من إذن صرف مخزني | mapped | Port as a blocking validation |
| مردودات مشتريات `FrmRInovice` | Save guard hardBlock ShowLangMessage(2307): حدد المخزن للصنف | mapped | Port as a blocking validation |
| مردودات مشتريات `FrmRInovice` | Save guard hardBlock ShowLangMessage(2308): السعر لا يمكن أن يكون بالسالب للصنف | mapped | Port as a blocking validation |
| مردودات مشتريات `FrmRInovice` | Save guard hardBlock ShowLangMessage(2311): قيمة الخصم لا يمكن أن تكون اقل من صفر للحساب | mapped | Port as a blocking validation |
| مردودات مشتريات `FrmRInovice` | Save guard hardBlock ShowLangMessage(2312): قيمة الإضافة لا يمكن أن تكون اقل من صفر للحساب | mapped | Port as a blocking validation |
| مردودات مشتريات `FrmRInovice` | Save guard hardBlock ShowLangMessage(2313): حدد رقم ورقة الدفع | mapped | Port as a blocking validation |
| مردودات مشتريات `FrmRInovice` | Save guard hardBlock ShowLangMessage(2314): حدد رقم ورقة القبض | mapped | Port as a blocking validation |
| مردودات مشتريات `FrmRInovice` | Save_Trace actions: Print@Save, Post@Post, UnPost@Other, Delete@Delete, UnDelete@Other, Print@Print | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| مردودات مشتريات `FrmRInovice` | Tax ledgers: Eshar | partial | Real tables are Eshar / Dariba* — not DaribaItemDetail / EsharDetail. |
| مردودات مشتريات `FrmRInovice` | Stored proc SaveReturnInvoices | needs-db-access | SP body is not in the repo. |

## Treasury & Cheques

| Screen | Legacy Business Rule / Line Field | Web/Backend Status | Action Required |
|---|---|---|---|
| سداد مستخلص `FrmContractorPayment` | Line field `CompanyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `BranchCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `YearID` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `Type` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `DetailNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `AccountNo` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `CCenterCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `CurrencyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `Change` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `EsharCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `Accepted` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `Audit` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `PKNum` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `FromAccountNo` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `FromCCenterCode` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `Amount` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Line field `Name` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد مستخلص `FrmContractorPayment` | Save guard hardBlock ShowLangMessage(79) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| سداد مستخلص `FrmContractorPayment` | Save guard hardBlock ShowLangMessage(80) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| سداد مستخلص `FrmContractorPayment` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| سداد مستخلص `FrmContractorPayment` | Save guard hardBlock ShowLangMessage(885): لا يمكن إنشاء ورقة دفع بشكل مباشر لعدم وجود حساب دفع افتراضي للنمط المحدد | mapped | Port as a blocking validation |
| سداد مستخلص `FrmContractorPayment` | Save guard hardBlock ShowLangMessage(2286): رقم الشيك موجود من قبل | mapped | Port as a blocking validation |
| سداد مستخلص `FrmContractorPayment` | Save_Trace actions: Delete@Delete | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Line field `CompanyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Line field `BranchCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Line field `YearID` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Line field `Type` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Line field `DetailNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Line field `AccountNo` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Line field `CCenterCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Line field `CurrencyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Line field `Change` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Line field `EsharCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Line field `Accepted` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Line field `Audit` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Save guard hardBlock ShowLangMessage(79) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Save guard hardBlock ShowLangMessage(80) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| صرف الرواتب الشهرية للموظفين `FrmEmployeeMonthSalaryPayment` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Line field `CompanyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Line field `BranchCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Line field `YearID` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Line field `Type` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Line field `DetailNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Line field `AccountNo` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Line field `CCenterCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Line field `CurrencyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Line field `Change` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Line field `EsharCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Line field `Accepted` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Line field `Audit` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Save guard hardBlock ShowLangMessage(79) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | unmapped | Port as a blocking validation |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Save guard hardBlock ShowLangMessage(80) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | unmapped | Port as a blocking validation |
| صرف مستحقات الأجازة السنوية `FrmHREmployeeAnnualVacationPayment` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | unmapped | Port as a warning (legacy does not Exit) |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Line field `CompanyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Line field `BranchCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Line field `YearID` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Line field `Type` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Line field `DetailNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Line field `AccountNo` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Line field `CCenterCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Line field `CurrencyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Line field `Change` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Line field `EsharCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Line field `Accepted` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Line field `Audit` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Save guard hardBlock ShowLangMessage(79) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Save guard hardBlock ShowLangMessage(80) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| صرف مستحقات نهاية الخدمة `FrmHREmployeeEndOfWorkPayment` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| انتهاء خدمة موظف `FrmHREmployeeEndWork` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Line field `CompanyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Line field `BranchCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Line field `YearID` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Line field `Type` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Line field `DetailNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Line field `AccountNo` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Line field `CCenterCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Line field `CurrencyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Line field `Change` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Line field `EsharCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Line field `Accepted` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Line field `Audit` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Save guard hardBlock ShowLangMessage(79) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Save guard hardBlock ShowLangMessage(80) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| صرف مستحقات بدل السكن `FrmHREmployeeHousingPayment` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| سند صرف نقدية `FrmBP` | Line field `CompanyCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `BranchCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `YearID` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `CashNum` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `DetailDescA` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `DetailDescE` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `Type` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `DetailNum` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `AccountNo` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `CCenterCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `Amount` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `CurrencyCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `Change` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into CashTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into CashTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `EsharCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `Accepted` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Line field `Audit` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سند صرف نقدية `FrmBP` | Save guard hardBlock ShowLangMessage(1943) [CCType, Mozana]: النسخة غير مرخصة لا يمكنك حفظ أكثر من سجل | mapped | Port as a blocking validation |
| سند صرف نقدية `FrmBP` | Save guard hardBlock ShowLangMessage(75): أمر الصرف تم تحميله | mapped | Port as a blocking validation |
| سند صرف نقدية `FrmBP` | Save guard hardBlock ShowLangMessage(76): يجب تحديد الصندوق | mapped | Port as a blocking validation |
| سند صرف نقدية `FrmBP` | Save guard hardBlock ShowLangMessage(77): يجب تحديد تاريخ السند | mapped | Port as a blocking validation |
| سند صرف نقدية `FrmBP` | Save guard hardBlock ShowLangMessage(79) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| سند صرف نقدية `FrmBP` | Save guard hardBlock ShowLangMessage(80) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| سند صرف نقدية `FrmBP` | Save guard hardBlock ShowLangMessage(81): يجب إدخال الرمز | mapped | Port as a blocking validation |
| سند صرف نقدية `FrmBP` | Save guard hardBlock ShowLangMessage(82): هذا الرمز موجود سابقا | mapped | Port as a blocking validation |
| سند صرف نقدية `FrmBP` | Save guard hardBlock ShowLangMessage(1944): الحساب يجب تحديد اسم له | mapped | Port as a blocking validation |
| سند صرف نقدية `FrmBP` | Save guard hardBlock ShowLangMessage(1945): الحساب يجب تحديد قيمة له | mapped | Port as a blocking validation |
| سند صرف نقدية `FrmBP` | Save guard hardBlock ShowLangMessage(1946): الحساب يجب أن تكون قيمته أكبر من الصفر | mapped | Port as a blocking validation |
| سند صرف نقدية `FrmBP` | Save guard hardBlock ShowLangMessage(1947): الحساب يجب تحديد عملة له | mapped | Port as a blocking validation |
| سند صرف نقدية `FrmBP` | Save_Trace actions: Browse@Other, Post@Post, UnPost@Other, UnDelete@Other, Add@Save, Edit@Save, Delete@Delete, Print@Print | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| `FrmCashFilter` | Save guard hardBlock ShowLangMessage(111): تاريخ إلى يجب أن يكون أكبر من تاريخ من | unmapped | Port as a blocking validation |
| `FrmDistCash` | Save guard hardBlock ShowLangMessage(384): من فضلك حدد المبلغ | unmapped | Port as a blocking validation |
| `FrmDistCash` | Save guard hardBlock ShowLangMessage(385): من فضلك حدد تاريخ بداية أول دفعة | unmapped | Port as a blocking validation |
| `FrmDistCash` | Save guard hardBlock ShowLangMessage(386): تاريخ البدء لا يمكن ان يكون أصغر من تاريخ الفاتورة | unmapped | Port as a blocking validation |
| `FrmDistPaymentCheck` | Save guard hardBlock ShowLangMessage(390): من فضلك حدد المبلغ | unmapped | Port as a blocking validation |
| `FrmDistPaymentCheck` | Save guard hardBlock ShowLangMessage(391): من فضلك حدد تاريخ بداية أول دفعة | unmapped | Port as a blocking validation |
| `FrmDistRecieveCheck` | Save guard hardBlock ShowLangMessage(392): من فضلك حدد المبلغ | unmapped | Port as a blocking validation |
| `FrmDistRecieveCheck` | Save guard hardBlock ShowLangMessage(393): من فضلك حدد تاريخ بداية أول دفعة | unmapped | Port as a blocking validation |
| `frmPaymentCheckMany` | Line field `CompanyCode` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `BranchCode` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `PKNum` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `YearId` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `Type` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `TakeDescA` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `TakeDescE` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `TakeAmountDate` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `TakeAmountDateH` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `TakeAccountNo` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `TakeAmount` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `TakeComm` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `TakeCommAccountNo` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `TakeCommCreditAccountNo` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `TakeFromOriginal` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `TakeCCenterCode` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `TakeCommCCenterCode` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `TakeCommCreditCCenterCode` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `TakeGLNum` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `TakeYearId` (ops / other) via Insert Into PKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `YearID` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmPaymentCheckMany` | Save guard hardBlock ShowLangMessage(1020): يجب تحديد تاريخ تحصيل الورقة | mapped | Port as a blocking validation |
| `frmPaymentCheckMany` | Save guard hardBlock ShowLangMessage(1021): تاريخ التحصيل لا يمكن ان يكون أصغر من تاريخ التحرير | mapped | Port as a blocking validation |
| `frmPaymentCheckMany` | Save guard hardBlock ShowLangMessage(1022): من فضلك حدد الحساب المحصل منه | mapped | Port as a blocking validation |
| `frmPaymentCheckMany` | Save guard hardBlock ShowLangMessage(1023): من فضلك حدد حساب العمولة | mapped | Port as a blocking validation |
| `frmPaymentCheckMany` | Save guard hardBlock ShowLangMessage(1024): من فضلك حدد الحساب الدائن للعمولة | mapped | Port as a blocking validation |
| `frmPaymentCheckMany` | Save guard hardBlock ShowLangMessage(1026): قيمة العمولة يجب أن تكون أصغر من قيمة الورقة | mapped | Port as a blocking validation |
| `frmPaymentCheckMany` | Save guard hardBlock ShowLangMessage(1027): قيمة العمولة يجب أن تكون اكبر من الصفر | mapped | Port as a blocking validation |
| `frmPaymentCheckMany` | Save guard hardBlock ShowLangMessage(1028) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| `frmPaymentCheckMany` | Save guard hardBlock ShowLangMessage(1029) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| `frmPaymentCheckMany` | Save guard hardBlock ShowLangMessage(2119): الحساب يجب أن يحدد له مركز تكلفة | mapped | Port as a blocking validation |
| `frmPaymentCheckMany` | Save guard hardBlock ShowLangMessage(2120): الحساب يجب أن يكون بدون مركز تكلفة | mapped | Port as a blocking validation |
| `frmPaymentCheckMany` | Save guard hardBlock ShowLangMessage(2121): الحساب يجب أن يحدد له مركز تكلفة | mapped | Port as a blocking validation |
| `FrmProjectContractPayment` | Save guard hardBlock ShowLangMessage(79) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | unmapped | Port as a blocking validation |
| `FrmProjectContractPayment` | Save guard hardBlock ShowLangMessage(80) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | unmapped | Port as a blocking validation |
| `FrmProjectContractPayment` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | unmapped | Port as a warning (legacy does not Exit) |
| `frmRecieveCheckMany` | Line field `CompanyCode` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `BranchCode` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `CKNum` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `YearId` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `Type` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `TakeDescA` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `TakeDescE` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `TakeAmountDate` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `TakeAmountDateH` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `TakeAccountNo` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `TakeAmount` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `TakeComm` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `TakeCommAccountNo` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `TakeCommCreditAccountNo` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `TakeFromOriginal` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `TakeCCenterCode` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `TakeCommCCenterCode` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `TakeCommCreditCCenterCode` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `TakeGLNum` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `TakeYearId` (ops / other) via Insert Into CKTrxDetailSub | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `YearID` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `frmRecieveCheckMany` | Save guard hardBlock ShowLangMessage(1020): يجب تحديد تاريخ تحصيل الورقة | mapped | Port as a blocking validation |
| `frmRecieveCheckMany` | Save guard hardBlock ShowLangMessage(1021): تاريخ التحصيل لا يمكن ان يكون أصغر من تاريخ التحرير | mapped | Port as a blocking validation |
| `frmRecieveCheckMany` | Save guard hardBlock ShowLangMessage(1022): من فضلك حدد الحساب المحصل منه | mapped | Port as a blocking validation |
| `frmRecieveCheckMany` | Save guard hardBlock ShowLangMessage(1023): من فضلك حدد حساب العمولة | mapped | Port as a blocking validation |
| `frmRecieveCheckMany` | Save guard hardBlock ShowLangMessage(1024): من فضلك حدد الحساب الدائن للعمولة | mapped | Port as a blocking validation |
| `frmRecieveCheckMany` | Save guard hardBlock ShowLangMessage(1026): قيمة العمولة يجب أن تكون أصغر من قيمة الورقة | mapped | Port as a blocking validation |
| `frmRecieveCheckMany` | Save guard hardBlock ShowLangMessage(1027): قيمة العمولة يجب أن تكون اكبر من الصفر | mapped | Port as a blocking validation |
| `frmRecieveCheckMany` | Save guard hardBlock ShowLangMessage(1028) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| `frmRecieveCheckMany` | Save guard hardBlock ShowLangMessage(1029) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| `frmRecieveCheckMany` | Save guard hardBlock ShowLangMessage(2119): الحساب يجب أن يحدد له مركز تكلفة | mapped | Port as a blocking validation |
| `frmRecieveCheckMany` | Save guard hardBlock ShowLangMessage(2120): الحساب يجب أن يكون بدون مركز تكلفة | mapped | Port as a blocking validation |
| `frmRecieveCheckMany` | Save guard hardBlock ShowLangMessage(2121): الحساب يجب أن يحدد له مركز تكلفة | mapped | Port as a blocking validation |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `CompanyCode` (ops / other) via Insert Into StoreCheckDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `BranchCode` (ops / other) via Insert Into StoreCheckDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `YearID` (ops / other) via Insert Into StoreCheckDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `StoreCheckCode` (ops / other) via Insert Into StoreCheckDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `ItemCode` (ops / item) via Insert Into StoreCheckDetail | covered | Keep — already on Prisma / Zod / grid. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `Qty` (unit / unitOther) via Insert Into StoreCheckDetail | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `Remarks` (ops / other) via Insert Into StoreCheckDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `ActualQty` (unit / unitOther) via Insert Into StoreCheckDetail | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `ExpDate` (traceability / expiryDate) via Insert Into StoreCheckDetail | covered | Keep — already on Prisma / Zod / grid. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `ExpDateH` (traceability / expiryDateHijri) via Insert Into StoreCheckDetail | missing | Decide whether expiryDateHijri is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `UnitCode` (unit / unitOther) via Insert Into StoreCheckDetail | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `ItemAddQty` (unit / unitOther) via Insert Into StoreCheckDetail | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `ItemRemoveQty` (unit / unitOther) via Insert Into StoreCheckDetail | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `Price` (ops / unitPrice) via Insert Into StoreCheckDetail | covered | Keep — already on Prisma / Zod / grid. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `ItemAddTotalPrice` (ops / other) via Insert Into StoreCheckDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `ItemRemoveTotalPrice` (ops / other) via Insert Into StoreCheckDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `SerialNums` (traceability / serialNumbers) via Insert Into StoreCheckDetail | covered | Keep — already on Prisma / Zod / grid. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `ItemColorSizeCode` (traceability / colorSize) via Insert Into StoreCheckDetail | missing | Decide whether colorSize is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `Type` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `DetailNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Line field `AccountNo` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تسوية جرد مخزني `FrmStoreCheck` | Save guard hardBlock ShowLangMessage(2162): النسخة غير مرخصة لا يمكنك حفظ أكثر من سجل | mapped | Port as a blocking validation |
| تسوية جرد مخزني `FrmStoreCheck` | Save guard hardBlock ShowLangMessage(1629): يجب تحديد تاريخ إذن الجرد المخزني | mapped | Port as a blocking validation |
| تسوية جرد مخزني `FrmStoreCheck` | Save guard hardBlock ShowLangMessage(1630): يجب تحديد المخزن | mapped | Port as a blocking validation |
| تسوية جرد مخزني `FrmStoreCheck` | Save guard hardBlock ShowLangMessage(1631) [GetPeriod]: التاريخ المحدد لا يقع في نفس الفترة المحاسبية | mapped | Port as a blocking validation |
| تسوية جرد مخزني `FrmStoreCheck` | Save guard hardBlock ShowLangMessage(1632) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| تسوية جرد مخزني `FrmStoreCheck` | Save guard hardBlock ShowLangMessage(1633) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| تسوية جرد مخزني `FrmStoreCheck` | Save guard hardBlock ShowLangMessage(1634) [StoreCheck]: يجب إدخال الرمز | mapped | Port as a blocking validation |
| تسوية جرد مخزني `FrmStoreCheck` | Save guard hardBlock ShowLangMessage(1635) [StoreCheck]: هذا الرمز موجود سابقا | mapped | Port as a blocking validation |
| تسوية جرد مخزني `FrmStoreCheck` | Save guard hardBlock ShowLangMessage(1636): لا يوجد أصناف في الجرد المخزني | mapped | Port as a blocking validation |
| تسوية جرد مخزني `FrmStoreCheck` | Save guard hardBlock ShowLangMessage(1637): لا يمكن حفظ الجرد لأن أذونات الإضافة والصرف المخزني لا تطابق الفواتير | mapped | Port as a blocking validation |
| تسوية جرد مخزني `FrmStoreCheck` | Save guard warningOnly ShowLangMessage(1638): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| تسوية جرد مخزني `FrmStoreCheck` | Save_Trace actions: Add@Save, Edit@Save, Delete@Delete, Delete@Other, Post@Other, UnPost@Other, Print@Print | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| صلاحيات الصناديق والبنوك `frmBankBoxRights` | Save guard hardBlock ShowLangMessage(52): من فضلك حدد المستخدم | mapped | Port as a blocking validation |
| صلاحيات الصناديق والبنوك `frmBankBoxRights` | Save guard hardBlock ShowLangMessage(53): من فضلك حدد الشركة | mapped | Port as a blocking validation |
| صلاحيات الصناديق والبنوك `frmBankBoxRights` | Save guard warningOnly ShowLangMessage(54): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| صلاحيات الصناديق والبنوك `frmBankBoxRights` | Save_Trace actions: Edit@Save | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| سداد الضريبة `frmDaribaSadad` | Line field `CompanyCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Line field `BranchCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Line field `YearID` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Line field `CashNum` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Line field `DetailDescA` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Line field `DetailDescE` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Line field `Type` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Line field `DetailNum` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Line field `AccountNo` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Line field `CCenterCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Line field `Amount` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Line field `CurrencyCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Line field `Change` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into CashTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into CashTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Line field `EsharCode` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Line field `Accepted` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سداد الضريبة `frmDaribaSadad` | Save guard hardBlock ShowLangMessage(344): من فضلك حدد الفترة | unmapped | Port as a blocking validation |
| سداد الضريبة `frmDaribaSadad` | Save guard hardBlock ShowLangMessage(345): من فضلك حدد طريقة الدفع | unmapped | Port as a blocking validation |
| سداد الضريبة `frmDaribaSadad` | Save guard hardBlock ShowLangMessage(346): يجب تحديد تاريخ استحقاق الضريبة | unmapped | Port as a blocking validation |
| سداد الضريبة `frmDaribaSadad` | Save guard hardBlock ShowLangMessage(347): لا يمكن عمل استحقاق لفترة قبل انتهاءها | unmapped | Port as a blocking validation |
| سداد الضريبة `frmDaribaSadad` | Save guard hardBlock ShowLangMessage(348): تم عمل استحقاق لهذه الفترة سابقا | unmapped | Port as a blocking validation |
| سداد الضريبة `frmDaribaSadad` | Save guard warningOnly ShowLangMessage(349): الفترة الضريبية السابقة لم تقدم بعد | unmapped | Port as a warning (legacy does not Exit) |
| سداد الضريبة `frmDaribaSadad` | Save guard warningOnly ShowLangMessage(350): يوجد خطأ في حفظ البيانات | unmapped | Port as a warning (legacy does not Exit) |
| سداد الضريبة `frmDaribaSadad` | Save guard hardBlock ShowLangMessage(358) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | unmapped | Port as a blocking validation |
| سداد الضريبة `frmDaribaSadad` | Save guard hardBlock ShowLangMessage(359) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | unmapped | Port as a blocking validation |
| سداد الضريبة `frmDaribaSadad` | Save guard hardBlock ShowLangMessage(360): لا يمكن إنشاء سند الصرف بشكل مباشر لأن الترقيم يدوي | unmapped | Port as a blocking validation |
| سداد الضريبة `frmDaribaSadad` | Save guard hardBlock ShowLangMessage(361): لا يمكن إنشاء السند لعدم القدرة على إنشاء القيد الخاص به | unmapped | Port as a blocking validation |
| سداد الضريبة `frmDaribaSadad` | Save_Trace actions: Add@Save, Edit@Save, Delete@Delete, Browse@Other | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| سداد الضريبة `frmDaribaSadad` | Tax ledgers: daribaSadad | partial | Real tables are Eshar / Dariba* — not DaribaItemDetail / EsharDetail. |
| ورقة دفع `frmPaymentCheck` | Line field `CompanyCode` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `BranchCode` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `YearID` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `PKNum` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `DetailDescA` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `DetailDescE` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `Type` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `AccountNo` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `FromAccountNo` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `FromCCenterCode` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `CurrencyCode` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `Change` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `Amount` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `Name` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `GehaCode` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `EditDate` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `EditDateH` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `TakeDate` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `TakeDateH` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `EditGLNum` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `TakeGLNum` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `TazherGLNum` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `ReturnGLNum` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Line field `IsTake` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة دفع `frmPaymentCheck` | Save guard hardBlock ShowLangMessage(2062): النسخة غير مرخصة لا يمكنك حفظ أكثر من سجل | mapped | Port as a blocking validation |
| ورقة دفع `frmPaymentCheck` | Save guard hardBlock ShowLangMessage(732): يجب تحديد تاريخ تحرير الورقة | mapped | Port as a blocking validation |
| ورقة دفع `frmPaymentCheck` | Save guard hardBlock ShowLangMessage(733): يجب تحديد تاريخ استحقاق الورقة | mapped | Port as a blocking validation |
| ورقة دفع `frmPaymentCheck` | Save guard hardBlock ShowLangMessage(735): من فضلك حدد الحساب المدفوع له | mapped | Port as a blocking validation |
| ورقة دفع `frmPaymentCheck` | Save guard hardBlock ShowLangMessage(736): من فضلك حدد العملة | mapped | Port as a blocking validation |
| ورقة دفع `frmPaymentCheck` | Save guard hardBlock ShowLangMessage(737): من فضلك حدد المبلغ | mapped | Port as a blocking validation |
| ورقة دفع `frmPaymentCheck` | Save guard hardBlock ShowLangMessage(738): المبلغ يجب أن يكون أكبر من الصفر | mapped | Port as a blocking validation |
| ورقة دفع `frmPaymentCheck` | Save guard hardBlock ShowLangMessage(1009) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| ورقة دفع `frmPaymentCheck` | Save guard hardBlock ShowLangMessage(1010) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| ورقة دفع `frmPaymentCheck` | Save guard hardBlock ShowLangMessage(739) [GetPeriod]: التاريخ المحدد لا يقع في نفس الفترة المحاسبية | mapped | Port as a blocking validation |
| ورقة دفع `frmPaymentCheck` | Save guard hardBlock ShowLangMessage(740): التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| ورقة دفع `frmPaymentCheck` | Save guard hardBlock ShowLangMessage(741): التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| ورقة دفع `frmPaymentCheck` | Save_Trace actions: Add@Save, Edit@Save, Delete@Delete, UnTake@Other, Take@Other, UnTazher@Other, Tazher@Other, UnRetun@Other, Return@Other, Post@Post, UnPost@Other, Delete@Other, Print@Print | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `CompanyCode` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `BranchCode` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `YearID` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `PKNum` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `DetailDescA` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `DetailDescE` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `Type` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `AccountNo` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `FromAccountNo` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `FromCCenterCode` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `CurrencyCode` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `Change` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `Amount` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `Name` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `GehaCode` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `EditDate` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `EditDateH` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `TakeDate` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `TakeDateH` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `EditGLNum` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `TakeGLNum` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `TazherGLNum` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `ReturnGLNum` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Line field `IsTake` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Save guard hardBlock ShowLangMessage(794): يجب تحديد تاريخ تحرير الورقة | unmapped | Port as a blocking validation |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Save guard hardBlock ShowLangMessage(795): من فضلك حدد الحساب المدفوع له | unmapped | Port as a blocking validation |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Save guard hardBlock ShowLangMessage(796): من فضلك حدد العملة | unmapped | Port as a blocking validation |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Save guard hardBlock ShowLangMessage(797) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | unmapped | Port as a blocking validation |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Save guard hardBlock ShowLangMessage(798) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | unmapped | Port as a blocking validation |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Save guard hardBlock ShowLangMessage(2074): الحساب يجب أن يحدد له مركز تكلفة | unmapped | Port as a blocking validation |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Save guard hardBlock ShowLangMessage(2075): الحساب يجب أن يكون بدون مركز تكلفة | unmapped | Port as a blocking validation |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Save guard hardBlock ShowLangMessage(2258): رقم الشيك مكرر | unmapped | Port as a blocking validation |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Save guard hardBlock ShowLangMessage(2259): من فضلك حدد المبلغ | unmapped | Port as a blocking validation |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Save guard hardBlock ShowLangMessage(2260): المبلغ يجب أن يكون أكبر من الصفر | unmapped | Port as a blocking validation |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Save guard hardBlock ShowLangMessage(2261): يجب ادخال رقم الورقة | unmapped | Port as a blocking validation |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Save guard warningOnly ShowLangMessage(2262): يجب تحديد تاريخ استحقاق الورقة | unmapped | Port as a warning (legacy does not Exit) |
| أوراق دفع مجمعة `frmPaymentCheckAll` | Save_Trace actions: Add@Save | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| ورقة قبض `frmRecieveCheck` | Line field `CompanyCode` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `BranchCode` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `YearID` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `CKNum` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `DetailDescA` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `DetailDescE` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `Type` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `AccountNo` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `FromAccountNo` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `FromCCenterCode` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `CurrencyCode` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `Change` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `Amount` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `Name` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `GehaCode` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `EditDate` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `EditDateH` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `TakeDate` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `TakeDateH` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `EditGLNum` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `TakeGLNum` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `TazherGLNum` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `ReturnGLNum` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Line field `IsTake` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| ورقة قبض `frmRecieveCheck` | Save guard hardBlock ShowLangMessage(2115): النسخة غير مرخصة لا يمكنك حفظ أكثر من سجل | mapped | Port as a blocking validation |
| ورقة قبض `frmRecieveCheck` | Save guard hardBlock ShowLangMessage(1001): يجب تحديد تاريخ تحرير الورقة | mapped | Port as a blocking validation |
| ورقة قبض `frmRecieveCheck` | Save guard hardBlock ShowLangMessage(1002): يجب تحديد تاريخ استحقاق الورقة | mapped | Port as a blocking validation |
| ورقة قبض `frmRecieveCheck` | Save guard hardBlock ShowLangMessage(1004): من فضلك حدد الحساب المقبوض منه | mapped | Port as a blocking validation |
| ورقة قبض `frmRecieveCheck` | Save guard hardBlock ShowLangMessage(1005): من فضلك حدد العملة | mapped | Port as a blocking validation |
| ورقة قبض `frmRecieveCheck` | Save guard hardBlock ShowLangMessage(1006): من فضلك حدد المبلغ | mapped | Port as a blocking validation |
| ورقة قبض `frmRecieveCheck` | Save guard hardBlock ShowLangMessage(1007): المبلغ يجب أن يكون أكبر من الصفر | mapped | Port as a blocking validation |
| ورقة قبض `frmRecieveCheck` | Save guard hardBlock ShowLangMessage(1009) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| ورقة قبض `frmRecieveCheck` | Save guard hardBlock ShowLangMessage(1010) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| ورقة قبض `frmRecieveCheck` | Save guard hardBlock ShowLangMessage(1008) [GetPeriod]: التاريخ المحدد لا يقع في نفس الفترة المحاسبية | mapped | Port as a blocking validation |
| ورقة قبض `frmRecieveCheck` | Save guard hardBlock ShowLangMessage(1009): التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| ورقة قبض `frmRecieveCheck` | Save guard hardBlock ShowLangMessage(1010): التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| ورقة قبض `frmRecieveCheck` | Save_Trace actions: Add@Save, Edit@Save, Delete@Delete, UnTake@Other, Take@Other, UnTazher@Other, Tazher@Other, UnRetun@Other, Return@Other, Post@Post, UnPost@Other, Delete@Other, Print@Print | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `CompanyCode` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `BranchCode` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `YearID` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `CKNum` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `DetailDescA` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `DetailDescE` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `Type` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `AccountNo` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `FromAccountNo` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `FromCCenterCode` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `CurrencyCode` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `Change` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `Amount` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `Name` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `GehaCode` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `EditDate` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `EditDateH` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `TakeDate` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `TakeDateH` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `EditGLNum` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `TakeGLNum` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `TazherGLNum` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `ReturnGLNum` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Line field `IsTake` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Save guard hardBlock ShowLangMessage(1060): يجب تحديد تاريخ تحرير الورقة | unmapped | Port as a blocking validation |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Save guard hardBlock ShowLangMessage(1061): من فضلك حدد الحساب المدفوع له | unmapped | Port as a blocking validation |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Save guard hardBlock ShowLangMessage(1062): من فضلك حدد العملة | unmapped | Port as a blocking validation |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Save guard hardBlock ShowLangMessage(1063) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | unmapped | Port as a blocking validation |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Save guard hardBlock ShowLangMessage(1064) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | unmapped | Port as a blocking validation |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Save guard hardBlock ShowLangMessage(2127): الحساب يجب أن يحدد له مركز تكلفة | unmapped | Port as a blocking validation |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Save guard hardBlock ShowLangMessage(2128): الحساب يجب أن يكون بدون مركز تكلفة | unmapped | Port as a blocking validation |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Save guard hardBlock ShowLangMessage(2298): رقم الشيك مكرر | unmapped | Port as a blocking validation |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Save guard hardBlock ShowLangMessage(2299): من فضلك حدد المبلغ | unmapped | Port as a blocking validation |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Save guard hardBlock ShowLangMessage(2300): المبلغ يجب أن يكون أكبر من الصفر | unmapped | Port as a blocking validation |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Save guard hardBlock ShowLangMessage(2301): يجب ادخال رقم الورقة | unmapped | Port as a blocking validation |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Save guard hardBlock ShowLangMessage(2302): يجب تحديد تاريخ استحقاق الورقة | unmapped | Port as a blocking validation |
| أوراق قبض مجمعة `frmRecieveCheckAll` | Save_Trace actions: Add@Save | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| `untSchoolPayment` | Save guard hardBlock ShowLangMessage(1290): من فضلك حدد السنة الدراسية | unmapped | Port as a blocking validation |
| `untSchoolPayment` | Save guard hardBlock ShowLangMessage(1291): من فضلك حدد السنة | unmapped | Port as a blocking validation |
| `untSchoolPayment` | Save guard hardBlock ShowLangMessage(1292): حدد بيانات التعليم للمنقول | unmapped | Port as a blocking validation |
| `untSchoolPayment` | Save guard hardBlock ShowLangMessage(1293): حدد بيانات التعليم للجديد | unmapped | Port as a blocking validation |
| `untSchoolPayment` | Save guard hardBlock ShowLangMessage(1294): حدد بيانات التعليم للمستمع | unmapped | Port as a blocking validation |
| `untSchoolPayment` | Save guard hardBlock ShowLangMessage(1295): حدد قيمة الكتب | unmapped | Port as a blocking validation |
| `untSchoolPayment` | Save guard hardBlock ShowLangMessage(1296): من فضلك حدد شرح المصاريف الأخرى | unmapped | Port as a blocking validation |
| `untSchoolPayment` | Save guard hardBlock ShowLangMessage(1297): هذه المرحلة والسنة تم تعريف المصروفات الدراسية لهم من قبل | unmapped | Port as a blocking validation |
| `untSchoolPayment` | Save guard hardBlock ShowLangMessage(1298): كود المصروفات الدراسية موجود من قبل | unmapped | Port as a blocking validation |
| `untSchoolPayment` | Save guard warningOnly ShowLangMessage(1299): يوجد خطأ في حفظ البيانات | unmapped | Port as a warning (legacy does not Exit) |
| `untSchoolPayment` | Save_Trace actions: Add@Save, Edit@Save, Delete@Delete, Browse@Other | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| `untSchoolPersonOut` | Line field `CompanyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `BranchCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `YearID` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `Type` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `DetailNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `AccountNo` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `CCenterCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `CurrencyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `Change` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `EsharCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `Accepted` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `CashNum` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `Amount` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `CKNum` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `FromAccountNo` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `FromCCenterCode` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Line field `Name` (ops / other) via Insert Into PKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonOut` | Save guard hardBlock ShowLangMessage(1339): حدد اسم الطالب | unmapped | Port as a blocking validation |
| `untSchoolPersonOut` | Save guard hardBlock ShowLangMessage(1340): حدد تاريخ الاسترداد | unmapped | Port as a blocking validation |
| `untSchoolPersonOut` | Save guard hardBlock ShowLangMessage(1341): الإجمالي لا يساوي قيمة المسترد | unmapped | Port as a blocking validation |
| `untSchoolPersonOut` | Save guard hardBlock ShowLangMessage(1342): المسدد أقل من قيمة القسط | unmapped | Port as a blocking validation |
| `untSchoolPersonOut` | Save guard hardBlock ShowLangMessage(1343): قيمة المدفوع يجب أن تكون أكبر من صفر | unmapped | Port as a blocking validation |
| `untSchoolPersonOut` | Save guard hardBlock ShowLangMessage(1344) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | unmapped | Port as a blocking validation |
| `untSchoolPersonOut` | Save guard hardBlock ShowLangMessage(1345) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | unmapped | Port as a blocking validation |
| `untSchoolPersonOut` | Save guard hardBlock ShowLangMessage(1346): لا يمكن انشاء السند | unmapped | Port as a blocking validation |
| `untSchoolPersonOut` | Save guard warningOnly ShowLangMessage(1347): يوجد خطأ في حفظ البيانات | unmapped | Port as a warning (legacy does not Exit) |
| `untSchoolPersonOut` | Save guard hardBlock ShowLangMessage(1353): لا يمكن إنشاء سند قبض نقدية لعدم تعريف صندوق افتراضي للنمط الأساسي لسندات قبض ال | unmapped | Port as a blocking validation |
| `untSchoolPersonOut` | Save guard hardBlock ShowLangMessage(1354): لا يمكن انشاء سند إضافة بنكي لعدم تعريف بنك افتراضي للنمط الأساسي لسندات الإضافة | unmapped | Port as a blocking validation |
| `untSchoolPersonOut` | Save guard hardBlock ShowLangMessage(1355): الترقيم السندات يدوي لذلك يجب تحديد الرقم في خانة المصدر | unmapped | Port as a blocking validation |
| `untSchoolPersonOut` | Save_Trace actions: Add@Save, Edit@Save, Delete@Delete, Browse@Other | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| `untSchoolPersonPayment` | Line field `CompanyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `BranchCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `YearID` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `Type` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `DetailNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `AccountNo` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `CCenterCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `CurrencyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `Change` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `EsharCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `Accepted` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `CashNum` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `Amount` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `CKNum` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `FromAccountNo` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `FromCCenterCode` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Line field `Name` (ops / other) via Insert Into CKTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolPersonPayment` | Save guard hardBlock ShowLangMessage(1359): حدد اسم الطالب | unmapped | Port as a blocking validation |
| `untSchoolPersonPayment` | Save guard hardBlock ShowLangMessage(1360): ادخل اسم المحصل | unmapped | Port as a blocking validation |
| `untSchoolPersonPayment` | Save guard hardBlock ShowLangMessage(1361): حدد تاريخ التسديد | unmapped | Port as a blocking validation |
| `untSchoolPersonPayment` | Save guard hardBlock ShowLangMessage(1362): الإجمالي لا يساوي قيمة المدفوع | unmapped | Port as a blocking validation |
| `untSchoolPersonPayment` | Save guard hardBlock ShowLangMessage(1363): المدفوع أقل من قيمة القسط | unmapped | Port as a blocking validation |
| `untSchoolPersonPayment` | Save guard hardBlock ShowLangMessage(1364): قيمة المدفوع يجب أن تكون أكبر من صفر | unmapped | Port as a blocking validation |
| `untSchoolPersonPayment` | Save guard hardBlock ShowLangMessage(1365): السنة السابقة لم تسدد بالكامل بعد | unmapped | Port as a blocking validation |
| `untSchoolPersonPayment` | Save guard hardBlock ShowLangMessage(1366): هذا المحصل تم حذفه | unmapped | Port as a blocking validation |
| `untSchoolPersonPayment` | Save guard hardBlock ShowLangMessage(1367): ادخل رقم السند | unmapped | Port as a blocking validation |
| `untSchoolPersonPayment` | Save guard hardBlock ShowLangMessage(1368): رقم ايصال التعليم موجود من قبل | unmapped | Port as a blocking validation |
| `untSchoolPersonPayment` | Save guard hardBlock ShowLangMessage(1369): رقم ايصال الكتب موجود من قبل | unmapped | Port as a blocking validation |
| `untSchoolPersonPayment` | Save guard hardBlock ShowLangMessage(1370): رقم ايصال النشاط موجود من قبل | unmapped | Port as a blocking validation |
| `untSchoolPersonPayment` | Save_Trace actions: Add@Save, Edit@Save, Delete@Delete, Browse@Other, Print@Print | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| `untSchoolStart` | Line field `CompanyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `BranchCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `YearID` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `Type` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `DetailNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `AccountNo` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `CCenterCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `CurrencyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `Change` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `EsharCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `Accepted` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `Audit` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `CashNum` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Line field `Amount` (ops / other) via Insert Into CashTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `untSchoolStart` | Save guard hardBlock ShowLangMessage(2354): يوجد تكرار في أسماء الطلاب | unmapped | Port as a blocking validation |
| `untSchoolStart` | Save guard hardBlock ShowLangMessage(1424): يجب تحديد طالب واحد على الأقل | unmapped | Port as a blocking validation |
| `untSchoolStart` | Save guard hardBlock ShowLangMessage(1425): لا يمكن انشاء قيد للطالب | unmapped | Port as a blocking validation |
| `untSchoolStart` | Save guard hardBlock ShowLangMessage(1426): لا يمكن انشاء سند للطالب | unmapped | Port as a blocking validation |
| `untSchoolStart` | Save guard warningOnly ShowLangMessage(1427): يوجد خطأ في حفظ البيانات | unmapped | Port as a warning (legacy does not Exit) |
| `untSchoolStart` | Save guard hardBlock ShowLangMessage(1433) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | unmapped | Port as a blocking validation |
| `untSchoolStart` | Save guard hardBlock ShowLangMessage(1434) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | unmapped | Port as a blocking validation |
| `untSchoolStart` | Save guard hardBlock ShowLangMessage(1435): لا يمكن إنشاء سند قبض نقدية لعدم تعريف صندوق افتراضي للنمط الأساسي لسندات قبض ال | unmapped | Port as a blocking validation |
| `untSchoolStart` | Save guard hardBlock ShowLangMessage(1436) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | unmapped | Port as a blocking validation |
| `untSchoolStart` | Save guard hardBlock ShowLangMessage(1437) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | unmapped | Port as a blocking validation |
| `untSchoolStart` | Save guard hardBlock ShowLangMessage(1438): الترقيم السندات يدوي لذلك يجب تحديد الرقم في خانة المصدر | unmapped | Port as a blocking validation |
| `untSchoolStart` | Save_Trace actions: Add@Save, Edit@Save, Delete@Delete, Browse@Other | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| إيصال مؤقت `frmTempPayment` | Save guard hardBlock ShowLangMessage(2179): النسخة غير مرخصة لا يمكنك حفظ أكثر من سجل | unmapped | Port as a blocking validation |
| إيصال مؤقت `frmTempPayment` | Save guard hardBlock ShowLangMessage(1879): يجب تحديد الصندوق | unmapped | Port as a blocking validation |
| إيصال مؤقت `frmTempPayment` | Save guard hardBlock ShowLangMessage(1880): يجب تحديد تاريخ السند | unmapped | Port as a blocking validation |
| إيصال مؤقت `frmTempPayment` | Save guard hardBlock ShowLangMessage(1881): يجب تحديد المبلغ | unmapped | Port as a blocking validation |
| إيصال مؤقت `frmTempPayment` | Save guard hardBlock ShowLangMessage(1882): يجب تحديد المستلم | unmapped | Port as a blocking validation |
| إيصال مؤقت `frmTempPayment` | Save guard hardBlock ShowLangMessage(1883) [GetPeriod]: التاريخ المحدد لا يقع في نفس الفترة المحاسبية | unmapped | Port as a blocking validation |
| إيصال مؤقت `frmTempPayment` | Save guard hardBlock ShowLangMessage(1884) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | unmapped | Port as a blocking validation |
| إيصال مؤقت `frmTempPayment` | Save guard hardBlock ShowLangMessage(1885) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | unmapped | Port as a blocking validation |
| إيصال مؤقت `frmTempPayment` | Save guard hardBlock ShowLangMessage(1886): يجب إدخال الرمز | unmapped | Port as a blocking validation |
| إيصال مؤقت `frmTempPayment` | Save guard hardBlock ShowLangMessage(1887): هذا الرمز موجود سابقا | unmapped | Port as a blocking validation |
| إيصال مؤقت `frmTempPayment` | Save guard warningOnly ShowLangMessage(1888): يوجد خطأ في حفظ البيانات | unmapped | Port as a warning (legacy does not Exit) |
| إيصال مؤقت `frmTempPayment` | Save_Trace actions: Add@Save, Edit@Save, Delete@Delete, Browse@Other, Print@Print | missing | Trace is user/screen/action/record only — no IP, no old/new. |

## Contracting & Subcontractors

| Screen | Legacy Business Rule / Line Field | Web/Backend Status | Action Required |
|---|---|---|---|
| إعدادات `FrmAbsSettings` | Save guard warningOnly ShowLangMessage(1030): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| إدارة مشروع `FrmAbstractsProjects` | Line field `CompanyCode` (ops / other) via Insert Into AbsProjectD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `BranchCode` (ops / other) via Insert Into AbsProjectD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `ProjectCode` (ops / other) via Insert Into AbsProjectD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `GroupNum` (ops / other) via Insert Into AbsProjectD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `SampleNum` (ops / other) via Insert Into AbsProjectD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `UnitNum` (unit / unitOther) via Insert Into AbsProjectD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `SourceNum` (ops / other) via Insert Into AbsProjectD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `ItemCode` (ops / item) via Insert Into AbsProjectD2 | covered | Keep — already on Prisma / Zod / grid. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `ItemNameA` (ops / other) via Insert Into AbsProjectD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `ItemNameE` (ops / other) via Insert Into AbsProjectD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `TotalQty` (unit / unitOther) via Insert Into AbsProjectD2 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `TotalValue` (ops / lineTotal) via Insert Into AbsProjectD2 | covered | Keep — already on Prisma / Zod / grid. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `TotalBudget` (ops / other) via Insert Into AbsProjectD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `GeneralItemCode` (ops / other) via Insert Into AbsProjectD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `ItemDetailCode` (ops / other) via Insert Into AbsProjectD3 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `ItemDetailNameA` (ops / other) via Insert Into AbsProjectD3 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `ItemDetailNameE` (ops / other) via Insert Into AbsProjectD3 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `ItemDetailUnit` (unit / unitOther) via Insert Into AbsProjectD3 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `ItemDetailQty` (unit / unitOther) via Insert Into AbsProjectD3 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `ItemDetailPrice` (ops / other) via Insert Into AbsProjectD3 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `ItemDetailTotal` (ops / other) via Insert Into AbsProjectD3 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `ItemDetailBudgetQty` (unit / unitOther) via Insert Into AbsProjectD3 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `ItemDetailBudgetValue` (ops / other) via Insert Into AbsProjectD3 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Line field `ItemDetailType` (ops / other) via Insert Into AbsProjectD3 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| إدارة مشروع `FrmAbstractsProjects` | Save guard hardBlock ShowLangMessage(1480): من فضلك ادخل الاسم العربي | mapped | Port as a blocking validation |
| إدارة مشروع `FrmAbstractsProjects` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| إدارة مشروع `FrmAbstractsProjects` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| إدارة مشروع `FrmAbstractsProjects` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| إدارة مشروع `FrmAbstractsProjects` | Save_Trace actions: ScreenMode@Save, Update@Other, Delete@Delete, ScreenMode4@Save | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| `FrmContractor` | Save guard hardBlock ShowLangMessage(1480): من فضلك ادخل الاسم العربي | unmapped | Port as a blocking validation |
| `FrmContractor` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | unmapped | Port as a warning (legacy does not Exit) |
| `FrmContractor` | Save_Trace actions: ScreenMode@Save, Delete@Delete | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| سركي العمال `FrmContractorDaily` | Line field `CompanyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سركي العمال `FrmContractorDaily` | Line field `BranchCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سركي العمال `FrmContractorDaily` | Line field `YearID` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سركي العمال `FrmContractorDaily` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سركي العمال `FrmContractorDaily` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سركي العمال `FrmContractorDaily` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سركي العمال `FrmContractorDaily` | Line field `Type` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سركي العمال `FrmContractorDaily` | Line field `DetailNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سركي العمال `FrmContractorDaily` | Line field `AccountNo` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سركي العمال `FrmContractorDaily` | Line field `CCenterCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سركي العمال `FrmContractorDaily` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سركي العمال `FrmContractorDaily` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سركي العمال `FrmContractorDaily` | Line field `CurrencyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سركي العمال `FrmContractorDaily` | Line field `Change` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سركي العمال `FrmContractorDaily` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| سركي العمال `FrmContractorDaily` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| سركي العمال `FrmContractorDaily` | Line field `EsharCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سركي العمال `FrmContractorDaily` | Line field `Accepted` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سركي العمال `FrmContractorDaily` | Line field `Audit` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| سركي العمال `FrmContractorDaily` | Save guard hardBlock ShowLangMessage(79) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| سركي العمال `FrmContractorDaily` | Save guard hardBlock ShowLangMessage(80) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| سركي العمال `FrmContractorDaily` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| سركي العمال `FrmContractorDaily` | Save_Trace actions: Delete@Delete | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| `FrmContractorStatement` | Line field `CompanyCode` (ops / other) via Insert Into ContractorsStatementsD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `BranchCode` (ops / other) via Insert Into ContractorsStatementsD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `ContractorStatementCode` (ops / other) via Insert Into ContractorsStatementsD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `ProjectCode` (ops / other) via Insert Into ContractorsStatementsD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `UnitNum` (unit / unitOther) via Insert Into ContractorsStatementsD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `SampleNum` (ops / other) via Insert Into ContractorsStatementsD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `GroupNum` (ops / other) via Insert Into ContractorsStatementsD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `ItemCode` (ops / item) via Insert Into ContractorsStatementsD1 | covered | Keep — already on Prisma / Zod / grid. |
| `FrmContractorStatement` | Line field `ItemDetailCode` (ops / other) via Insert Into ContractorsStatementsD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `ItemDetailUnit` (unit / unitOther) via Insert Into ContractorsStatementsD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `AssignedQty` (unit / unitOther) via Insert Into ContractorsStatementsD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `PrevQty` (unit / unitOther) via Insert Into ContractorsStatementsD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `CurrentQty` (unit / unitOther) via Insert Into ContractorsStatementsD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `TotalQty` (unit / unitOther) via Insert Into ContractorsStatementsD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `Price` (ops / unitPrice) via Insert Into ContractorsStatementsD1 | covered | Keep — already on Prisma / Zod / grid. |
| `FrmContractorStatement` | Line field `PricePercent` (ops / other) via Insert Into ContractorsStatementsD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `DonePercent` (ops / other) via Insert Into ContractorsStatementsD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `TotalValue` (ops / lineTotal) via Insert Into ContractorsStatementsD1 | covered | Keep — already on Prisma / Zod / grid. |
| `FrmContractorStatement` | Line field `PrevQtyPercent` (unit / unitOther) via Insert Into ContractorsStatementsD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `CurrentQtyPercent` (unit / unitOther) via Insert Into ContractorsStatementsD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `TotalQtyPercent` (unit / unitOther) via Insert Into ContractorsStatementsD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `ItemDetailType` (ops / other) via Insert Into ContractorsStatementsD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `PrevPricePercent` (ops / other) via Insert Into ContractorsStatementsD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Line field `AdditionalDesc` (ops / other) via Insert Into ContractorsStatementsD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmContractorStatement` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| `FrmContractorStatement` | Save_Trace actions: Delete@Delete | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| `FrmImportContractors` | Save guard warningOnly ShowLangMessage(1480): من فضلك ادخل الاسم العربي | unmapped | Port as a warning (legacy does not Exit) |
| `FrmImportContractors` | Save guard warningOnly ShowLangMessage(1480): من فضلك ادخل الاسم العربي | unmapped | Port as a warning (legacy does not Exit) |
| `FrmImportContractors` | Save_Trace actions: ScreenMode@Save | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| إعداد حسابات قائمة الدخل `frmIncomeStatement` | Save guard warningOnly ShowLangMessage(30): تم الحفظ بنجاح | unmapped | Port as a warning (legacy does not Exit) |
| إعداد حسابات قائمة الدخل `frmIncomeStatement` | Save guard warningOnly ShowLangMessage(208): يوجد خطأ في حفظ البيانات | unmapped | Port as a warning (legacy does not Exit) |
| قائمة الدخل `FrmIncomeStatementDisplay` | Save guard hardBlock ShowLangMessage(693): ليس لك صلاحية الدخول على هذه الشاشة | unmapped | Port as a blocking validation |
| قائمة الدخل `FrmIncomeStatementDisplay` | Save_Trace actions: Print@Other, Print@Print | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| بيانات المشروعات `FrmProject` | Line field `CompanyCode` (ops / other) via Insert Into ProjectD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `BranchCode` (ops / other) via Insert Into ProjectD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `YearID` (ops / other) via Insert Into ProjectD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `ProjectCode` (ops / other) via Insert Into ProjectD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `PartenerAccountCode` (ops / other) via Insert Into ProjectD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `PayPercent` (ops / other) via Insert Into ProjectD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `PayValue` (ops / other) via Insert Into ProjectD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `DepartmentNum` (ops / other) via Insert Into ProjectD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `DepartmentArea` (ops / other) via Insert Into ProjectD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `FloorNum` (ops / other) via Insert Into ProjectD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `Description` (ops / other) via Insert Into ProjectD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `UnitStatus` (unit / unitOther) via Insert Into ProjectD2 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `UnitCost` (unit / unitOther) via Insert Into ProjectD2 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `Type` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `DetailNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `AccountNo` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `CCenterCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `CurrencyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Line field `Change` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بيانات المشروعات `FrmProject` | Save guard hardBlock ShowLangMessage(1480): من فضلك ادخل الاسم العربي | mapped | Port as a blocking validation |
| بيانات المشروعات `FrmProject` | Save guard hardBlock ShowLangMessage(79) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| بيانات المشروعات `FrmProject` | Save guard hardBlock ShowLangMessage(80) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| بيانات المشروعات `FrmProject` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| بيانات المشروعات `FrmProject` | Save_Trace actions: ScreenMode@Save, Delete@Delete | partial | Trace is user/screen/action/record only — no IP, no old/new. |

## Manufacturing & Assembly

| Screen | Legacy Business Rule / Line Field | Web/Backend Status | Action Required |
|---|---|---|---|
| نموذج التصنيع `FrmManufDesc` | Line field `CompanyCode` (ops / other) via Insert Into ManufactWayD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نموذج التصنيع `FrmManufDesc` | Line field `BranchCode` (ops / other) via Insert Into ManufactWayD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نموذج التصنيع `FrmManufDesc` | Line field `ManufactWayCode` (ops / other) via Insert Into ManufactWayD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نموذج التصنيع `FrmManufDesc` | Line field `ItemCode` (ops / item) via Insert Into ManufactWayD1 | covered | Keep — already on Prisma / Zod / grid. |
| نموذج التصنيع `FrmManufDesc` | Line field `Qty` (unit / unitOther) via Insert Into ManufactWayD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| نموذج التصنيع `FrmManufDesc` | Line field `UnitCode` (unit / unitOther) via Insert Into ManufactWayD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| نموذج التصنيع `FrmManufDesc` | Line field `Price` (ops / unitPrice) via Insert Into ManufactWayD1 | covered | Keep — already on Prisma / Zod / grid. |
| نموذج التصنيع `FrmManufDesc` | Line field `TotalPrice` (ops / other) via Insert Into ManufactWayD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نموذج التصنيع `FrmManufDesc` | Line field `CostPercent` (ops / other) via Insert Into ManufactWayD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نموذج التصنيع `FrmManufDesc` | Line field `AccountCode` (ops / other) via Insert Into ManufactWayD3 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نموذج التصنيع `FrmManufDesc` | Line field `Value` (ops / other) via Insert Into ManufactWayD3 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نموذج التصنيع `FrmManufDesc` | Line field `ValuePercent` (ops / other) via Insert Into ManufactWayD3 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نموذج التصنيع `FrmManufDesc` | Line field `Explain` (traceability / traceOther) via Insert Into ManufactWayD3 | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| نموذج التصنيع `FrmManufDesc` | Line field `CCenterCode` (ops / other) via Insert Into ManufactWayD3 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نموذج التصنيع `FrmManufDesc` | Save guard hardBlock ShowLangMessage(2048): النسخة غير مرخصة لا يمكنك حفظ أكثر من سجل | unmapped | Port as a blocking validation |
| نموذج التصنيع `FrmManufDesc` | Save guard hardBlock ShowLangMessage(645): يجب تحديد اسم النموذج | unmapped | Port as a blocking validation |
| نموذج التصنيع `FrmManufDesc` | Save guard hardBlock ShowLangMessage(646): يجب تحديد اسم المرحلة | unmapped | Port as a blocking validation |
| نموذج التصنيع `FrmManufDesc` | Save guard hardBlock ShowLangMessage(647): يجب تحديد مخزن النموذج | unmapped | Port as a blocking validation |
| نموذج التصنيع `FrmManufDesc` | Save guard hardBlock ShowLangMessage(2049) [CCType]: حساب المخزون يجب أن يحدد له مركز تكلفة | unmapped | Port as a blocking validation |
| نموذج التصنيع `FrmManufDesc` | Save guard warningOnly ShowLangMessage(2050) [CCType]: حساب المخزون يجب أن يكون بدون مركز تكلفة | unmapped | Port as a warning (legacy does not Exit) |
| نموذج التصنيع `FrmManufDesc` | Save guard hardBlock ShowLangMessage(2050) [CCType]: حساب المخزون يجب أن يكون بدون مركز تكلفة | unmapped | Port as a blocking validation |
| نموذج التصنيع `FrmManufDesc` | Save guard hardBlock ShowLangMessage(2241): يوجد تكرار في الأصناف الناتجة للصنف | unmapped | Port as a blocking validation |
| نموذج التصنيع `FrmManufDesc` | Save guard hardBlock ShowLangMessage(2242): يوجد تكرار في الأصناف الأولية للصنف | unmapped | Port as a blocking validation |
| نموذج التصنيع `FrmManufDesc` | Save guard hardBlock ShowLangMessage(2243): حدد السعر للصنف | unmapped | Port as a blocking validation |
| نموذج التصنيع `FrmManufDesc` | Save guard hardBlock ShowLangMessage(2244): حدد السعر للصنف | unmapped | Port as a blocking validation |
| نموذج التصنيع `FrmManufDesc` | Save guard hardBlock ShowLangMessage(2245): حدد القيمة للحساب | unmapped | Port as a blocking validation |
| نموذج التصنيع `FrmManufDesc` | Save_Trace actions: Add@Save, Edit@Save, Delete@Delete, Print@Print | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| مراحل التصنيع `FrmManufLevels` | Save guard hardBlock ShowLangMessage(2053): النسخة غير مرخصة لا يمكنك حفظ أكثر من سجل | mapped | Port as a blocking validation |
| مراحل التصنيع `FrmManufLevels` | Save guard hardBlock ShowLangMessage(656): يجب تحديد اسم للنموذج | mapped | Port as a blocking validation |
| مراحل التصنيع `FrmManufLevels` | Save guard hardBlock ShowLangMessage(656): يجب تحديد اسم للنموذج | mapped | Port as a blocking validation |
| مراحل التصنيع `FrmManufLevels` | Save guard hardBlock ShowLangMessage(2246): اسم المرحلة مكرر | mapped | Port as a blocking validation |
| مراحل التصنيع `FrmManufLevels` | Save guard hardBlock ShowLangMessage(657): يجب إدخال مراحل تصنيع النموذج | mapped | Port as a blocking validation |
| مراحل التصنيع `FrmManufLevels` | Save guard warningOnly ShowLangMessage(658): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| مراحل التصنيع `FrmManufLevels` | Save_Trace actions: Add@Save, Edit@Save, Delete@Delete | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| خطة التصنيع `FrmManufPlan` | Save guard hardBlock ShowLangMessage(2054): النسخة غير مرخصة لا يمكنك حفظ أكثر من سجل | mapped | Port as a blocking validation |
| خطة التصنيع `FrmManufPlan` | Save guard hardBlock ShowLangMessage(2247): حدد الكمية للنموذج بتاريخ | mapped | Port as a blocking validation |
| خطة التصنيع `FrmManufPlan` | Save guard hardBlock ShowLangMessage(2055) [CCType]: الحساب يجب أن يحدد له مركز تكلفة | mapped | Port as a blocking validation |
| خطة التصنيع `FrmManufPlan` | Save guard hardBlock ShowLangMessage(2055): الحساب يجب أن يحدد له مركز تكلفة | mapped | Port as a blocking validation |
| خطة التصنيع `FrmManufPlan` | Save guard warningOnly ShowLangMessage(2056) [CCType]: الحساب يجب أن يكون بدون مركز تكلفة | mapped | Port as a warning (legacy does not Exit) |
| خطة التصنيع `FrmManufPlan` | Save guard hardBlock ShowLangMessage(2056) [CCType]: الحساب يجب أن يكون بدون مركز تكلفة | mapped | Port as a blocking validation |
| خطة التصنيع `FrmManufPlan` | Save guard hardBlock ShowLangMessage(662): يجب ادخال نموذج واحد على القل في خطة التصنيع | mapped | Port as a blocking validation |
| خطة التصنيع `FrmManufPlan` | Save guard warningOnly ShowLangMessage(663): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| خطة التصنيع `FrmManufPlan` | Save_Trace actions: Add@Save, Edit@Save, Delete@Delete | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| عملية التصنيع `FrmManufProc` | Line field `CompanyCode` (ops / other) via Insert Into ManufactProcessD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `BranchCode` (ops / other) via Insert Into ManufactProcessD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `ManufactProcessCode` (ops / other) via Insert Into ManufactProcessD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `ItemCode` (ops / item) via Insert Into ManufactProcessD1 | covered | Keep — already on Prisma / Zod / grid. |
| عملية التصنيع `FrmManufProc` | Line field `Qty` (unit / unitOther) via Insert Into ManufactProcessD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `UnitCode` (unit / unitOther) via Insert Into ManufactProcessD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `Price` (ops / unitPrice) via Insert Into ManufactProcessD1 | covered | Keep — already on Prisma / Zod / grid. |
| عملية التصنيع `FrmManufProc` | Line field `TotalPrice` (ops / other) via Insert Into ManufactProcessD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `CostPercent` (ops / other) via Insert Into ManufactProcessD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `OrgQty` (unit / unitOther) via Insert Into ManufactProcessD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `OrgPrice` (ops / other) via Insert Into ManufactProcessD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `OrgTotalPrice` (ops / other) via Insert Into ManufactProcessD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `OrgItemCode` (ops / other) via Insert Into ManufactProcessD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `YearId` (ops / other) via Insert Into ManufactProcessD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `Type` (ops / other) via Insert Into ManufactProcessD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `MainQty` (unit / unitOther) via Insert Into ManufactProcessD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `MainUnitCode` (unit / unitOther) via Insert Into ManufactProcessD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `MainChange` (ops / other) via Insert Into ManufactProcessD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `AccountCode` (ops / other) via Insert Into ManufactProcessD3 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `Value` (ops / other) via Insert Into ManufactProcessD3 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `ValuePercent` (ops / other) via Insert Into ManufactProcessD3 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `Explain` (traceability / traceOther) via Insert Into ManufactProcessD3 | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `CCenterCode` (ops / other) via Insert Into ManufactProcessD3 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Line field `OrgValue` (ops / other) via Insert Into ManufactProcessD3 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| عملية التصنيع `FrmManufProc` | Save guard hardBlock ShowLangMessage(2057): النسخة غير مرخصة لا يمكنك حفظ أكثر من سجل | mapped | Port as a blocking validation |
| عملية التصنيع `FrmManufProc` | Save guard hardBlock ShowLangMessage(665): يجب تحديد اسم النموذج | mapped | Port as a blocking validation |
| عملية التصنيع `FrmManufProc` | Save guard hardBlock ShowLangMessage(666): يجب تحديد اسم المرحلة | mapped | Port as a blocking validation |
| عملية التصنيع `FrmManufProc` | Save guard hardBlock ShowLangMessage(667): يجب تحديد مخزن النموذج | mapped | Port as a blocking validation |
| عملية التصنيع `FrmManufProc` | Save guard hardBlock ShowLangMessage(668): يجب تحديد التاريخ | mapped | Port as a blocking validation |
| عملية التصنيع `FrmManufProc` | Save guard hardBlock ShowLangMessage(669) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| عملية التصنيع `FrmManufProc` | Save guard hardBlock ShowLangMessage(670) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| عملية التصنيع `FrmManufProc` | Save guard hardBlock ShowLangMessage(2058) [CCType]: حساب المخزون يجب أن يحدد له مركز تكلفة | mapped | Port as a blocking validation |
| عملية التصنيع `FrmManufProc` | Save guard warningOnly ShowLangMessage(2059) [CCType]: حساب المخزون يجب أن يكون بدون مركز تكلفة | mapped | Port as a warning (legacy does not Exit) |
| عملية التصنيع `FrmManufProc` | Save guard hardBlock ShowLangMessage(2059) [CCType]: حساب المخزون يجب أن يكون بدون مركز تكلفة | mapped | Port as a blocking validation |
| عملية التصنيع `FrmManufProc` | Save guard hardBlock ShowLangMessage(2248): يوجد تكرار في الأصناف الناتجة للصنف | mapped | Port as a blocking validation |
| عملية التصنيع `FrmManufProc` | Save guard hardBlock ShowLangMessage(2250): حدد السعر للصنف | mapped | Port as a blocking validation |
| عملية التصنيع `FrmManufProc` | Save_Trace actions: Add@Save, Edit@Save, Delete@Delete, Delete@Other, Post@Other, UnPost@Other, Print@Print | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| تجميع أصناف `FrmStoreColl` | Line field `CompanyCode` (ops / other) via Insert Into StoreCollDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `BranchCode` (ops / other) via Insert Into StoreCollDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `YearID` (ops / other) via Insert Into StoreCollDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `StoreCollCode` (ops / other) via Insert Into StoreCollDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `Type` (ops / other) via Insert Into StoreCollDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `ItemCode` (ops / item) via Insert Into StoreCollDetail | covered | Keep — already on Prisma / Zod / grid. |
| تجميع أصناف `FrmStoreColl` | Line field `Qty` (unit / unitOther) via Insert Into StoreCollDetail | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `TransQty` (unit / unitOther) via Insert Into StoreCollDetail | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `UnitCode` (unit / unitOther) via Insert Into StoreCollDetail | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `Price` (ops / unitPrice) via Insert Into StoreCollDetail | covered | Keep — already on Prisma / Zod / grid. |
| تجميع أصناف `FrmStoreColl` | Line field `TotalPrice` (ops / other) via Insert Into StoreCollDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `SerialNums` (traceability / serialNumbers) via Insert Into StoreCollDetail | covered | Keep — already on Prisma / Zod / grid. |
| تجميع أصناف `FrmStoreColl` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `DetailNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `AccountNo` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `CCenterCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `CurrencyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `Change` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| تجميع أصناف `FrmStoreColl` | Save guard hardBlock ShowLangMessage(2163): النسخة غير مرخصة لا يمكنك حفظ أكثر من سجل | mapped | Port as a blocking validation |
| تجميع أصناف `FrmStoreColl` | Save guard hardBlock ShowLangMessage(1649): يجب تحديد تاريخ التجميع المخزني | mapped | Port as a blocking validation |
| تجميع أصناف `FrmStoreColl` | Save guard hardBlock ShowLangMessage(2164) [CCType]: حساب المخزن يجب أن يحدد له مركز تكلفة | mapped | Port as a blocking validation |
| تجميع أصناف `FrmStoreColl` | Save guard hardBlock ShowLangMessage(2165) [CCType]: حساب المخزن يجب أن يكون بدون مركز تكلفة | mapped | Port as a blocking validation |
| تجميع أصناف `FrmStoreColl` | Save guard hardBlock ShowLangMessage(2166) [CCType]: حساب المخزن يجب أن يحدد له مركز تكلفة | mapped | Port as a blocking validation |
| تجميع أصناف `FrmStoreColl` | Save guard hardBlock ShowLangMessage(2167) [CCType]: حساب المخزن يجب أن يكون بدون مركز تكلفة | mapped | Port as a blocking validation |
| تجميع أصناف `FrmStoreColl` | Save guard hardBlock ShowLangMessage(1650) [GetPeriod]: التاريخ المحدد لا يقع في نفس الفترة المحاسبية | mapped | Port as a blocking validation |
| تجميع أصناف `FrmStoreColl` | Save guard hardBlock ShowLangMessage(1651) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| تجميع أصناف `FrmStoreColl` | Save guard hardBlock ShowLangMessage(1652) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| تجميع أصناف `FrmStoreColl` | Save guard hardBlock ShowLangMessage(1653): يجب تحديد المخزن الذي سيتم التحويل منه | mapped | Port as a blocking validation |
| تجميع أصناف `FrmStoreColl` | Save guard hardBlock ShowLangMessage(1654): يجب تحديد المخزن الذي سيتم التحويل له | mapped | Port as a blocking validation |
| تجميع أصناف `FrmStoreColl` | Save guard hardBlock ShowLangMessage(1655): حدد إذن الصرف المخزني | mapped | Port as a blocking validation |
| تجميع أصناف `FrmStoreColl` | Save_Trace actions: Add@Save, Edit@Save, Delete@Delete, Post@Other, UnPost@Other, UnDelete@Other, Print@Print | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| تفكيك أصناف `FrmStoreDist` | Line field `CompanyCode` (ops / other) via Insert Into StoreCollDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `BranchCode` (ops / other) via Insert Into StoreCollDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `YearID` (ops / other) via Insert Into StoreCollDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `StoreCollCode` (ops / other) via Insert Into StoreCollDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `Type` (ops / other) via Insert Into StoreCollDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `ItemCode` (ops / item) via Insert Into StoreCollDetail | covered | Keep — already on Prisma / Zod / grid. |
| تفكيك أصناف `FrmStoreDist` | Line field `Qty` (unit / unitOther) via Insert Into StoreCollDetail | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `TransQty` (unit / unitOther) via Insert Into StoreCollDetail | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `UnitCode` (unit / unitOther) via Insert Into StoreCollDetail | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `Price` (ops / unitPrice) via Insert Into StoreCollDetail | covered | Keep — already on Prisma / Zod / grid. |
| تفكيك أصناف `FrmStoreDist` | Line field `TotalPrice` (ops / other) via Insert Into StoreCollDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `SerialNums` (traceability / serialNumbers) via Insert Into StoreCollDetail | covered | Keep — already on Prisma / Zod / grid. |
| تفكيك أصناف `FrmStoreDist` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `DetailNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `AccountNo` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `CCenterCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `CurrencyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `Change` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| تفكيك أصناف `FrmStoreDist` | Save guard hardBlock ShowLangMessage(2168): النسخة غير مرخصة لا يمكنك حفظ أكثر من سجل | mapped | Port as a blocking validation |
| تفكيك أصناف `FrmStoreDist` | Save guard hardBlock ShowLangMessage(1700): يجب تحديد تاريخ التفكيك المخزني | mapped | Port as a blocking validation |
| تفكيك أصناف `FrmStoreDist` | Save guard hardBlock ShowLangMessage(2169) [CCType]: حساب المخزن يجب أن يحدد له مركز تكلفة | mapped | Port as a blocking validation |
| تفكيك أصناف `FrmStoreDist` | Save guard hardBlock ShowLangMessage(2170) [CCType]: حساب المخزن يجب أن يكون بدون مركز تكلفة | mapped | Port as a blocking validation |
| تفكيك أصناف `FrmStoreDist` | Save guard hardBlock ShowLangMessage(2171) [CCType]: حساب المخزن يجب أن يحدد له مركز تكلفة | mapped | Port as a blocking validation |
| تفكيك أصناف `FrmStoreDist` | Save guard hardBlock ShowLangMessage(2172) [CCType]: حساب المخزن يجب أن يكون بدون مركز تكلفة | mapped | Port as a blocking validation |
| تفكيك أصناف `FrmStoreDist` | Save guard hardBlock ShowLangMessage(1701) [GetPeriod]: التاريخ المحدد لا يقع في نفس الفترة المحاسبية | mapped | Port as a blocking validation |
| تفكيك أصناف `FrmStoreDist` | Save guard hardBlock ShowLangMessage(1702) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| تفكيك أصناف `FrmStoreDist` | Save guard hardBlock ShowLangMessage(1703) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| تفكيك أصناف `FrmStoreDist` | Save guard hardBlock ShowLangMessage(1704): يجب تحديد المخزن الذي سيتم التحويل منه | mapped | Port as a blocking validation |
| تفكيك أصناف `FrmStoreDist` | Save guard hardBlock ShowLangMessage(1705): يجب تحديد المخزن الذي سيتم التحويل له | mapped | Port as a blocking validation |
| تفكيك أصناف `FrmStoreDist` | Save guard hardBlock ShowLangMessage(1706): حدد إذن الصرف المخزني | mapped | Port as a blocking validation |
| تفكيك أصناف `FrmStoreDist` | Save_Trace actions: Add@Save, Edit@Save, Delete@Delete, Post@Other, UnPost@Other, UnDelete@Other, Print@Print | partial | Trace is user/screen/action/record only — no IP, no old/new. |

## Inventory & Stock Movements

| Screen | Legacy Business Rule / Line Field | Web/Backend Status | Action Required |
|---|---|---|---|
| البنود التفصيلية العامة `FrmGeneralItemDetails` | Line field `GeneralItemDetailCode` (ops / other) via Insert Into AbsGeneralItemDetails | missing | Decide whether other is required for parity; not present on web/Prisma. |
| البنود التفصيلية العامة `FrmGeneralItemDetails` | Line field `GeneralItemDetailNameA` (ops / other) via Insert Into AbsGeneralItemDetails | missing | Decide whether other is required for parity; not present on web/Prisma. |
| البنود التفصيلية العامة `FrmGeneralItemDetails` | Line field `GeneralItemDetailNameE` (ops / other) via Insert Into AbsGeneralItemDetails | missing | Decide whether other is required for parity; not present on web/Prisma. |
| البنود التفصيلية العامة `FrmGeneralItemDetails` | Line field `GeneralItemCode` (ops / other) via Insert Into AbsGeneralItemDetails | missing | Decide whether other is required for parity; not present on web/Prisma. |
| البنود التفصيلية العامة `FrmGeneralItemDetails` | Save_Trace actions: Delete@Delete | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| `FrmGeneralItemDetailsValues` | Line field `CompanyCode` (ops / other) via Insert Into AbsGeneralItemDetailsValues | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmGeneralItemDetailsValues` | Line field `BranchCode` (ops / other) via Insert Into AbsGeneralItemDetailsValues | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmGeneralItemDetailsValues` | Line field `ProjectCode` (ops / other) via Insert Into AbsGeneralItemDetailsValues | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmGeneralItemDetailsValues` | Line field `GeneralItemCode` (ops / other) via Insert Into AbsGeneralItemDetailsValues | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmGeneralItemDetailsValues` | Line field `GeneralItemDetailCode` (ops / other) via Insert Into AbsGeneralItemDetailsValues | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmGeneralItemDetailsValues` | Line field `DetailsQtyValues` (unit / unitOther) via Insert Into AbsGeneralItemDetailsValues | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| `FrmGeneralItemDetailsValues` | Line field `DetailsMoneyValues` (ops / other) via Insert Into AbsGeneralItemDetailsValues | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmGeneralItemDetailsValues` | Line field `DetailsUnit` (unit / unitOther) via Insert Into AbsGeneralItemDetailsValues | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| `FrmGeneralItemDetailsValues` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | unmapped | Port as a warning (legacy does not Exit) |
| `FrmGeneralItemDetailsValues` | Save_Trace actions: Delete@Delete, ScreenMode@Save | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| `UntUnitForOthers` | Line field `CompanyCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `ItemCode` (ops / item) via Insert Into ItemDetail | covered | Keep — already on Prisma / Zod / grid. |
| `UntUnitForOthers` | Line field `DescA` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `FactoryCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `ColorCode` (traceability / traceOther) via Insert Into ItemDetail | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `OriginalCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `TypeCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `SizeCode` (traceability / traceOther) via Insert Into ItemDetail | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `Itemtype` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `ItemKind` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `UseExpDate` (traceability / traceOther) via Insert Into ItemDetail | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `NoDisc` (discount / discountOther) via Insert Into ItemDetail | missing | Decide whether discountOther is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `NoReturn` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `NoUnderCast` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `WantedPay` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `PicPath` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `Stopped` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `MaxValue` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `MinValue` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `WantedValue` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `MinOrder` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `OrderWay` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `PriceType` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `CurrencyCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Save guard hardBlock ShowLangMessage(1480): من فضلك ادخل الاسم العربي | unmapped | Port as a blocking validation |
| `UntUnitForOthers` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | unmapped | Port as a warning (legacy does not Exit) |
| `UntUnitForOthers` | Save guard hardBlock ShowLangMessage(2046): المجموعات التفصيلية عددها فقط | unmapped | Port as a blocking validation |
| `UntUnitForOthers` | Save_Trace actions: ScreenMode@Save, Delete@Delete | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| `UntUnitForSales` | Line field `CompanyCode` (ops / other) via Insert Into BLUnitForSalesD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `UnitCode` (unit / unitOther) via Insert Into BLUnitForSalesD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `Floor` (ops / other) via Insert Into BLUnitForSalesD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `UnitCount` (unit / unitOther) via Insert Into BLUnitForSalesD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `Serial` (traceability / traceOther) via Insert Into BLUnitForSalesD1 | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `UnitNum` (unit / unitOther) via Insert Into BLUnitForSalesD2 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `Area` (ops / other) via Insert Into BLUnitForSalesD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `RoomCount` (ops / other) via Insert Into BLUnitForSalesD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `BathCount` (ops / other) via Insert Into BLUnitForSalesD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `UnitView` (unit / unitOther) via Insert Into BLUnitForSalesD2 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `Price` (ops / unitPrice) via Insert Into BLUnitForSalesD2 | covered | Keep — already on Prisma / Zod / grid. |
| `UntUnitForSales` | Line field `Total` (ops / other) via Insert Into BLUnitForSalesD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `Other1` (ops / other) via Insert Into BLUnitForSalesD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `Other2` (ops / other) via Insert Into BLUnitForSalesD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `Other3` (ops / other) via Insert Into BLUnitForSalesD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `ReadyForSales` (ops / other) via Insert Into BLUnitForSalesD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `Sold` (ops / other) via Insert Into BLUnitForSalesD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `ItemCode` (ops / item) via Insert Into BLUnitForSalesD2 | covered | Keep — already on Prisma / Zod / grid. |
| `UntUnitForSales` | Line field `DescA` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `FactoryCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `ColorCode` (traceability / traceOther) via Insert Into ItemDetail | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `OriginalCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `TypeCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `SizeCode` (traceability / traceOther) via Insert Into ItemDetail | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Save guard hardBlock ShowLangMessage(1480): من فضلك ادخل الاسم العربي | unmapped | Port as a blocking validation |
| `UntUnitForSales` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | unmapped | Port as a warning (legacy does not Exit) |
| `UntUnitForSales` | Save guard hardBlock ShowLangMessage(2046): المجموعات التفصيلية عددها فقط | unmapped | Port as a blocking validation |
| `UntUnitForSales` | Save_Trace actions: ScreenMode@Save, Delete@Delete | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| نقل موظف `FrmHREmployeeTransfer` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | unmapped | Port as a warning (legacy does not Exit) |
| أرصدة افتتاحية `FrmBG` | Line field `CompanyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Line field `BranchCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Line field `YearID` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Line field `Type` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Line field `DetailNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Line field `AccountNo` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Line field `CCenterCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Line field `CreditValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Line field `MabiatAmount` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Line field `CurrencyCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Line field `Change` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Line field `DaribaPercentCode` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Line field `DaribaPercentValue` (tax / taxOther) via Insert Into GLTrxDetail | missing | Decide whether taxOther is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Line field `EsharCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Line field `Accepted` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Line field `Audit` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| أرصدة افتتاحية `FrmBG` | Save guard hardBlock ShowLangMessage(2024) [CCType, Mozana]: النسخة غير مرخصة لا يمكنك حفظ أكثر من سجل | mapped | Port as a blocking validation |
| أرصدة افتتاحية `FrmBG` | Save guard hardBlock ShowLangMessage(2186): القيد غير متزن ولا يمكن حفظه | mapped | Port as a blocking validation |
| أرصدة افتتاحية `FrmBG` | Save guard hardBlock ShowLangMessage(2194): الحساب يجب تحديد عملة له | mapped | Port as a blocking validation |
| أرصدة افتتاحية `FrmBG` | Save guard hardBlock ShowLangMessage(2192): الحساب يجب تحديد قيمة الدائن او المدين | mapped | Port as a blocking validation |
| أرصدة افتتاحية `FrmBG` | Save guard hardBlock ShowLangMessage(2193): الحساب يجب تحديد قيمة الدائن فقط او المدين فقط | mapped | Port as a blocking validation |
| أرصدة افتتاحية `FrmBG` | Save guard hardBlock ShowLangMessage(2194): الحساب يجب تحديد عملة له | mapped | Port as a blocking validation |
| أرصدة افتتاحية `FrmBG` | Save guard hardBlock ShowLangMessage(2195): الحساب يجب أن يحدد له مركز تكلفة | mapped | Port as a blocking validation |
| أرصدة افتتاحية `FrmBG` | Save guard warningOnly ShowLangMessage(2196): الحساب يجب أن يكون بدون مركز تكلفة | mapped | Port as a warning (legacy does not Exit) |
| أرصدة افتتاحية `FrmBG` | Save guard warningOnly ShowLangMessage(2025): الحساب تعدى الموازنة التقديرية له | mapped | Port as a warning (legacy does not Exit) |
| أرصدة افتتاحية `FrmBG` | Save guard warningOnly ShowLangMessage(2026): الحساب تعدى الموازنة التقديرية له | mapped | Port as a warning (legacy does not Exit) |
| أرصدة افتتاحية `FrmBG` | Save guard warningOnly ShowLangMessage(2027): مركز التكلفة تعدى الموازنة التقديرية له | mapped | Port as a warning (legacy does not Exit) |
| أرصدة افتتاحية `FrmBG` | Save guard warningOnly ShowLangMessage(2028): مركز التكلفة تعدى الموازنة التقديرية له | mapped | Port as a warning (legacy does not Exit) |
| أرصدة افتتاحية `FrmBG` | Save_Trace actions: Post@Post, UnPost@Other, UnDelete@Other, Add@Save, Edit@Save, Delete@Delete, Print@Print | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| أرصدة افتتاحية `FrmBG` | Tax ledgers: Eshar | partial | Real tables are Eshar / Dariba* — not DaribaItemDetail / EsharDetail. |
| `FrmItemFromExcel` | Line field `CompanyCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `ItemCode` (ops / item) via Insert Into ItemDetail | covered | Keep — already on Prisma / Zod / grid. |
| `FrmItemFromExcel` | Line field `DescA` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `FactoryCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `ColorCode` (traceability / traceOther) via Insert Into ItemDetail | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `OriginalCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `TypeCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `SizeCode` (traceability / traceOther) via Insert Into ItemDetail | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `Field1Code` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `Field2Code` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `Field3Code` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `field4Code` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `Field5Code` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `Itemtype` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `ItemKind` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `UseExpDate` (traceability / traceOther) via Insert Into ItemDetail | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `NoDisc` (discount / discountOther) via Insert Into ItemDetail | missing | Decide whether discountOther is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `NoReturn` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `NoUnderCast` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `WantedPay` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `PicPath` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `Stopped` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `MaxValue` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `FrmItemFromExcel` | Line field `MinValue` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بضاعة أول المدة `FrmItemsFirstTime` | Save guard hardBlock ShowLangMessage(534): ادخل أصناف في أول سطر في الجدول | mapped | Port as a blocking validation |
| بضاعة أول المدة `FrmItemsFirstTime` | Save guard hardBlock ShowLangMessage(2238): حدد المخزن للصنف | mapped | Port as a blocking validation |
| بضاعة أول المدة `FrmItemsFirstTime` | Save guard hardBlock ShowLangMessage(535): يجب تحديد الصنف | mapped | Port as a blocking validation |
| بضاعة أول المدة `FrmItemsFirstTime` | Save guard hardBlock ShowLangMessage(536): يجب تحديد الصنف | mapped | Port as a blocking validation |
| بضاعة أول المدة `FrmItemsFirstTime` | Save guard warningOnly ShowLangMessage(537): تم حفظ البيانات بنجاح | mapped | Port as a warning (legacy does not Exit) |
| بضاعة أول المدة `FrmItemsFirstTime` | Save guard warningOnly ShowLangMessage(538): يوجد خطأ في حفظ البيانات | mapped | Port as a warning (legacy does not Exit) |
| بضاعة أول المدة `FrmItemsFirstTime` | Save_Trace actions: Edit@Save, Post@Post, UnPost@Other | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| بضاعة أول المدة `FrmItemsFirstTime` | ItemCost ledger inserts (1) | partial | Append-only cost ledger on Post, not on Save. |
| نقل مخزني `FrmStoreTrans` | Line field `CompanyCode` (ops / other) via Insert Into StoreTransDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `BranchCode` (ops / other) via Insert Into StoreTransDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `YearID` (ops / other) via Insert Into StoreTransDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `StoreTransCode` (ops / other) via Insert Into StoreTransDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `Type` (ops / other) via Insert Into StoreTransDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `ItemCode` (ops / item) via Insert Into StoreTransDetail | covered | Keep — already on Prisma / Zod / grid. |
| نقل مخزني `FrmStoreTrans` | Line field `Qty` (unit / unitOther) via Insert Into StoreTransDetail | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `TransQty` (unit / unitOther) via Insert Into StoreTransDetail | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `UnitCode` (unit / unitOther) via Insert Into StoreTransDetail | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `Price` (ops / unitPrice) via Insert Into StoreTransDetail | covered | Keep — already on Prisma / Zod / grid. |
| نقل مخزني `FrmStoreTrans` | Line field `TotalPrice` (ops / other) via Insert Into StoreTransDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `Change` (ops / other) via Insert Into StoreTransDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `TransMainQty` (unit / unitOther) via Insert Into StoreTransDetail | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `Itemcat` (ops / itemCategory) via Insert Into StoreTransDetail | missing | Decide whether itemCategory is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `SpecialData` (ops / specialData) via Insert Into StoreTransDetail | missing | Decide whether specialData is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `ItemColorSizeCode` (traceability / colorSize) via Insert Into StoreTransDetail | missing | Decide whether colorSize is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `RowNum` (ops / other) via Insert Into StoreTransDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `GlNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `DetailDescA` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `DetailDescE` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `DetailNum` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `AccountNo` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `CCenterCode` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Line field `DebitValue` (ops / other) via Insert Into GLTrxDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| نقل مخزني `FrmStoreTrans` | Save guard hardBlock ShowLangMessage(2174): النسخة غير مرخصة لا يمكنك حفظ أكثر من سجل | mapped | Port as a blocking validation |
| نقل مخزني `FrmStoreTrans` | Save guard hardBlock ShowLangMessage(1770): ادخل أصناف في أول سطر في الجدول | mapped | Port as a blocking validation |
| نقل مخزني `FrmStoreTrans` | Save guard hardBlock ShowLangMessage(1771): يجب تحديد تاريخ التحويل المخزني | mapped | Port as a blocking validation |
| نقل مخزني `FrmStoreTrans` | Save guard hardBlock ShowLangMessage(1772) [GetPeriod]: التاريخ المحدد لا يقع في نفس الفترة المحاسبية | mapped | Port as a blocking validation |
| نقل مخزني `FrmStoreTrans` | Save guard hardBlock ShowLangMessage(1773) [GetPeriod]: التاريخ المحدد لا يقع ضمن فترة محاسبية محددة | mapped | Port as a blocking validation |
| نقل مخزني `FrmStoreTrans` | Save guard hardBlock ShowLangMessage(1774) [GetPeriod]: التاريخ المحدد يقع ضمن فترة محاسبية مغلقة | mapped | Port as a blocking validation |
| نقل مخزني `FrmStoreTrans` | Save guard hardBlock ShowLangMessage(1775): يجب تحديد المخزن الذي سيتم التحويل منه | mapped | Port as a blocking validation |
| نقل مخزني `FrmStoreTrans` | Save guard hardBlock ShowLangMessage(1776): يجب تحديد المخزن الذي سيتم التحويل له | mapped | Port as a blocking validation |
| نقل مخزني `FrmStoreTrans` | Save guard hardBlock ShowLangMessage(1777): حدد إذن الصرف المخزني | mapped | Port as a blocking validation |
| نقل مخزني `FrmStoreTrans` | Save guard hardBlock ShowLangMessage(1778): حدد إذن الإضافة المخزني | mapped | Port as a blocking validation |
| نقل مخزني `FrmStoreTrans` | Save guard hardBlock ShowLangMessage(2175) [CCType]: حساب المخزن يجب أن يحدد له مركز تكلفة | mapped | Port as a blocking validation |
| نقل مخزني `FrmStoreTrans` | Save guard hardBlock ShowLangMessage(2176) [CCType]: حساب المخزن يجب أن يكون بدون مركز تكلفة | mapped | Port as a blocking validation |
| نقل مخزني `FrmStoreTrans` | Save_Trace actions: Add@Save, Edit@Save, Delete@Delete, Post@Other, UnDelete@Other, Print@Print | partial | Trace is user/screen/action/record only — no IP, no old/new. |
| `UntUnitForOthers` | Line field `CompanyCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `ItemCode` (ops / item) via Insert Into ItemDetail | covered | Keep — already on Prisma / Zod / grid. |
| `UntUnitForOthers` | Line field `DescA` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `FactoryCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `ColorCode` (traceability / traceOther) via Insert Into ItemDetail | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `OriginalCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `TypeCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `SizeCode` (traceability / traceOther) via Insert Into ItemDetail | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `Itemtype` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `ItemKind` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `UseExpDate` (traceability / traceOther) via Insert Into ItemDetail | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `NoDisc` (discount / discountOther) via Insert Into ItemDetail | missing | Decide whether discountOther is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `NoReturn` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `NoUnderCast` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `WantedPay` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `PicPath` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `Stopped` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `MaxValue` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `MinValue` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `WantedValue` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `MinOrder` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `OrderWay` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `PriceType` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Line field `CurrencyCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForOthers` | Save guard hardBlock ShowLangMessage(1480): من فضلك ادخل الاسم العربي | unmapped | Port as a blocking validation |
| `UntUnitForOthers` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | unmapped | Port as a warning (legacy does not Exit) |
| `UntUnitForOthers` | Save guard hardBlock ShowLangMessage(2046): المجموعات التفصيلية عددها فقط | unmapped | Port as a blocking validation |
| `UntUnitForOthers` | Save_Trace actions: ScreenMode@Save, Delete@Delete | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| `UntUnitForSales` | Line field `CompanyCode` (ops / other) via Insert Into BLUnitForSalesD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `UnitCode` (unit / unitOther) via Insert Into BLUnitForSalesD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `Floor` (ops / other) via Insert Into BLUnitForSalesD1 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `UnitCount` (unit / unitOther) via Insert Into BLUnitForSalesD1 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `Serial` (traceability / traceOther) via Insert Into BLUnitForSalesD1 | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `UnitNum` (unit / unitOther) via Insert Into BLUnitForSalesD2 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `Area` (ops / other) via Insert Into BLUnitForSalesD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `RoomCount` (ops / other) via Insert Into BLUnitForSalesD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `BathCount` (ops / other) via Insert Into BLUnitForSalesD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `UnitView` (unit / unitOther) via Insert Into BLUnitForSalesD2 | missing | Decide whether unitOther is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `Price` (ops / unitPrice) via Insert Into BLUnitForSalesD2 | covered | Keep — already on Prisma / Zod / grid. |
| `UntUnitForSales` | Line field `Total` (ops / other) via Insert Into BLUnitForSalesD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `Other1` (ops / other) via Insert Into BLUnitForSalesD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `Other2` (ops / other) via Insert Into BLUnitForSalesD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `Other3` (ops / other) via Insert Into BLUnitForSalesD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `ReadyForSales` (ops / other) via Insert Into BLUnitForSalesD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `Sold` (ops / other) via Insert Into BLUnitForSalesD2 | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `ItemCode` (ops / item) via Insert Into BLUnitForSalesD2 | covered | Keep — already on Prisma / Zod / grid. |
| `UntUnitForSales` | Line field `DescA` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `FactoryCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `ColorCode` (traceability / traceOther) via Insert Into ItemDetail | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `OriginalCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `TypeCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Line field `SizeCode` (traceability / traceOther) via Insert Into ItemDetail | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| `UntUnitForSales` | Save guard hardBlock ShowLangMessage(1480): من فضلك ادخل الاسم العربي | unmapped | Port as a blocking validation |
| `UntUnitForSales` | Save guard warningOnly ShowLangMessage(1485): يوجد خطأ في حفظ البيانات | unmapped | Port as a warning (legacy does not Exit) |
| `UntUnitForSales` | Save guard hardBlock ShowLangMessage(2046): المجموعات التفصيلية عددها فقط | unmapped | Port as a blocking validation |
| `UntUnitForSales` | Save_Trace actions: ScreenMode@Save, Delete@Delete | missing | Trace is user/screen/action/record only — no IP, no old/new. |
| بطاقة صنف `frmItem` | Line field `CompanyCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `ItemCode` (ops / item) via Insert Into ItemDetail | covered | Keep — already on Prisma / Zod / grid. |
| بطاقة صنف `frmItem` | Line field `DescA` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `FactoryCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `ColorCode` (traceability / traceOther) via Insert Into ItemDetail | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `OriginalCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `TypeCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `SizeCode` (traceability / traceOther) via Insert Into ItemDetail | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `Itemtype` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `ItemKind` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `UseExpDate` (traceability / traceOther) via Insert Into ItemDetail | missing | Decide whether traceOther is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `NoDisc` (discount / discountOther) via Insert Into ItemDetail | missing | Decide whether discountOther is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `NoReturn` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `NoUnderCast` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `WantedPay` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `PicPath` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `Stopped` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `MaxValue` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `MinValue` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `WantedValue` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `MinOrder` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `OrderWay` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `PriceType` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Line field `CurrencyCode` (ops / other) via Insert Into ItemDetail | missing | Decide whether other is required for parity; not present on web/Prisma. |
| بطاقة صنف `frmItem` | Save guard hardBlock ShowLangMessage(484): من فضلك حدد رقم الصنف | mapped | Port as a blocking validation |
| بطاقة صنف `frmItem` | Save guard hardBlock ShowLangMessage(485): من فضلك حدد اسم الصنف | mapped | Port as a blocking validation |
| بطاقة صنف `frmItem` | Save guard hardBlock ShowLangMessage(485): من فضلك حدد اسم الصنف | mapped | Port as a blocking validation |
| بطاقة صنف `frmItem` | Save guard hardBlock ShowLangMessage(486): حدد المجموعة الرئيسية | mapped | Port as a blocking validation |
| بطاقة صنف `frmItem` | Save guard hardBlock ShowLangMessage(487): رقم الصنف موجود من قبل | mapped | Port as a blocking validation |
| بطاقة صنف `frmItem` | Save guard hardBlock ShowLangMessage(488): رقم الصنف موجود من قبل | mapped | Port as a blocking validation |
| بطاقة صنف `frmItem` | Save guard hardBlock ShowLangMessage(489): اسم الصنف موجود من قبل | mapped | Port as a blocking validation |
| بطاقة صنف `frmItem` | Save guard hardBlock ShowLangMessage(2230): المورد مكرر | mapped | Port as a blocking validation |
| بطاقة صنف `frmItem` | Save guard hardBlock ShowLangMessage(2231): الباركود مكرر | mapped | Port as a blocking validation |
| بطاقة صنف `frmItem` | Save guard hardBlock ShowLangMessage(2232): الصنف مكرر في التجميع | mapped | Port as a blocking validation |
| بطاقة صنف `frmItem` | Save guard hardBlock ShowLangMessage(490): يجب تحديد الوحدة | mapped | Port as a blocking validation |
| بطاقة صنف `frmItem` | Save guard hardBlock ShowLangMessage(491): الباركود مكرر في أصناف أخرى | mapped | Port as a blocking validation |
| بطاقة صنف `frmItem` | Save_Trace actions: Add@Save, Edit@Save, Delete@Delete, Browse@Other | partial | Trace is user/screen/action/record only — no IP, no old/new. |

## Limitations

- `SaveInvoices` / `SaveReturnInvoices` stored-procedure bodies are not in the repo (only `MainProgram/Drivers_Distributers.sql` exists). Invoice-side server rules are flagged `needs-db-access`.
- `CheckMoazna()` is implemented in `untPInovice.pas` but never called — dead client-side code, not a live save rule.
- No sell-below-cost guard exists in Pascal save handlers; it appears only in audit dashboards. `Item.noSellBelowCost` exists in Prisma but is unenforced — a web-side gap, not a legacy parity gap.
- `Save_Trace` fires on Post / Delete / Print / UnPost — not on invoice Save. The Trace table has no IP and no old/new value.
- Line grids are unbound `TAdvStringGrid`. Authoritative fields are `Insert Into <DetailTable>(...)`. DFM `columnHeaders` show only the visible subset.
- Grids and `.pas` sources are CP1256; LangMessages.txt is UTF-16LE. This script reuses `decodeCp1256` / `parseLangMessages` from `parity-utils.mjs` (no iconv-lite).
- Requested identifiers Length/Width/Thickness, FreeQty/BonusQty, BatchNo, AltUnit, TableTax/Damga, DaribaItemDetail, EsharDetail, IsPosted/IsAudited/IsPrinted are absent from the sources — see the verdict table.

## How to read this

- `covered` = Prisma + Zod or grid already store the concept.
- `partial` = web has a related field but not the full legacy column set.
- `missing` = no web/Prisma counterpart.
- `needs-db-access` = `SaveInvoices` / `SaveReturnInvoices` bodies are not in the repo.
- `hardBlock` = ShowLangMessage is followed by Exit / Result:=False.
- `warningOnly` = message without abort (Mozana-style credit warnings).
