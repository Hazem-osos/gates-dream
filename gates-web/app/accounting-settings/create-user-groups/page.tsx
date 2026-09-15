'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import React, { useState, useMemo } from 'react';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { useFirstCompany } from '@/lib/hooks/useFirstCompany';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { Pagination } from '@/components/ui/Pagination';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { Shield, Users } from 'lucide-react';

/** Mirrors `PermissionDefinition` from the backend permission catalog. */
type PermissionDefinition = {
  resource: string;
  resourceLabel: string;
  module?: string;
  actions: { action: string; label: string; description?: string }[];
};

type DocumentRightFamily = {
  key: string;
  unpostKey?: string;
  descriptionEn: string;
  wired: boolean;
  legacyPostKey: string;
};

type BankBoxGrant = {
  safeId: string | null;
  bankAccountId: string | null;
  canPost: boolean;
  canView?: boolean;
};

type NamedRow = { id: string; arabicName?: string; englishName?: string | null; code?: string | null; accountNumber?: string | null };

const USER_RIGHTS_SECTIONS = [
  'list-permissions',
  'advanced-permissions',
  'bank-permissions',
  'branch-permissions',
] as const;

const DOCUMENT_FAMILY_LABELS: Record<string, string> = {
  glPost: 'قيود اليومية',
  bgPost: 'قيود الموازنة',
  piPost: 'فواتير المبيعات',
  svPost: 'فواتير المشتريات',
  srPost: 'مرتجع المبيعات',
  prPost: 'مرتجع المشتريات',
  scPost: 'الجرد المخزني',
  stPost: 'التحويل المخزني',
  siPost: 'التسوية / التوزيع المخزني',
  etPost: 'الاعتمادات والضمانات',
  ftPost: 'بضاعة أول المدة',
  slPost: 'تحصيل المخزن',
  pcPost: 'شيك صادر',
  rcPost: 'شيك وارد',
  cashBpPost: 'سند صرف نقدي',
  cashBrPost: 'سند قبض نقدي',
  cashKpPost: 'سند صرف بنكي',
  cashKrPost: 'سند قبض بنكي',
  yearOpen: 'فتح السنة المالية',
  yearClose: 'إقفال السنة المالية',
};

