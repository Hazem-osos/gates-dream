export class LegacyIdCache {
  private map = new Map<string, string>();

  set(key: string, id: string) {
    this.map.set(key, id);
  }

  get(key: string): string | undefined {
    return this.map.get(key);
  }

  require(key: string, label: string): string {
    const id = this.get(key);
    if (!id) throw new Error(`Missing cache mapping: ${label} (${key})`);
    return id;
  }

  keyCompany(companyCode: string) {
    return `company:${companyCode}`;
  }

  keyBranch(companyCode: string, branchCode: string) {
    return `branch:${companyCode}:${branchCode}`;
  }

  keyYear(companyCode: string, yearCode: string) {
    return `year:${companyCode}:${yearCode}`;
  }

  keyAccount(companyCode: string, accountCode: string) {
    return `account:${companyCode}:${accountCode}`;
  }

  keyCostCenter(companyCode: string, code: string) {
    return `cc:${companyCode}:${code}`;
  }

  keyCustomer(companyCode: string, code: string) {
    return `customer:${companyCode}:${code}`;
  }

  keySupplier(companyCode: string, code: string) {
    return `supplier:${companyCode}:${code}`;
  }

  keyWarehouse(companyCode: string, storeCode: string) {
    return `warehouse:${companyCode}:${storeCode}`;
  }

  keyItem(companyCode: string, itemCode: string) {
    return `item:${companyCode}:${itemCode}`;
  }

  keyUnit(companyCode: string, unitCode: string) {
    return `unit:${companyCode}:${unitCode}`;
  }

  keyJournal(companyCode: string, branchCode: string, yearCode: string, glNum: string) {
    return `je:${companyCode}:${branchCode}:${yearCode}:${glNum}`;
  }

  keyInvoice(companyCode: string, yearCode: string, invoiceNum: string) {
    return `inv:${companyCode}:${yearCode}:${invoiceNum}`;
  }
}
