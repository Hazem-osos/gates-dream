export type PayrollReportFilters = {
  page?: number;
  pageSize?: number;
  employeeId?: string;
  branchId?: string;
  departmentId?: string;
  costCenterId?: string;
  componentCode?: string;
  search?: string;
  employmentStatus?: 'active' | 'inactive' | 'all';
  sortBy?: 'employeeName' | 'serial' | 'gross' | 'net';
  sortOrder?: 'asc' | 'desc';
};

export function payrollReportQueryString(filters: PayrollReportFilters, opts?: { exportAll?: boolean }) {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.employeeId) params.set('employeeId', filters.employeeId);
  if (filters.branchId) params.set('branchId', filters.branchId);
  if (filters.departmentId) params.set('departmentId', filters.departmentId);
  if (filters.costCenterId) params.set('costCenterId', filters.costCenterId);
  if (filters.componentCode) params.set('componentCode', filters.componentCode);
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.employmentStatus && filters.employmentStatus !== 'all') {
    params.set('employmentStatus', filters.employmentStatus);
  }
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  if (opts?.exportAll) params.set('exportAll', '1');
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