export default function CreateUserGroupsPage() {
  useBackendReachability();

  const { companyId } = useFirstCompany();
  const invalidate = useInvalidateQuery();
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: groupsRes } = useApiQuery<
    {
      id: string;
      arabicName: string;
      code?: string | null;
    }[]
  >(['user-groups', 'accounting-settings'], '/user-groups', { page: 1, limit: 100 }, { enabled: Boolean(companyId) });

  const createGroupMutation = useApiMutation<unknown, Record<string, unknown>>('/user-groups', 'POST', {
    onSuccess: (res) => {
      setSaveSuccess(res.message || 'تم حفظ المجموعة');
      setSaveError('');
      invalidate(['user-groups']);
    },
    onError: (e: { message?: string }) => {
      setSaveError(e?.message || 'فشل الحفظ');
      setSaveSuccess('');
    },
  });

  const [formData, setFormData] = useState({
    passwordName: '',
    arabicName: '',
    password: '',
    group: 'الخزينة الرئيسية',
    priceList: '',
    hidePricesInInvoices: true,
    allowChangePaymentValue: true,
    posManager: true,
    deactivate: true,
  });

  const [activeSection, setActiveSection] = useState('create-groups');
  const [trackUsersData, setTrackUsersData] = useState({
    company: '',
    action: '',
    recordDateFrom: '26-11-2025',
    recordDateTo: '26-11-2025',
    username: '',
    description: '',
    actionDateFrom: '26-11-2025',
    actionDateTo: '26-11-2025'
  });

  const { data: auditLogsRes, isLoading: auditLogsLoading } = useApiQuery<
    {
      id: string;
      tableName?: string;
      action?: string;
      at?: string;
      by?: string;
      rowId?: string;
      requestId?: string;
    }[]
  >(
    ['audit-logs', 'track-users', trackUsersData.username, trackUsersData.actionDateFrom, page],
    '/audit-logs',
    {
      page,
      limit: pageSize,
      userId: trackUsersData.username || undefined,
    },
    { enabled: Boolean(companyId) && activeSection === 'track-users' }
  );

  // The permission catalog is the authority on which resource/action pairs the
  // backend can actually store and authorize against — the previous hardcoded
  // Arabic module names were sent as `resource` and matched nothing.
  const { data: permissionDefsRes } = useApiQuery<PermissionDefinition[]>(
    ['permission-definitions'],
    '/permissions',
    undefined,
    { enabled: activeSection === 'list-permissions' }
  );

  const rightsSectionActive = (USER_RIGHTS_SECTIONS as readonly string[]).includes(activeSection);

  const { data: usersRes } = useApiQuery<{ id: string; username: string; email: string }[]>(
    ['users', 'permissions-picker'],
    '/users',
    { page: 1, limit: 200 },
    { enabled: Boolean(companyId) && rightsSectionActive }
  );

  const { data: branchesRes } = useApiQuery<NamedRow[]>(
    ['company-branches', companyId ?? 'none'],
    '/company/branches',
    undefined,
    { enabled: Boolean(companyId) && rightsSectionActive }
  );
  const companyBranches = useMemo(() => branchesRes?.data ?? [], [branchesRes?.data]);

  const { data: safesRes } = useApiQuery<NamedRow[]>(
    ['safes', 'rights'],
    '/accounting/safes',
    { isActive: true },
    { enabled: Boolean(companyId) && activeSection === 'bank-permissions' }
  );
  const liveSafes = useMemo(() => safesRes?.data ?? [], [safesRes?.data]);

  const { data: bankAccountsRes } = useApiQuery<NamedRow[]>(
    ['bank-accounts-for-rights'],
    '/accounting/bank-accounts',
    { isActive: true },
    { enabled: Boolean(companyId) && activeSection === 'bank-permissions' }
  );
  const liveBankAccounts = useMemo(() => bankAccountsRes?.data ?? [], [bankAccountsRes?.data]);

  const [permissionsData, setPermissionsData] = useState<{
    branch: string;
    company: string;
    username: string;
    selectedResource: string;
    permissions: Record<string, boolean>;
  }>({
    branch: '',
    company: '',
    username: '',
    selectedResource: '',
    permissions: {},
  });

  // Existing grants for the picked user, so the checkboxes show what is really
  // stored instead of defaulting everything to allowed.
  const { data: userPermissionsRes } = useApiQuery<
    { id: string; resource: string; action: string; module?: string | null; allow: boolean }[]
  >(
    ['user-permissions', permissionsData.username],
    permissionsData.username ? `/users/${permissionsData.username}/permissions` : '/users',
    undefined,
    { enabled: Boolean(permissionsData.username) && activeSection === 'list-permissions' }
  );

  const [advancedPermissionsData, setAdvancedPermissionsData] = useState({
    branch: '',
    company: '',
    username: '',
    allowAllTransfers: false,
    disallowAllTransfers: false,
  });
  const [documentRightFlags, setDocumentRightFlags] = useState<Record<string, boolean>>({});

  const [bankPermissionsData, setBankPermissionsData] = useState({
    branch: '',
    company: '',
    username: '',
    activeTab: 'funds' as 'funds' | 'banks',
  });
  const [safeAllowed, setSafeAllowed] = useState<Record<string, boolean>>({});
  const [bankAllowed, setBankAllowed] = useState<Record<string, boolean>>({});

  const handleBankPermissionsChange = (field: string, value: string | boolean) => {
    if (['branch', 'company', 'username', 'activeTab'].includes(field)) {
      setBankPermissionsData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const [branchPermissionsData, setBranchPermissionsData] = useState({
    company: '',
    username: '',
  });
  const [permittedBranchIds, setPermittedBranchIds] = useState<Record<string, boolean>>({});

  const handleBranchPermissionsChange = (field: string, value: string) => {
    setBranchPermissionsData((prev) => ({ ...prev, [field]: value }));
  };

  const { data: documentRightsRes } = useApiQuery<{
    userId: string;
    documentRights: Record<string, boolean> | null;
    families: DocumentRightFamily[];
  }>(
    ['document-rights', advancedPermissionsData.username, advancedPermissionsData.branch],
    advancedPermissionsData.username
      ? `/users/${advancedPermissionsData.username}/document-rights`
      : '/users',
    advancedPermissionsData.branch ? { branchId: advancedPermissionsData.branch } : undefined,
    { enabled: Boolean(advancedPermissionsData.username) && activeSection === 'advanced-permissions' }
  );

  const documentFamilies = useMemo<DocumentRightFamily[]>(
    () => documentRightsRes?.data?.families ?? [],
    [documentRightsRes?.data?.families]
  );

  React.useEffect(() => {
    if (!advancedPermissionsData.username || activeSection !== 'advanced-permissions') return;
    const stored = documentRightsRes?.data?.documentRights;
    const families = documentRightsRes?.data?.families ?? [];
    const next: Record<string, boolean> = {};
    for (const family of families) {
      const unrestricted = stored == null;
      next[family.key] = unrestricted ? true : Boolean(stored[family.key]);
      if (family.unpostKey) {
        next[family.unpostKey] = unrestricted ? true : Boolean(stored[family.unpostKey]);
      }
    }
    setDocumentRightFlags(next);
    setAdvancedPermissionsData((prev) => ({
      ...prev,
      allowAllTransfers: stored == null || (families.length > 0 && families.every((f) => stored?.[f.key] && (!f.unpostKey || stored[f.unpostKey]))),
      disallowAllTransfers: stored != null && families.length > 0 && families.every((f) => !stored[f.key] && (!f.unpostKey || !stored[f.unpostKey])),
    }));
  }, [advancedPermissionsData.username, activeSection, documentRightsRes?.data]);

  const { data: bankRightsRes } = useApiQuery<BankBoxGrant[]>(
    ['bank-box-rights', bankPermissionsData.username],
    bankPermissionsData.username
      ? `/treasury/bank-box-rights/${bankPermissionsData.username}`
      : '/treasury/bank-box-rights/none',
    undefined,
    { enabled: Boolean(bankPermissionsData.username) && activeSection === 'bank-permissions' }
  );

  React.useEffect(() => {
    if (!bankPermissionsData.username || activeSection !== 'bank-permissions') return;
    const grants = bankRightsRes?.data ?? [];
    const unrestricted = grants.length === 0;
    const nextSafes: Record<string, boolean> = {};
    for (const safe of liveSafes) {
      nextSafes[safe.id] = unrestricted
        ? true
        : grants.some((g) => g.safeId === safe.id && g.canPost);
    }
    const nextBanks: Record<string, boolean> = {};
    for (const bank of liveBankAccounts) {
      nextBanks[bank.id] = unrestricted
        ? true
        : grants.some((g) => g.bankAccountId === bank.id && g.canPost);
    }
    setSafeAllowed(nextSafes);
    setBankAllowed(nextBanks);
  }, [bankPermissionsData.username, activeSection, bankRightsRes?.data, liveSafes, liveBankAccounts]);

  const { data: userBranchesRes } = useApiQuery<{
    userId: string;
    branches: Array<{ id: string; arabicName: string }>;
  }>(
    ['user-branches', companyId ?? 'none', branchPermissionsData.username],
    companyId && branchPermissionsData.username
      ? `/companies/${companyId}/users/${branchPermissionsData.username}/branches`
      : '/company/branches',
    undefined,
    {
      enabled:
        Boolean(companyId && branchPermissionsData.username) && activeSection === 'branch-permissions',
    }
  );

  React.useEffect(() => {
    if (!branchPermissionsData.username || activeSection !== 'branch-permissions') return;
    const assigned = userBranchesRes?.data?.branches ?? [];
    const unrestricted = assigned.length === 0;
    const next: Record<string, boolean> = {};
    for (const branch of companyBranches) {
      next[branch.id] = unrestricted ? true : assigned.some((b) => b.id === branch.id);
    }
    setPermittedBranchIds(next);
  }, [branchPermissionsData.username, activeSection, userBranchesRes?.data, companyBranches]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTrackUsersChange = (field: string, value: string) => {
    setTrackUsersData(prev => ({
      ...prev,
      [field]: value
    }));
    setPage(1);
  };

  const handlePermissionsChange = (field: string, value: string | boolean) => {
    if (field.startsWith('permissions.')) {
      const permissionField = field.split('.')[1];
      setPermissionsData(prev => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [permissionField]: Boolean(value)
        }
      }));
    } else {
      setPermissionsData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const applyDocumentRightBulk = (allow: boolean) => {
    const next: Record<string, boolean> = {};
    for (const family of documentFamilies) {
      next[family.key] = allow;
      if (family.unpostKey) next[family.unpostKey] = allow;
    }
    setDocumentRightFlags(next);
  };

  const handleAdvancedPermissionsChange = (field: string, value: string | boolean) => {
    if (field === 'allowAllTransfers') {
      setAdvancedPermissionsData((prev) => ({
        ...prev,
        allowAllTransfers: Boolean(value),
        disallowAllTransfers: value ? false : prev.disallowAllTransfers,
      }));
      if (value) applyDocumentRightBulk(true);
      return;
    }
    if (field === 'disallowAllTransfers') {
      setAdvancedPermissionsData((prev) => ({
        ...prev,
        disallowAllTransfers: Boolean(value),
        allowAllTransfers: value ? false : prev.allowAllTransfers,
      }));
      if (value) applyDocumentRightBulk(false);
      return;
    }
    if (field === 'branch' || field === 'company' || field === 'username') {
      setAdvancedPermissionsData((prev) => ({ ...prev, [field]: value }));
    }
  };

  // State for Disallowed Accounts tree
  const [disallowedOpenFolders, setDisallowedOpenFolders] = useState<{ [key: string]: boolean }>({ root: true });
  type DisallowedFolder = {
    key: string;
    label: string;
    children?: DisallowedFolder[];
  };
  const disallowedFolders: DisallowedFolder[] = [
    {
      key: 'root',
      label: 'الأصول',
      children: [
        { key: 'f1', label: 'الأصول الثابتة', children: [ { key: 'f1-1', label: 'آلات ومعدات' }, { key: 'f1-2', label: 'سيارات' } ] },
        { key: 'f2', label: 'الأصول المتداولة', children: [ { key: 'f2-1', label: 'مخزون' }, { key: 'f2-2', label: 'ذمم مدينة' } ] },
      ]
    },
    { key: 'liab', label: 'الإلتزامات وحقوق الملكية' },
    { key: 'exp', label: 'المصاريف العمومية' },
  ];
  const disallowedFiles = [
    { key: '110101', label: 'الصندوق الرئيسي' },
    { key: '110102', label: 'خزينة الفرع' },
    { key: '120100', label: 'بنك 1' },
    { key: '130000', label: 'ذمم مدينة' },
  ];
  const toggleDisallowedFolder = (key: string) => {
    setDisallowedOpenFolders(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const [disallowedZoomLevel, setDisallowedZoomLevel] = useState<number>(5);

  const handleSave = () => {
    setSaveError('');
    setSaveSuccess('');
    if (!companyId) {
      setSaveError('لم يتم العثور على شركة نشطة');
      return;
    }
    if (!formData.arabicName?.trim()) {
      setSaveError('الإسم العربي للمجموعة مطلوب');
      return;
    }
    createGroupMutation.mutate({
      companyId,
      arabicName: formData.arabicName.trim(),
      password: formData.password?.trim() || undefined,
      priceList: formData.priceList?.trim() || undefined,
      hidePricesInInvoices: formData.hidePricesInInvoices,
      allowChangePaymentValue: formData.allowChangePaymentValue,
      posManager: formData.posManager,
      deactivate: formData.deactivate,
    });
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroupId) {
      setSaveError('اختر مجموعة للحذف من القائمة');
      return;
    }
    setSaveError('');
    try {
      await apiClient.delete(`/user-groups/${selectedGroupId}`);
      setSaveSuccess('تم حذف المجموعة');
      invalidate(['user-groups']);
      setSelectedGroupId('');
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'فشل حذف المجموعة');
    }
  };

  const handleSavePermissions = async () => {
    if (!permissionsData.username) {
      setSaveError('اختر المستخدم لحفظ الصلاحيات');
      return;
    }
    if (!selectedPermissionDef) {
      setSaveError('اختر الشاشة لحفظ الصلاحيات');
      return;
    }
    setSaveError('');
    try {
      // Every catalog action is sent with an explicit `allow`, so unchecking
      // one revokes it instead of leaving a stale grant behind.
      await apiClient.post(`/users/${permissionsData.username}/permissions/bulk`, {
        module: selectedPermissionDef.module,
        permissions: selectedPermissionDef.actions.map(({ action }) => ({
          resource: selectedPermissionDef.resource,
          action,
          allow: Boolean(permissionsData.permissions[action]),
        })),
      });
      invalidate(['user-permissions']);
      setSaveSuccess('تم حفظ صلاحيات القوائم');
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'فشل حفظ الصلاحيات');
    }
  };

  const handleSaveDocumentRights = async () => {
    if (!advancedPermissionsData.username) {
      setSaveError('اختر المستخدم لحفظ صلاحيات الترحيل');
      return;
    }
    setSaveError('');
    try {
      await apiClient.put(`/users/${advancedPermissionsData.username}/document-rights`, {
        branchId: advancedPermissionsData.branch || null,
        documentRights: documentRightFlags,
      });
      invalidate(['document-rights']);
      setSaveSuccess('تم حفظ صلاحيات الترحيل وفك الترحيل');
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'فشل حفظ صلاحيات الترحيل');
    }
  };

  const handleSaveBankRights = async () => {
    if (!bankPermissionsData.username) {
      setSaveError('اختر المستخدم لحفظ صلاحيات البنوك والصناديق');
      return;
    }
    setSaveError('');
    try {
      const allSafesChecked = liveSafes.length === 0 || liveSafes.every((s) => safeAllowed[s.id]);
      const allBanksChecked =
        liveBankAccounts.length === 0 || liveBankAccounts.every((b) => bankAllowed[b.id]);
      const grants: BankBoxGrant[] =
        allSafesChecked && allBanksChecked
          ? []
          : [
              ...liveSafes
                .filter((s) => safeAllowed[s.id])
                .map((s) => ({ safeId: s.id, bankAccountId: null, canPost: true, canView: true })),
              ...liveBankAccounts
                .filter((b) => bankAllowed[b.id])
                .map((b) => ({ safeId: null, bankAccountId: b.id, canPost: true, canView: true })),
            ];
      await apiClient.put(`/treasury/bank-box-rights/${bankPermissionsData.username}`, { grants });
      invalidate(['bank-box-rights']);
      setSaveSuccess('تم حفظ صلاحيات البنوك والصناديق');
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'فشل حفظ صلاحيات البنوك والصناديق');
    }
  };

  const handleSaveBranchRights = async () => {
    if (!companyId) {
      setSaveError('لم يتم العثور على شركة نشطة');
      return;
    }
    if (!branchPermissionsData.username) {
      setSaveError('اختر المستخدم لحفظ صلاحيات الفروع');
      return;
    }
    const selected = companyBranches.filter((b) => permittedBranchIds[b.id]).map((b) => b.id);
    if (selected.length === 0 && companyBranches.length > 0) {
      setSaveError('حدد فرعاً واحداً على الأقل، أو اترك الكل محدداً للإطلاع على كل الفروع');
      return;
    }
    setSaveError('');
    try {
      const allSelected = selected.length === companyBranches.length;
      await apiClient.post(`/companies/${companyId}/branches/permissions/bulk`, {
        userId: branchPermissionsData.username,
        branchIds: allSelected ? [] : selected,
      });
      invalidate(['user-branches']);
      setSaveSuccess(allSelected ? 'تم السماح بالإطلاع على كل الفروع' : 'تم حفظ صلاحيات الفروع');
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'فشل حفظ صلاحيات الفروع');
    }
  };

  const permissionDefs = useMemo<PermissionDefinition[]>(
    () => permissionDefsRes?.data ?? [],
    [permissionDefsRes?.data]
  );

  const selectedPermissionDef = useMemo(
    () => permissionDefs.find((def) => def.resource === permissionsData.selectedResource) ?? null,
    [permissionDefs, permissionsData.selectedResource]
  );

  // Seed the checkboxes from what is actually stored for this user/resource.
  React.useEffect(() => {
    if (!selectedPermissionDef) return;
    const granted = new Set(
      (userPermissionsRes?.data ?? [])
        .filter((row) => row.allow && row.resource === selectedPermissionDef.resource)
        .map((row) => row.action)
    );
    setPermissionsData((prev) => ({
      ...prev,
      permissions: Object.fromEntries(
        selectedPermissionDef.actions.map(({ action }) => [action, granted.has(action)])
      ),
    }));
  }, [selectedPermissionDef, userPermissionsRes?.data]);

  const handleBack = () => {
    // Handle back navigation
  };

  const handleFooterSave = () => {
    setSaveError('');
    if (activeSection === 'list-permissions') {
      void handleSavePermissions();
      return;
    }
    if (activeSection === 'advanced-permissions') {
      void handleSaveDocumentRights();
      return;
    }
    if (activeSection === 'bank-permissions') {
      void handleSaveBankRights();
      return;
    }
    if (activeSection === 'branch-permissions') {
      void handleSaveBranchRights();
      return;
    }
    if (activeSection === 'track-users') {
      setSaveSuccess('تم تحديث عوامل التصفية');
      return;
    }
    handleSave();
  };

  const handleFooterCancel = () => {
    if (
      activeSection === 'track-users' ||
      activeSection === 'list-permissions' ||
      activeSection === 'advanced-permissions' ||
      activeSection === 'bank-permissions' ||
      activeSection === 'branch-permissions'
    ) {
      setActiveSection('create-groups');
      return;
    }
    handleBack();
  };

  const sections = [
    { key: 'create-groups', label: 'إنشاء مجموعات المستخدمين' },
    { key: 'track-users', label: 'تتبع المستخدمين' },
  

    { key: 'list-permissions', label: 'صلاحيات القوائم' },

    { key: 'advanced-permissions', label: 'صلاحيات متقدمة' },
   
    { key: 'bank-permissions', label: 'صلاحيات البنوك و الصناديق' },
    { key: 'branch-permissions', label: 'تحديد صلاحيات الإطلاع على الفروع' },
    { key: 'disallowed-accounts', label: 'حسابات غير مسموحة' },

  ];

  const tableData = useMemo(
    () =>
      (auditLogsRes?.data ?? []).map((log, idx) => ({
        id: log.id ?? idx + 1,
        name: log.by ?? '—',
        screenName: log.tableName ?? '—',
        action: log.action ?? '—',
        actionDate: log.at ? new Date(log.at).toLocaleDateString('ar-EG') : '—',
        number: log.rowId ?? '—',
        date: log.at ? new Date(log.at).toLocaleDateString('ar-EG') : '—',
        description: log.requestId ?? '—',
      })),
    [auditLogsRes?.data]
  );

  const auditLogsTotal = auditLogsRes?.pagination?.total ?? auditLogsRes?.meta?.total ?? tableData.length;

  return (
    <div className="min-h-screen bg-white p-6" style={{ direction: 'rtl' }}>
      <div className="mx-auto max-w-7xl">
      <div className="mb-6 text-right">
          <h1 className="mb-1 text-lg font-bold text-[#0E78AA]">إنشاء مجموعات المستخدمين</h1>
          <div className="h-1 w-full rounded bg-sky-700" />
          <p className="mt-2 text-xs text-slate-500">
            مجموعات مسجّلة على الخادم: {groupsRes?.data?.length ?? '…'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className={`${compactControlClass} min-w-[220px]`}
            >
              <option value="">— اختر مجموعة —</option>
              {(groupsRes?.data ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.arabicName}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleDeleteGroup()}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              حذف المجموعة
            </button>
          </div>
      </div>

        {activeSection === 'track-users' ? (
          <div className="mb-3 flex justify-end">
            <Pagination page={page} pageSize={pageSize} total={auditLogsTotal} onPageChange={setPage} />
          </div>
        ) : null}

          <div className="flex items-start gap-6">
            {/* Left Side - Form Inputs */}
            <div className="flex-1">
              {activeSection === 'list-permissions' ? (
                <div className="space-y-3">
                  <FormSectionCard title="تحديد المستخدم" subtitle="الفرع والشركة والمستخدم" icon={Users}>
                    <CompactFormField label="الفرع">
                      <select
                        className={compactControlClass}
                        value={permissionsData.branch}
                        onChange={(e) => handlePermissionsChange('branch', e.target.value)}
                      >
                        <option value="">كل الفروع</option>
                        {companyBranches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.arabicName || b.englishName || b.id}
                          </option>
                        ))}
                      </select>
                    </CompactFormField>
                    <CompactFormField label="الشركة">
                      <select
                        className={compactControlClass}
                        value={permissionsData.company}
                        onChange={(e) => handlePermissionsChange('company', e.target.value)}
                      >
                        <option value="">{companyId ? 'الشركة الحالية' : 'اختر الشركة'}</option>
                      </select>
                    </CompactFormField>
                    <CompactFormField label="إسم المستخدم">
                      <select
                        className={compactControlClass}
                        value={permissionsData.username}
                        onChange={(e) => handlePermissionsChange('username', e.target.value)}
                      >
                        <option value="">اختر المستخدم</option>
                        {(usersRes?.data ?? []).map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username || u.email}
                          </option>
                        ))}
                      </select>
                    </CompactFormField>
                  </FormSectionCard>

                  <FormSectionCard title="الصلاحيات" subtitle="صلاحيات القوائم حسب الشاشة" icon={Shield} bodyClassName="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="overflow-hidden rounded-lg border border-[#E6F0F7]">
                      <div className="bg-[#2366A2] px-3 py-1.5 text-right text-xs font-semibold text-white">الوحدات ({permissionDefs.length})</div>
                      <div className="max-h-80 overflow-y-auto">
                        {permissionDefs.length === 0 && (
                          <div className="px-3 py-2 text-xs text-slate-500">جارٍ تحميل قائمة الشاشات…</div>
                        )}
                        {permissionDefs.map((def) => (
                          <button
                            type="button"
                            key={def.resource}
                            onClick={() => handlePermissionsChange('selectedResource', def.resource)}
                            className={`flex w-full items-center gap-2 border-b px-3 py-1.5 text-right text-xs ${
                              permissionsData.selectedResource === def.resource
                                ? 'bg-[#0E78AA] text-white'
                                : 'text-[#094C6B] hover:bg-gray-50'
                            }`}
                          >
                            <img src="/fluent-emoji_file-folder.svg" alt="" width={16} height={16} />
                            <span className="font-medium">{def.resourceLabel}</span>
                            <span className="flex-1" />
                            {def.module ? <span className="opacity-70">{def.module}</span> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#E6F0F7] p-3">
                      <h3 className="mb-2 text-center text-xs font-semibold text-[#094C6B]">
                        {selectedPermissionDef?.resourceLabel ?? 'اختر شاشة من القائمة'}
                      </h3>
                      <div className="space-y-1">
                        {!selectedPermissionDef && (
                          <div className="text-center text-xs text-slate-500">
                            اختر شاشة لعرض الصلاحيات المتاحة لها
                          </div>
                        )}
                        {selectedPermissionDef?.actions.map(({ action, label }) => (
                          <label
                            key={action}
                            htmlFor={`perm-${action}`}
                            className="flex items-center gap-2 rounded px-2 py-1 text-xs text-[#094C6B] hover:bg-[#F6FBFD]"
                          >
                            <input
                              type="checkbox"
                              id={`perm-${action}`}
                              checked={Boolean(permissionsData.permissions[action])}
                              onChange={(e) =>
                                handlePermissionsChange(`permissions.${action}`, e.target.checked)
                              }
                              className="h-3.5 w-3.5 rounded border-[#D6EAF3] text-[#0E78AA] focus:ring-[#0E79AA]"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </FormSectionCard>
                </div>
              ) : activeSection === 'advanced-permissions' ? (
                <div className="space-y-3">
                  <FormSectionCard title="تحديد المستخدم" subtitle="الفرع والشركة والمستخدم" icon={Users}>
                    <CompactFormField label="الفرع">
                      <select
                        className={compactControlClass}
                        value={advancedPermissionsData.branch}
                        onChange={(e) => handleAdvancedPermissionsChange('branch', e.target.value)}
                      >
                        <option value="">كل الفروع</option>
                        {companyBranches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.arabicName || b.englishName || b.id}
                          </option>
                        ))}
                      </select>
                    </CompactFormField>
                    <CompactFormField label="الشركة">
                      <select
                        className={compactControlClass}
                        value={advancedPermissionsData.company}
                        onChange={(e) => handleAdvancedPermissionsChange('company', e.target.value)}
                      >
                        <option value="">{companyId ? 'الشركة الحالية' : 'اختر الشركة'}</option>
                      </select>
                    </CompactFormField>
                    <CompactFormField label="إسم المستخدم">
                      <select
                        className={compactControlClass}
                        value={advancedPermissionsData.username}
                        onChange={(e) => handleAdvancedPermissionsChange('username', e.target.value)}
                      >
                        <option value="">اختر المستخدم</option>
                        {(usersRes?.data ?? []).map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username || u.email}
                          </option>
                        ))}
                      </select>
                    </CompactFormField>
                  </FormSectionCard>

                  <div className="mb-3 flex items-center gap-4 rounded-xl border border-[#E6F0F7] bg-white px-3 py-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-[#094C6B]">
                      <input
                        type="checkbox"
                        checked={advancedPermissionsData.disallowAllTransfers}
                        onChange={(e) => handleAdvancedPermissionsChange('disallowAllTransfers', e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-[#D6EAF3] text-[#0E78AA] focus:ring-[#0E79AA]"
                      />
                      عدم السماح يرحل الكل
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-[#094C6B]">
                      <input
                        type="checkbox"
                        checked={advancedPermissionsData.allowAllTransfers}
                        onChange={(e) => handleAdvancedPermissionsChange('allowAllTransfers', e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-[#D6EAF3] text-[#0E78AA] focus:ring-[#0E79AA]"
                      />
                      السماح يرحل الكل
                    </label>
                  </div>

                  {!advancedPermissionsData.username ? (
                    <div className="text-center text-gray-500 py-6">اختر مستخدماً لتحميل صلاحيات الترحيل</div>
                  ) : documentFamilies.length === 0 ? (
                    <div className="text-center text-gray-500 py-6">جارٍ تحميل عائلات المستندات…</div>
                  ) : (
                    <FormSectionCard title="الصلاحيات" subtitle="ترحيل وفك ترحيل المستندات" icon={Shield} bodyClassName="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {documentFamilies.map((family) => (
                        <div key={family.key} className="rounded-lg border border-[#D6EAF3] bg-[#E9F4FA] px-3 py-2">
                          <div className="mb-0.5 text-center text-xs font-semibold text-[#0E78AA]">
                            {DOCUMENT_FAMILY_LABELS[family.key] ?? family.legacyPostKey}
                          </div>
                          <div className="mb-2 text-center text-[11px] text-slate-500">
                            {family.wired ? 'مفعّل في النظام' : 'مسجّل — لا شاشة بعد'}
                          </div>
                          <div className="flex items-center justify-between text-xs text-[#094C6B]">
                            <label className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={Boolean(documentRightFlags[family.key])}
                                onChange={(e) => {
                                  setAdvancedPermissionsData((prev) => ({
                                    ...prev,
                                    allowAllTransfers: false,
                                    disallowAllTransfers: false,
                                  }));
                                  setDocumentRightFlags((prev) => ({ ...prev, [family.key]: e.target.checked }));
                                }}
                                className="h-3.5 w-3.5 rounded border-[#D6EAF3] text-[#0E78AA] focus:ring-[#0E79AA]"
                              />
                              ترحيل
                            </label>
                            {family.unpostKey ? (
                              <label className="flex items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={Boolean(documentRightFlags[family.unpostKey])}
                                  onChange={(e) => {
                                    const unpostKey = family.unpostKey as string;
                                    setAdvancedPermissionsData((prev) => ({
                                      ...prev,
                                      allowAllTransfers: false,
                                      disallowAllTransfers: false,
                                    }));
                                    setDocumentRightFlags((prev) => ({ ...prev, [unpostKey]: e.target.checked }));
                                  }}
                                  className="h-3.5 w-3.5 rounded border-[#D6EAF3] text-[#0E78AA] focus:ring-[#0E79AA]"
                                />
                                فك ترحيل
                              </label>
                            ) : (
                              <span className="text-[11px] text-slate-400">لا يوجد فك ترحيل</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </FormSectionCard>
                  )}
                </div>
              ) : activeSection === 'bank-permissions' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6 p-6 bg-white/50 rounded-2xl shadow-lg backdrop-blur-sm">
                    <div className="flex items-center gap-6">
                      <span className="text-[#094C6B] font-medium min-w-[80px] text-base">الشركة</span>
                      <div className="flex-1">
                        <select
                          value={bankPermissionsData.company}
                          onChange={(e) => handleBankPermissionsChange('company', e.target.value)}
                          className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-[#094C6B] focus:outline-none focus:ring-2 focus:ring-[#0E79AA] focus:border-[#0E79AA] transition-colors text-base"
                        >
                          <option value="">{companyId ? 'الشركة الحالية' : 'اختر الشركة'}</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <span className="text-[#094C6B] font-medium min-w-[80px] text-base">إسم المستخدم</span>
                      <div className="flex-1">
                        <select
                          value={bankPermissionsData.username}
                          onChange={(e) => handleBankPermissionsChange('username', e.target.value)}
                          className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-[#094C6B] focus:outline-none focus:ring-2 focus:ring-[#0E79AA] focus:border-[#0E79AA] transition-colors text-base"
                        >
                          <option value="">اختر المستخدم</option>
                          {(usersRes?.data ?? []).map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.username || u.email}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center px-4 pt-4 gap-6">
                      <button
                        type="button"
                        onClick={() => handleBankPermissionsChange('activeTab','funds')}
                        className={`${bankPermissionsData.activeTab==='funds' ? 'text-[#0E78AA] border-b-2 border-[#0E78AA]' : 'text-gray-500'} px-2 pb-2 font-semibold`}
                      >
                        صلاحيات الصناديق
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBankPermissionsChange('activeTab','banks')}
                        className={`${bankPermissionsData.activeTab==='banks' ? 'text-[#0E78AA] border-b-2 border-[#0E78AA]' : 'text-gray-500'} px-2 pb-2 font-semibold`}
                      >
                        صلاحيات البنوك
                      </button>
                    </div>

                    <div className="p-4">
                      <div className="grid grid-cols-[1fr_80px] items-center px-4 py-2 rounded-lg bg-[#0E78AA] text-white font-semibold mb-3">
                        <div className="text-right">{bankPermissionsData.activeTab==='funds' ? 'الصندوق' : 'البنك'}</div>
                        <div className="text-center">متاح</div>
                      </div>
                      {!bankPermissionsData.username ? (
                        <div className="text-center text-gray-500 py-6">اختر مستخدماً لتحميل الصناديق والبنوك</div>
                      ) : (
                        <div className="max-h-80 overflow-y-auto space-y-2">
                          {(bankPermissionsData.activeTab === 'funds' ? liveSafes : liveBankAccounts).length === 0 && (
                            <div className="text-center text-gray-500 py-4">لا توجد بيانات</div>
                          )}
                          {(bankPermissionsData.activeTab === 'funds' ? liveSafes : liveBankAccounts).map((row) => {
                            const checked =
                              bankPermissionsData.activeTab === 'funds'
                                ? Boolean(safeAllowed[row.id])
                                : Boolean(bankAllowed[row.id]);
                            return (
                              <div key={row.id} className="grid grid-cols-[1fr_80px] items-center px-4 py-2 rounded-lg bg-[#E9F4FA]">
                                <div className="text-right text-[#094C6B] font-medium">
                                  {row.arabicName || row.accountNumber || row.code || row.id}
                                </div>
                                <div className="flex items-center justify-center">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      if (bankPermissionsData.activeTab === 'funds') {
                                        setSafeAllowed((prev) => ({ ...prev, [row.id]: e.target.checked }));
                                      } else {
                                        setBankAllowed((prev) => ({ ...prev, [row.id]: e.target.checked }));
                                      }
                                    }}
                                    className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-3">
                        تحديد الكل يبقي المستخدم غير مقيّد. إلغاء تحديد صندوق أو بنك يقيّد الترحيل على المحدد فقط.
                      </p>
                    </div>
                  </div>
                </div>
              ) : activeSection === 'branch-permissions' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6 p-6 bg-white/50 rounded-2xl shadow-lg backdrop-blur-sm">
                    <div className="flex items-center gap-6">
                      <span className="text-[#094C6B] font-medium min-w-[80px] text-base">الشركة</span>
                      <div className="flex-1">
                        <select
                          value={branchPermissionsData.company}
                          onChange={(e) => handleBranchPermissionsChange('company', e.target.value)}
                          className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-[#094C6B] focus:outline-none focus:ring-2 focus:ring-[#0E79AA] focus:border-[#0E79AA] transition-colors text-base"
                        >
                          <option value="">{companyId ? 'الشركة الحالية' : 'اختر الشركة'}</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <span className="text-[#094C6B] font-medium min-w-[80px] text-base">إسم المستخدم</span>
                      <div className="flex-1">
                        <select
                          value={branchPermissionsData.username}
                          onChange={(e) => handleBranchPermissionsChange('username', e.target.value)}
                          className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-[#094C6B] focus:outline-none focus:ring-2 focus:ring-[#0E79AA] focus:border-[#0E79AA] transition-colors text-base"
                        >
                          <option value="">اختر المستخدم</option>
                          {(usersRes?.data ?? []).map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.username || u.email}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <label className="block text-[#094C6B] font-medium mb-3">الفروع المسموح الإطلاع عليها</label>
                    {!branchPermissionsData.username ? (
                      <div className="text-center text-gray-500 py-6">اختر مستخدماً لتحديد الفروع</div>
                    ) : companyBranches.length === 0 ? (
                      <div className="text-center text-gray-500 py-6">لا توجد فروع</div>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {companyBranches.map((branch) => (
                          <label
                            key={branch.id}
                            className="flex items-center justify-between px-4 py-2 rounded-lg bg-[#E9F4FA]"
                          >
                            <span className="text-[#094C6B] font-medium">
                              {branch.arabicName || branch.englishName || branch.id}
                            </span>
                            <input
                              type="checkbox"
                              checked={Boolean(permittedBranchIds[branch.id])}
                              onChange={(e) =>
                                setPermittedBranchIds((prev) => ({ ...prev, [branch.id]: e.target.checked }))
                              }
                              className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-3">
                      تحديد كل الفروع يبقي المستخدم غير مقيّد. إلغاء تحديد فرع يقيّد الإطلاع على المحدد فقط.
                    </p>
                  </div>
                </div>
              ) : activeSection === 'disallowed-accounts' ? (
                <div className="space-y-6">
                  {/* Header Inputs (company, user) */}
                  <div className="grid grid-cols-2 gap-6 p-6 bg-white/50 rounded-2xl shadow-lg backdrop-blur-sm">
                    <div className="flex items-center gap-6">
                      <span className="text-[#094C6B] font-medium min-w-[80px] text-base">الشركة</span>
                      <div className="flex-1">
                        <select className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-[#094C6B] focus:outline-none focus:ring-2 focus:ring-[#0E79AA] focus:border-[#0E79AA] transition-colors text-base">
                          <option value="">اختر الشركة</option>
                          <option value="company1">شركة 1</option>
                          <option value="company2">شركة 2</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-[#094C6B] font-medium min-w-[80px] text-base">إسم المستخدم</span>
                      <div className="flex-1">
                        <select className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-[#094C6B] focus:outline-none focus:ring-2 focus:ring-[#0E79AA] focus:border-[#0E79AA] transition-colors text-base">
                          <option value="">اختر المستخدم</option>
                          <option value="admin">Admin</option>
                          <option value="user1">مستخدم 1</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Mostawa Al-Tasha'ub (Depth) */}
                  <div className="flex items-center gap-4 px-4">
                    <span className="text-sm font-medium text-zinc-800">مستوى التشعب</span>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={disallowedZoomLevel}
                      onChange={(e) => setDisallowedZoomLevel(Number(e.target.value))}
                      className="w-48"
                    />
                    <span className="text-[#0E78AA] text-sm">{disallowedZoomLevel}</span>
                  </div>

                  {/* Tree layout similar to accounts-guide (folders + files) */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Folders (left) */}
                      <div className="border rounded-xl overflow-hidden flex flex-col">
                        <div className="bg-[#2366A2] text-white px-4 py-2 font-semibold text-right sticky top-0 z-10 flex items-center justify-between">
                          <span>المجلدات</span>
                          <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{disallowedFolders.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-1">
                          {disallowedFolders.map((folder) => (
                            <div key={folder.key} className="border-b group">
                              <div className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer group" onClick={() => toggleDisallowedFolder(folder.key)}>
                                <img src="/fluent-emoji_file-folder.svg" alt="folder" width={20} height={20} />
                                <span className="text-black">{folder.label}</span>
                                {('children' in folder) && (
                                  <img src="/bxs_up-arrow.svg" alt="arrow" width={16} height={16} style={{ transform: disallowedOpenFolders[folder.key] ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                                )}
                                <span className="flex-1" />
                                {/* Row action icons (hover only) */}
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <img src="/hugeicons_delete-02.svg" alt="delete" width={18} height={18} style={{ filter: 'invert(32%) sepia(99%) saturate(7492%) hue-rotate(357deg) brightness(97%) contrast(108%)' }} />
                                  <img src="/ic_outline-plus.svg" alt="plus" width={16} height={16} />
                                  <img src="/hugeicons_database-sync-01.svg" alt="db" width={16} height={16} />
                                </div>
                              </div>
                              {folder.children && disallowedOpenFolders[folder.key] && folder.children.map((child) => (
                                <div key={child.key} className="pl-8 flex items-center gap-2 px-4 py-2 border-t hover:bg-gray-50 group">
                                  <img src="/fxemoji_folder.svg" alt="sub-folder" width={20} height={20} />
                                  <span className="text-black">{child.label}</span>
                                  <span className="flex-1" />
                                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <img src="/hugeicons_delete-02.svg" alt="delete" width={18} height={18} style={{ filter: 'invert(32%) sepia(99%) saturate(7492%) hue-rotate(357deg) brightness(97%) contrast(108%)' }} />
                                    <img src="/ic_outline-plus.svg" alt="plus" width={16} height={16} />
                                    <img src="/hugeicons_database-sync-01.svg" alt="db" width={16} height={16} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Files (right) */}
                      <div className="border rounded-xl overflow-hidden flex flex-col">
                        <div className="bg-[#2366A2] text-white px-4 py-2 font-semibold text-right sticky top-0 z-10 flex items-center justify-between">
                          <span>الحسابات</span>
                          <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{disallowedFiles.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-1">
                          {disallowedFiles.map((file, idx) => (
                            <div key={file.key} className={`flex items-center justify-between px-4 py-2 border-b last:border-b-0 group ${idx % 2 === 0 ? 'bg-white' : 'bg-[#F6FBFD]'} hover:bg-gray-50`}>
                              <div className="flex items-center gap-2">
                                <img src="/mdi_file.svg" alt="file" width={20} height={20} />
                                <span className="text-black">{file.label}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                {/* Row action icons (hover only) */}
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <img src="/hugeicons_delete-02.svg" alt="delete" width={18} height={18} style={{ filter: 'invert(32%) sepia(99%) saturate(7492%) hue-rotate(357deg) brightness(97%) contrast(108%)' }} />
                                  <img src="/ic_outline-plus.svg" alt="plus" width={16} height={16} />
                                  <img src="/hugeicons_database-sync-01.svg" alt="db" width={16} height={16} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeSection === 'track-users' ? (
                <div className="space-y-6">
                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button className="bg-[#0E78AA] text-white px-4 py-2 rounded-lg hover:bg-[#094C6B] transition-colors flex items-center gap-2">
                      <span className="text-lg">🔍</span>
                      فلترة
                    </button>
                    <button className="bg-[#0E78AA] text-white px-4 py-2 rounded-lg hover:bg-[#094C6B] transition-colors flex items-center gap-2">
                      <span className="text-lg">📤</span>
                      تصدير
                    </button>
                    <button className="bg-[#0E78AA] text-white px-4 py-2 rounded-lg hover:bg-[#094C6B] transition-colors flex items-center gap-2">
                      <span className="text-lg">👁️</span>
                      معاينة
                    </button>
                    <button className="bg-[#0E78AA] text-white px-4 py-2 rounded-lg hover:bg-[#094C6B] transition-colors flex items-center gap-2">
                      <span className="text-lg">🗑️</span>
                      حذف
                    </button>
                  </div>

                  {/* Filter Form */}
                  <form className="grid grid-cols-2 gap-x-8 gap-y-6 p-6 bg-white/50 rounded-2xl shadow-lg backdrop-blur-sm">
                    {/* Left Column */}
                    <div className="space-y-6">
                      {/* Company */}
                      <div className="flex items-center gap-6">
                        <span className="text-[#094C6B] font-medium min-w-[110px] text-base">الشركة</span>
                        <div className="flex-1">
                          <select 
                            value={trackUsersData.company}
                            onChange={(e) => handleTrackUsersChange('company', e.target.value)}
                            className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-[#094C6B] focus:outline-none focus:ring-2 focus:ring-[#0E79AA] focus:border-[#0E79AA] transition-colors text-base"
                          >
                            <option value="">اختر الشركة</option>
                            <option value="company1">شركة 1</option>
                            <option value="company2">شركة 2</option>
                          </select>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex items-center gap-6">
                        <span className="text-[#094C6B] font-medium min-w-[110px] text-base">الإجراء</span>
                        <div className="flex-1">
                          <select 
                            value={trackUsersData.action}
                            onChange={(e) => handleTrackUsersChange('action', e.target.value)}
                            className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-[#094C6B] focus:outline-none focus:ring-2 focus:ring-[#0E79AA] focus:border-[#0E79AA] transition-colors text-base"
                          >
                            <option value="">اختر الإجراء</option>
                            <option value="create">إنشاء</option>
                            <option value="update">تحديث</option>
                            <option value="delete">حذف</option>
                            <option value="post">ترحيل</option>
                          </select>
                        </div>
                      </div>

                      {/* Record Date */}
                      <div className="space-y-3">
                        <span className="text-[#094C6B] font-medium text-base">تاريخ السجل</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[#094C6B] font-medium text-sm">من تاريخ</span>
                          <div className="flex-1 flex items-center gap-2">
                            <input 
                              type="text" 
                              value={trackUsersData.recordDateFrom}
                              onChange={(e) => handleTrackUsersChange('recordDateFrom', e.target.value)}
                              className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-[#094C6B] focus:outline-none focus:ring-2 focus:ring-[#0E79AA] focus:border-[#0E79AA] transition-colors text-base" 
                            />
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                              <span className="text-gray-600 text-sm">🔍</span>
                            </div>
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                              <span className="text-gray-600 text-sm">📅</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[#094C6B] font-medium text-sm">إلى تاريخ</span>
                          <div className="flex-1 flex items-center gap-2">
                            <input 
                              type="text" 
                              value={trackUsersData.recordDateTo}
                              onChange={(e) => handleTrackUsersChange('recordDateTo', e.target.value)}
                              className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-[#094C6B] focus:outline-none focus:ring-2 focus:ring-[#0E79AA] focus:border-[#0E79AA] transition-colors text-base" 
                            />
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                              <span className="text-gray-600 text-sm">🔍</span>
                            </div>
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                              <span className="text-gray-600 text-sm">📅</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                      {/* Username */}
                      <div className="flex items-center gap-6">
                        <span className="text-[#094C6B] font-medium min-w-[110px] text-base">إسم المستخدم</span>
                        <div className="flex-1">
                          <input 
                            type="text" 
                            placeholder="إدخل إسم المستخدم" 
                            value={trackUsersData.username}
                            onChange={(e) => handleTrackUsersChange('username', e.target.value)}
                            className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-[#094C6B] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0E79AA] focus:border-[#0E79AA] transition-colors text-base" 
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <div className="flex items-center gap-6">
                        <span className="text-[#094C6B] font-medium min-w-[110px] text-base">الشرح</span>
                        <div className="flex-1">
                          <input 
                            type="text" 
                            placeholder="إدخل الشرح" 
                            value={trackUsersData.description}
                            onChange={(e) => handleTrackUsersChange('description', e.target.value)}
                            className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-[#094C6B] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0E79AA] focus:border-[#0E79AA] transition-colors text-base" 
                          />
                        </div>
                      </div>

                      {/* Action Date */}
                      <div className="space-y-3">
                        <span className="text-[#094C6B] font-medium text-base">تاريخ الإجراء</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[#094C6B] font-medium text-sm">من تاريخ</span>
                          <div className="flex-1 flex items-center gap-2">
                            <input 
                              type="text" 
                              value={trackUsersData.actionDateFrom}
                              onChange={(e) => handleTrackUsersChange('actionDateFrom', e.target.value)}
                              className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-[#094C6B] focus:outline-none focus:ring-2 focus:ring-[#0E79AA] focus:border-[#0E79AA] transition-colors text-base" 
                            />
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                              <span className="text-gray-600 text-sm">🔍</span>
                            </div>
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                              <span className="text-gray-600 text-sm">📅</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[#094C6B] font-medium text-sm">إلى تاريخ</span>
                          <div className="flex-1 flex items-center gap-2">
                            <input 
                              type="text" 
                              value={trackUsersData.actionDateTo}
                              onChange={(e) => handleTrackUsersChange('actionDateTo', e.target.value)}
                              className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-[#094C6B] focus:outline-none focus:ring-2 focus:ring-[#0E79AA] focus:border-[#0E79AA] transition-colors text-base" 
                            />
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                              <span className="text-gray-600 text-sm">🔍</span>
                            </div>
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                              <span className="text-gray-600 text-sm">📅</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </form>

                  {/* Data Table */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white px-4 py-3 text-right font-semibold shadow-md border-r border-white/20">م</th>
                            <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white px-4 py-3 text-right font-semibold shadow-md border-r border-white/20">إسم</th>
                            <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white px-4 py-3 text-right font-semibold shadow-md border-r border-white/20">إسم الشاشة</th>
                            <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white px-4 py-3 text-right font-semibold shadow-md border-r border-white/20">الإجراء</th>
                            <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white px-4 py-3 text-right font-semibold shadow-md border-r border-white/20">تاريخ الإجراء</th>
                            <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white px-4 py-3 text-right font-semibold shadow-md border-r border-white/20">رقم</th>
                            <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white px-4 py-3 text-right font-semibold shadow-md border-r border-white/20">تاريخ</th>
                            <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white px-4 py-3 text-right font-semibold shadow-md border-r border-white/20">الشرح</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogsLoading ? (
                            <tr>
                              <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                                جاري تحميل سجل التتبع…
                              </td>
                            </tr>
                          ) : tableData.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                                لا توجد سجلات مطابقة
                              </td>
                            </tr>
                          ) : (
                            tableData.map((row) => (
                            <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="px-4 py-3 text-center text-gray-700">{row.id}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{row.name}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{row.screenName}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{row.action}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{row.actionDate}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{row.number}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{row.date}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{row.description}</td>
                            </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <FormSectionCard title="بيانات المجموعة" subtitle="الاسم وكلمة المرور والمجموعة وقائمة الأسعار" icon={Users}>
                    <CompactFormField
                      label="إسم المرور"
                      placeholder="إدخل إسم المرور"
                      value={formData.passwordName}
                      onChange={(e) => handleInputChange('passwordName', e.target.value)}
                    />
                    <CompactFormField
                      label="الإسم العربي"
                      required
                      placeholder="إدخل الإسم"
                      value={formData.arabicName}
                      onChange={(e) => handleInputChange('arabicName', e.target.value)}
                    />
                    <CompactFormField
                      label="كلمة المرور"
                      type="password"
                      placeholder="إدخل كلمة المرور"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                    />
                    <CompactFormField label="المجموعة">
                      <select
                        className={compactControlClass}
                        value={formData.group}
                        onChange={(e) => handleInputChange('group', e.target.value)}
                      >
                        <option value="الخزينة الرئيسية">الخزينة الرئيسية</option>
                        <option value="المخزن الرئيسي">المخزن الرئيسي</option>
                        <option value="المبيعات">المبيعات</option>
                        <option value="المشتريات">المشتريات</option>
                      </select>
                    </CompactFormField>
                    <CompactFormField label="قائمة الأسعار">
                      <select
                        className={compactControlClass}
                        value={formData.priceList}
                        onChange={(e) => handleInputChange('priceList', e.target.value)}
                      >
                        <option value="">اختر...</option>
                        <option value="retail">تجزئة</option>
                        <option value="wholesale">بالجملة</option>
                      </select>
                    </CompactFormField>
                  </FormSectionCard>

                  <AdvancedFieldsSection title="الصلاحيات" defaultOpen>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {([
                      { id: 'hidePricesInInvoices', label: 'إخفاء الأسعار فى الفواتير' },
                      { id: 'allowChangePaymentValue', label: 'السماح بتغيير قيمة السداد' },
                      { id: 'posManager', label: 'مدير النقاط للبيع' },
                      { id: 'deactivate', label: 'عدم تنشيط' },
                    ] as const).map((item) => (
                      <label
                        key={item.id}
                        htmlFor={item.id}
                        className="flex items-center gap-2 rounded-lg border border-[#E6F0F7] bg-[#F6FBFD] px-3 py-1.5 text-xs font-medium text-[#094C6B]"
                      >
                        <input
                          type="checkbox"
                          id={item.id}
                          checked={formData[item.id]}
                          onChange={(e) => handleInputChange(item.id, e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-[#D6EAF3] text-[#0E78AA] focus:ring-[#0E79AA]"
                        />
                        {item.label}
                      </label>
                    ))}
                    </div>
                  </AdvancedFieldsSection>
                </div>
              )}
            </div>

            <div className="w-64 shrink-0">
              <div className="rounded-xl border border-[#E6F0F7] bg-white p-2 shadow-sm">
                <div className="space-y-1">
                  {sections.map((section) => (
                    <button
                      type="button"
                      key={section.key}
                      onClick={() => setActiveSection(section.key)}
                      className={`w-full rounded-lg px-3 py-2 text-center text-xs font-medium transition-colors ${
                        activeSection === section.key
                          ? 'bg-[#0E78AA] text-white'
                          : 'text-[#094C6B] hover:bg-[#F6FBFD]'
                      }`}
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <FormStickyFooter
            onSave={handleFooterSave}
            onCancel={handleFooterCancel}
            saveLoading={createGroupMutation.isPending}
          />

      {saveError ? <ErrorToast message={saveError} onClose={() => setSaveError('')} /> : null}
      {saveSuccess ? <SuccessToast message={saveSuccess} onClose={() => setSaveSuccess('')} /> : null}
      </div>
    </div>
  );
}
