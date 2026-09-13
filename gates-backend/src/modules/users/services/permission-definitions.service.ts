import { logger } from '../../../shared/logger';
import { Permission } from '../../../shared/auth/types';

/**
 * Permission Definitions Service
 * Provides a catalog of all available permissions in the system
 */

export interface PermissionDefinition {
  resource: string;
  resourceLabel: string; // Arabic/English label
  actions: {
    action: Permission['action'];
    label: string;
    description?: string;
  }[];
  module?: string; // Module this permission belongs to (accounting, inventory, hr, etc.)
  description?: string;
}

const ACTION_LABELS: Record<Permission['action'], string> = {
  view: 'عرض',
  edit: 'تعديل',
  delete: 'حذف',
  approve: 'موافقة',
  post: 'ترحيل',
  print: 'طباعة',
  override_tier_price: 'تجاوز سعر الشريحة',
};

const CRUD: Permission['action'][] = ['view', 'edit', 'delete'];
const READ_ONLY: Permission['action'][] = ['view'];
const EDITABLE: Permission['action'][] = ['view', 'edit'];

/**
 * Resources that live only in route guards. Kept as a flat table rather than
 * spelled-out objects because they carry no information beyond
 * resource/label/module/actions, and the list is long enough that the
 * repetition would bury the hand-written definitions above.
 */
const ROUTE_ONLY_RESOURCES: {
  resource: string;
  label: string;
  module: string;
  actions: Permission['action'][];
}[] = [
  // Accounting
  { resource: 'account-movement', label: 'حركة الحسابات', module: 'accounting', actions: EDITABLE },
  { resource: 'cost-center-movement', label: 'حركة مراكز التكلفة', module: 'accounting', actions: EDITABLE },
  { resource: 'bank', label: 'البنوك', module: 'accounting', actions: CRUD },
  { resource: 'bank-account', label: 'الحسابات البنكية', module: 'accounting', actions: CRUD },
  { resource: 'safe', label: 'الخزائن', module: 'accounting', actions: CRUD },
  { resource: 'delegate', label: 'المناديب', module: 'accounting', actions: CRUD },
  { resource: 'journal', label: 'القيود (ترحيل جماعي واعتماد)', module: 'accounting', actions: ['view', 'edit', 'approve', 'post'] },
  { resource: 'treasury-receipt', label: 'سندات القبض', module: 'treasury', actions: ['view', 'edit', 'post'] },
  { resource: 'treasury-payment', label: 'سندات الصرف', module: 'treasury', actions: ['view', 'edit', 'post'] },
  { resource: 'securities-receipt', label: 'أوراق القبض', module: 'treasury', actions: ['view', 'edit', 'post'] },
  { resource: 'securities-payment', label: 'أوراق الدفع', module: 'treasury', actions: ['view', 'edit', 'post'] },
  { resource: 'securities-renewal', label: 'تجديد الأوراق', module: 'treasury', actions: ['view', 'edit', 'post'] },
  // Inventory
  { resource: 'item-price', label: 'أسعار الأصناف', module: 'inventory', actions: CRUD },
  { resource: 'item-unit', label: 'وحدات الأصناف', module: 'inventory', actions: CRUD },
  { resource: 'item-quantity', label: 'أرصدة الأصناف', module: 'inventory', actions: READ_ONLY },
  // HR
  { resource: 'department', label: 'الإدارات', module: 'hr', actions: CRUD },
  { resource: 'job-title', label: 'المسميات الوظيفية', module: 'hr', actions: CRUD },
  { resource: 'job-cadre', label: 'الكوادر الوظيفية', module: 'hr', actions: CRUD },
  { resource: 'allowance', label: 'البدلات', module: 'hr', actions: CRUD },
  { resource: 'deduction', label: 'الخصومات', module: 'hr', actions: CRUD },
  { resource: 'monthly-salary', label: 'الرواتب الشهرية', module: 'hr', actions: CRUD },
  { resource: 'wage-policy', label: 'سياسات الأجور', module: 'hr', actions: CRUD },
  { resource: 'employee-advance', label: 'سلف الموظفين', module: 'hr', actions: CRUD },
  { resource: 'employee-procedure', label: 'إجراءات الموظفين', module: 'hr', actions: CRUD },
  { resource: 'city', label: 'المدن', module: 'hr', actions: CRUD },
  { resource: 'nationality', label: 'الجنسيات', module: 'hr', actions: CRUD },
  { resource: 'religion', label: 'الديانات', module: 'hr', actions: CRUD },
  { resource: 'marital-status', label: 'الحالات الاجتماعية', module: 'hr', actions: CRUD },
  // Contracting / extracts
  { resource: 'project', label: 'المشروعات', module: 'contracting', actions: CRUD },
  { resource: 'project-building', label: 'مباني المشروعات', module: 'contracting', actions: CRUD },
  { resource: 'project-work-item', label: 'بنود أعمال المشروعات', module: 'contracting', actions: CRUD },
  { resource: 'project-measurement-definition', label: 'تعريف الحصر', module: 'contracting', actions: CRUD },
  { resource: 'contractor', label: 'المقاولون', module: 'contracting', actions: CRUD },
  { resource: 'contractor-assignment', label: 'إسناد المقاولين', module: 'contracting', actions: CRUD },
  { resource: 'manpower-log', label: 'سجل العمالة', module: 'contracting', actions: CRUD },
  // Trade / import-export
  { resource: 'import-export', label: 'الاستيراد والتصدير', module: 'trade', actions: EDITABLE },
  { resource: 'import-export-report', label: 'تقارير الاستيراد والتصدير', module: 'trade', actions: READ_ONLY },
  { resource: 'documentary-credit', label: 'الاعتمادات المستندية', module: 'trade', actions: CRUD },
  { resource: 'documentary-credit-definition', label: 'تعريف الاعتمادات', module: 'trade', actions: CRUD },
  { resource: 'letter-of-guarantee', label: 'خطابات الضمان', module: 'trade', actions: CRUD },
  { resource: 'letter-of-guarantee-settings', label: 'إعدادات خطابات الضمان', module: 'trade', actions: EDITABLE },
  // Other verticals
  { resource: 'property', label: 'العقارات', module: 'real-estate', actions: EDITABLE },
  { resource: 'sensor', label: 'الحساسات', module: 'manufacturing', actions: READ_ONLY },
  { resource: 'electronic-invoice', label: 'الفاتورة الإلكترونية', module: 'e-invoice', actions: CRUD },
  // System
  { resource: 'system-setting', label: 'إعدادات النظام', module: 'system', actions: CRUD },
  { resource: 'operations-management', label: 'إدارة العمليات', module: 'system', actions: CRUD },
  { resource: 'database-tool', label: 'أدوات قاعدة البيانات', module: 'system', actions: EDITABLE },
  { resource: 'translation', label: 'الترجمات', module: 'system', actions: EDITABLE },
  { resource: 'activity-log', label: 'سجل النشاط', module: 'system', actions: READ_ONLY },
  { resource: 'audit-log', label: 'سجل المراجعة', module: 'system', actions: READ_ONLY },
  { resource: 'growth', label: 'محرك النمو', module: 'analytics', actions: EDITABLE },
];

