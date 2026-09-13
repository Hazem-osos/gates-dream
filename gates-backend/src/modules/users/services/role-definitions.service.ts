import { logger } from '../../../shared/logger';
import { Permission } from '../../../shared/auth/types';

/**
 * Role Definitions Service
 * Manages role-to-permission mappings
 * Note: Actual roles are managed in Keycloak, but we map them to permissions here
 */

export interface RoleDefinition {
  name: string;
  label: string; // Arabic/English label
  description?: string;
  permissions: Permission[];
  module?: string; // Primary module for this role
  isSystemRole?: boolean; // Whether this is a system-defined role
}

export class RoleDefinitionsService {
  /**
   * Get all role definitions
   * This maps Keycloak roles to system permissions
   */
  getRoleDefinitions(): RoleDefinition[] {
    const definitions: RoleDefinition[] = [
      {
        name: 'admin',
        label: 'مدير النظام',
        description: 'Full access to all system resources',
        isSystemRole: true,
        module: 'system',
        permissions: [
          { resource: '*', action: 'view' },
          { resource: '*', action: 'edit' },
          { resource: '*', action: 'delete' },
          { resource: '*', action: 'approve' },
          { resource: '*', action: 'post' },
        ],
      },
      {
        name: 'accountant',
        label: 'محاسب',
        description: 'Access to accounting module',
        isSystemRole: true,
        module: 'accounting',
        // M22 fix: `journal_entry`/`cost_center`/`price_list`/`employee_contract`
        // below used to be snake_case, but every actual route's `authorize()`
        // call uses kebab-case (`journal-entry.routes.ts`, `cost-center.routes.ts`,
        // `price-list.routes.ts`, `employee-contract.routes.ts`) — any DB
        // permission row seeded from this catalog under the old string would
        // never match the real route's check.
        permissions: [
          { resource: 'account', action: 'view' },
          { resource: 'account', action: 'edit' },
          { resource: 'journal-entry', action: 'view' },
          { resource: 'journal-entry', action: 'edit' },
          { resource: 'journal-entry', action: 'post' },
          { resource: 'journal-entry', action: 'approve' },
          { resource: 'invoice', action: 'view' },
          { resource: 'invoice', action: 'edit' },
          { resource: 'invoice', action: 'approve' },
          { resource: 'invoice', action: 'post' },
          { resource: 'cost-center', action: 'view' },
          { resource: 'cost-center', action: 'edit' },
          { resource: 'customer', action: 'view' },
          { resource: 'customer', action: 'edit' },
          { resource: 'supplier', action: 'view' },
          { resource: 'supplier', action: 'edit' },
        ],
      },
      {
        name: 'hr_manager',
        label: 'مدير الموارد البشرية',
        description: 'Access to HR module',
        isSystemRole: true,
        module: 'hr',
        permissions: [
          { resource: 'employee', action: 'view' },
          { resource: 'employee', action: 'edit' },
          { resource: 'employee', action: 'delete' },
          { resource: 'payroll', action: 'view' },
          { resource: 'payroll', action: 'edit' },
          { resource: 'payroll', action: 'approve' },
          { resource: 'employee-contract', action: 'view' },
          { resource: 'employee-contract', action: 'edit' },
          { resource: 'employee-contract', action: 'delete' },
        ],
      },
      {
        name: 'inventory_manager',
        label: 'مدير المخزون',
        description: 'Access to inventory module',
        isSystemRole: true,
        module: 'inventory',
        permissions: [
          { resource: 'item', action: 'view' },
          { resource: 'item', action: 'edit' },
          { resource: 'item', action: 'delete' },
          { resource: 'invoice', action: 'view' },
          { resource: 'invoice', action: 'edit' },
          { resource: 'invoice', action: 'post' },
          { resource: 'warehouse', action: 'view' },
          { resource: 'warehouse', action: 'edit' },
          { resource: 'warehouse', action: 'delete' },
          { resource: 'unit', action: 'view' },
          { resource: 'unit', action: 'edit' },
          { resource: 'location', action: 'view' },
          { resource: 'location', action: 'edit' },
          { resource: 'price-list', action: 'view' },
          { resource: 'price-list', action: 'edit' },
        ],
      },
      {
        name: 'inventory_viewer',
        label: 'مشاهد المخزون',
        description: 'Read-only access to inventory',
        isSystemRole: true,
        module: 'inventory',
        permissions: [
          { resource: 'item', action: 'view' },
          { resource: 'invoice', action: 'view' },
          { resource: 'warehouse', action: 'view' },
          { resource: 'unit', action: 'view' },
          { resource: 'location', action: 'view' },
          { resource: 'price-list', action: 'view' },
        ],
      },
      {
        name: 'sales_user',
        label: 'موظف مبيعات',
        description: 'Access to sales operations',
        isSystemRole: true,
        module: 'inventory',
        permissions: [
          { resource: 'item', action: 'view' },
          { resource: 'invoice', action: 'view' },
          { resource: 'invoice', action: 'edit' },
          { resource: 'customer', action: 'view' },
          { resource: 'price-list', action: 'view' },
        ],
      },
      {
        name: 'purchase_user',
        label: 'موظف مشتريات',
        description: 'Access to purchase operations',
        isSystemRole: true,
        module: 'inventory',
        permissions: [
          { resource: 'item', action: 'view' },
          { resource: 'invoice', action: 'view' },
          { resource: 'invoice', action: 'edit' },
          { resource: 'supplier', action: 'view' },
          { resource: 'price-list', action: 'view' },
        ],
      },
      {
        name: 'user_manager',
        label: 'مدير المستخدمين',
        description: 'Access to user and permission management',
        isSystemRole: true,
        module: 'system',
        permissions: [
          { resource: 'user', action: 'view' },
          { resource: 'user', action: 'edit' },
          { resource: 'user', action: 'delete' },
          { resource: 'user_group', action: 'view' },
          { resource: 'user_group', action: 'edit' },
          { resource: 'user_group', action: 'delete' },
          { resource: 'user_permission', action: 'view' },
          { resource: 'user_permission', action: 'edit' },
        ],
      },
    ];

    return definitions;
  }

  /**
   * Get role definition by name
   */
  getRoleDefinition(roleName: string): RoleDefinition | null {
    const definitions = this.getRoleDefinitions();
    return definitions.find((def) => def.name === roleName) || null;
  }

  /**
   * Get role definitions filtered by module
   */
  getRoleDefinitionsByModule(module?: string): RoleDefinition[] {
    const allDefinitions = this.getRoleDefinitions();

    if (!module) {
      return allDefinitions;
    }

    return allDefinitions.filter((def) => def.module === module);
  }

  /**
   * Get permissions for a role
   */
  getRolePermissions(roleName: string): Permission[] {
    const role = this.getRoleDefinition(roleName);
    return role ? role.permissions : [];
  }

  /**
   * Get available roles
   */
  getAvailableRoles(module?: string): string[] {
    const definitions = module
      ? this.getRoleDefinitionsByModule(module)
      : this.getRoleDefinitions();

    return definitions.map((def) => def.name).sort();
  }
}

export const roleDefinitionsService = new RoleDefinitionsService();