export class PermissionDefinitionsService {
  /**
   * Get all available permission definitions
   * This is a static catalog of all permissions in the system
   */
  getPermissionDefinitions(): PermissionDefinition[] {
    const definitions: PermissionDefinition[] = [
      // Accounting Module
      {
        resource: 'account',
        resourceLabel: 'الحسابات',
        module: 'accounting',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        // M22 fix: was `journal_entry` — the actual route
        // (`journal-entry.routes.ts`) authorizes against the kebab-case
        // `'journal-entry'`, so this catalog entry never matched any real
        // check (and any DB permission row seeded from this catalog would
        // silently fail to authorize the real route).
        resource: 'journal-entry',
        resourceLabel: 'سند قيد يومية',
        module: 'accounting',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
          { action: 'approve', label: 'موافقة' },
          { action: 'post', label: 'ترحيل' },
        ],
      },
      {
        // M22 fix: aligned to the route's resource string (see
        // `cost-center.routes.ts`, itself fixed from the camelCase
        // `'costCenter'` it used to authorize against).
        resource: 'cost-center',
        resourceLabel: 'مراكز التكلفة',
        module: 'accounting',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        // `print` is enforced today on `GET /customers/export` (CSV/Excel/PDF),
        // the server-side half of the legacy `HiddenScreen.CanPrint` flag.
        resource: 'customer',
        resourceLabel: 'العملاء',
        module: 'accounting',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
          { action: 'print', label: 'طباعة' },
        ],
      },
      {
        resource: 'supplier',
        resourceLabel: 'الموردين',
        module: 'accounting',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        resource: 'currency',
        resourceLabel: 'العملات',
        module: 'accounting',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        resource: 'period',
        resourceLabel: 'الفترات',
        module: 'accounting',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      // Inventory Module
      {
        resource: 'item',
        resourceLabel: 'الأصناف',
        module: 'inventory',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        resource: 'invoice',
        resourceLabel: 'الفواتير',
        module: 'inventory',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
          { action: 'approve', label: 'موافقة' },
          { action: 'post', label: 'ترحيل' },
          { action: 'override_tier_price', label: 'تجاوز سعر الشريحة' },
        ],
      },
      {
        resource: 'warehouse',
        resourceLabel: 'المخازن',
        module: 'inventory',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        resource: 'unit',
        resourceLabel: 'الوحدات',
        module: 'inventory',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        resource: 'location',
        resourceLabel: 'المواقع',
        module: 'inventory',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        // M22 fix: aligned to the route's resource string (`price-list.routes.ts`).
        resource: 'price-list',
        resourceLabel: 'قوائم الأسعار',
        module: 'inventory',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        // Zero-defect Wave 0: route was authenticated-only with no FGAC check at all.
        resource: 'customer-contract',
        resourceLabel: 'عقود العملاء',
        module: 'inventory',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      // HR Module
      {
        resource: 'employee',
        resourceLabel: 'الموظفين',
        module: 'hr',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        resource: 'payroll',
        resourceLabel: 'الرواتب',
        module: 'hr',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'approve', label: 'موافقة' },
        ],
      },
      {
        // M22 fix: aligned to the route's resource string (`employee-contract.routes.ts`).
        resource: 'employee-contract',
        resourceLabel: 'عقود الموظفين',
        module: 'hr',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      // Company & User Management
      {
        resource: 'company',
        resourceLabel: 'الشركات',
        module: 'system',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        resource: 'branch',
        resourceLabel: 'الفروع',
        module: 'system',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        resource: 'user',
        resourceLabel: 'المستخدمين',
        module: 'system',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        resource: 'user_group',
        resourceLabel: 'مجموعات المستخدمين',
        module: 'system',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        resource: 'user_permission',
        resourceLabel: 'صلاحيات المستخدمين',
        module: 'system',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
        ],
      },
      {
        resource: 'document-layout',
        resourceLabel: 'تخصيص طباعة المستندات',
        module: 'system',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        resource: 'document-profile',
        resourceLabel: 'أنماط ووحدات الإدخال المخصصة',
        module: 'system',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        // Legacy NewModule/NewModuleStore/OtherModulesRights registry.
        resource: 'new-module',
        resourceLabel: 'تعريف شاشات العمليات الجديدة',
        module: 'system',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        // Legacy CompanySetting EAV admin API (company-setting.service.ts).
        resource: 'company-setting',
        resourceLabel: 'إعدادات الشركة العامة',
        module: 'system',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      // Treasury Module
      {
        resource: 'treasury',
        resourceLabel: 'الخزينة والبنوك',
        module: 'treasury',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
          { action: 'post', label: 'ترحيل' },
          { action: 'print', label: 'طباعة' },
        ],
      },
      // Reports (cross-module)
      {
        resource: 'report',
        resourceLabel: 'التقارير',
        module: 'reports',
        actions: [
          { action: 'view', label: 'عرض' },
          // Report caches can be resynced (`/party-balance-reconciliation/resync`).
          { action: 'edit', label: 'تعديل' },
          { action: 'print', label: 'طباعة' },
        ],
      },
      // POS Module
      {
        resource: 'pos',
        resourceLabel: 'نقاط البيع',
        module: 'pos',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'post', label: 'ترحيل' },
        ],
      },
      // Extracts (contracting client/subcontractor extracts)
      {
        resource: 'extract',
        resourceLabel: 'المستخلصات',
        module: 'contracting',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
          { action: 'post', label: 'ترحيل' },
        ],
      },
      // Archive Module
      {
        resource: 'archive',
        resourceLabel: 'الأرشيف',
        module: 'system',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        resource: 'item-category',
        resourceLabel: 'فئات الأصناف',
        module: 'inventory',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        resource: 'api-key',
        resourceLabel: 'مفاتيح الـ API',
        module: 'system',
        actions: [
          { action: 'view', label: 'عرض' },
          { action: 'edit', label: 'تعديل' },
          { action: 'delete', label: 'حذف' },
        ],
      },
      {
        resource: 'job',
        resourceLabel: 'المهام المجدولة',
        module: 'system',
        actions: [{ action: 'view', label: 'عرض' }],
      },
      // ── Resources that routes already authorize against ───────────────────
      // Anything a route checks but this catalog omits is un-grantable: the
      // admin UI is driven by this list, so a non-admin user could never be
      // given access to it at all. These close that gap, each with the action
      // set its routes actually check.
      ...ROUTE_ONLY_RESOURCES.map(({ resource, label, module, actions }) => ({
        resource,
        resourceLabel: label,
        module,
        actions: actions.map((action) => ({ action, label: ACTION_LABELS[action] })),
      })),
    ];

    return definitions;
  }

  /**
   * Get permission definitions filtered by module
   */
  getPermissionDefinitionsByModule(module?: string): PermissionDefinition[] {
    const allDefinitions = this.getPermissionDefinitions();

    if (!module) {
      return allDefinitions;
    }

    return allDefinitions.filter((def) => def.module === module);
  }

  /**
   * Get available modules
   */
  getModules(): string[] {
    const definitions = this.getPermissionDefinitions();
    const modules = new Set<string>();

    definitions.forEach((def) => {
      if (def.module) {
        modules.add(def.module);
      }
    });

    return Array.from(modules).sort();
  }

  /**
   * Get available resources
   */
  getResources(module?: string): string[] {
    const definitions = module
      ? this.getPermissionDefinitionsByModule(module)
      : this.getPermissionDefinitions();

    return definitions.map((def) => def.resource).sort();
  }

  /**
   * Get available actions for a resource
   */
  getResourceActions(resource: string): Permission['action'][] {
    const definitions = this.getPermissionDefinitions();
    const definition = definitions.find((def) => def.resource === resource);

    if (!definition) {
      return [];
    }

    return definition.actions.map((action) => action.action);
  }
}

export const permissionDefinitionsService = new PermissionDefinitionsService();

