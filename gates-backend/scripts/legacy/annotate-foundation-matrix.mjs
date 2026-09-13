#!/usr/bin/env node
/**
 * annotate-foundation-matrix.mjs — fills the `web_route` / `parity_status` /
 * `review_notes` review columns (left blank by build-parity-matrix.mjs) for
 * every legacy unit owned by the "Delphi parity foundation" plan's Phase 1
 * (untgeneral + untSetting + company/branch/year + permissions + numbering).
 *
 * This is a one-off human-review annotation pass, not a mechanical parser —
 * re-run it after any future `build-parity-matrix.mjs` regeneration (which
 * always resets these three columns to blank) to restore foundation
 * coverage. Non-foundation units are left untouched.
 *
 * Usage: node scripts/legacy/annotate-foundation-matrix.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARITY_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'parity');
const JSON_PATH = path.join(PARITY_DIR, 'legacy-parity-matrix.json');
const CSV_PATH = path.join(PARITY_DIR, 'legacy-parity-matrix.csv');

/**
 * `parity_status` is one of: `ported` (legacy-exact web behavior wired into
 * a live path), `partial` (backend/service exists but a piece — usually an
 * admin UI — is missing), `dropped` (deliberately not converted; see notes).
 */
const ANNOTATIONS = {
  untgeneral: {
    parity_status: 'ported',
    web_route: 'gates-backend/src/modules/platform/services/{document-sequence,fiscal-year,trace-audit}.service.ts',
    review_notes:
      'Create*Num families -> document-sequence.service.ts (legacy-numbering-families.ts registers all ~18; GL+INV wired live). ' +
      'GetPeriod -> fiscal-year.service.ts (resolveForDate/assertOpenForDate, messages 1123/1124). ' +
      'Save_Trace -> trace-audit.service.ts + trace-audit.middleware.ts (customer/supplier/account/item routers only; see docs/parity/foundation-trace-audit.md for the remaining coverage gap).',
  },
  untSetting: {
    parity_status: 'ported',
    web_route: 'gates-backend/src/modules/platform/services/company-setting.service.ts',
    review_notes:
      'Save*Settings procs -> legacy-settings-catalog.json (extraction) + company-setting.service.ts typed engine ' +
      '(getEntry/getFlag/getModuleEntry/getModuleFlag/getModuleEnum, branch-scoped overrides, write/admin API).',
  },
  untcompanyvariables: {
    parity_status: 'ported',
    web_route: 'gates-backend/src/modules/platform/data/legacy-settings-defaults.ts',
    review_notes:
      'set_variables per-key defaults -> legacy-settings-defaults.ts (LEGACY_SETTINGS_DEFAULTS, DYNAMIC_DEFAULT_KEYS for CurrencyCode) ' +
      'consumed via getEntryOrLegacyDefault/getFlagOrLegacyDefault. GL account slots reconciled in accountDefinitions (see foundation-account-slots).',
  },
  untbranchvariables: {
    parity_status: 'ported',
    web_route: 'gates-backend/src/modules/platform/services/advanced-rights.service.ts',
    review_notes:
      'Tbranch.set_variables AdvancedRights load (124-405) -> advanced-rights.service.ts, stored on UserAdvancedPermission.permissions.documentRights. ' +
      'legacy-advanced-rights-families.ts documents all 38 keys; glPost/glUnpost/yearOpen/yearClose wired into live posting paths, remainder registered but not yet call-site-wired.',
  },
  untYear: {
    parity_status: 'ported',
    web_route: 'gates-backend/src/modules/operations/services/year-end-closing.service.ts',
    review_notes:
      'Close/reopen validations ported: earlier-year-must-close-first (1911), unposted-GL (1914), negative-stock (1915), later-year-must-be-closed-to-reopen (1921), ' +
      'plus AdvancedRights yearClose/yearOpen gates. Informational-only legacy messages (1913 cost-recalc notice) intentionally not reproduced (no UX blocker in legacy either).',
  },
  untAdvancedRights: {
    parity_status: 'partial',
    web_route: 'gates-backend/src/modules/platform/services/advanced-rights.service.ts',
    review_notes:
      'Backend CRUD (getDocumentRights/setDocumentRights) and enforcement (canPostFamily/assertCanPostFamily) ported with admin bypass + default-allow-when-unprovisioned. ' +
      "No web admin UI page yet to edit a user's document rights (frmAdvancedRights has no gates-web equivalent) — API-only.",
  },
  untBankBoxRights: {
    parity_status: 'partial',
    web_route: 'gates-backend/src/modules/treasury/{services,routes}/bank-box-rights.*',
    review_notes:
      'listForUser/setForUser ported (mirrors legacy delete-all-then-reinsert save strategy) with CRUD routes at /api/v1/treasury/bank-box-rights/:userId. ' +
      'No web admin UI page yet — API-only.',
  },
  UntUserBranches: {
    parity_status: 'partial',
    web_route: 'gates-backend/src/shared/middleware/tenant-fiscal-context.middleware.ts',
    review_notes:
      'UserBranches allow-list enforcement ported into tenantAndFiscalContextMiddleware (a restricted user is 403\'d outside their explicit UserBranchPermission rows; Admin and zero-row users are unrestricted, matching legacy UserBranchesCond). ' +
      'No web admin UI page to manage a user\'s branch list yet — CRUD is via existing UserBranchPermission API only.',
  },
  untNewModule: {
    parity_status: 'ported',
    web_route: 'gates-web/app/accounting-settings/operations-management/define-new-operation-screens/page.tsx',
    review_notes:
      'NewModule (+ NewModuleStore, OtherModulesRights) -> Prisma model + new-module.service.ts, wired into the previously-unwired define-new-operation-screens page.',
  },
  UntMain: {
    parity_status: 'partial',
    web_route: 'gates-backend/src/modules/users/services/permission-definitions.service.ts',
    review_notes:
      'Menu tree extracted to docs/parity/menu-tree.json (menuItemName/captionEn/hintAr/onClickHandler — the HiddenScreen.MenuItem join key). ' +
      'HiddenScreen itself (GroupId/CompanyCode/BranchCode/MenuItem -> CanNavigate/CanModify/CanAdd/CanDelete/CanPrint) was deliberately reconciled onto the existing ' +
      'UserPermission FGAC model (resource/action) per the plan, not re-created as a literal menu-item-keyed table — permission-definitions.service.ts catalog extended ' +
      '(added print action + missing resources) and UserPermissionsBar.tsx now reads real grants. Per-menu-item (as opposed to per-resource) granularity is not reproduced.',
  },
};

function main() {
  const matrix = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  let updated = 0;
  for (const row of matrix.rows) {
    const ann = ANNOTATIONS[row.unitName];
    if (!ann) continue;
    row.web_route = ann.web_route;
    row.parity_status = ann.parity_status;
    row.review_notes = ann.review_notes;
    updated++;
  }

  const missing = Object.keys(ANNOTATIONS).filter(
    (name) => !matrix.rows.some((r) => r.unitName === name)
  );
  if (missing.length) {
    console.warn(`Warning: unit(s) not found in matrix, skipped: ${missing.join(', ')}`);
  }

  fs.writeFileSync(JSON_PATH, JSON.stringify(matrix, null, 2));
  console.log(`Annotated ${updated}/${Object.keys(ANNOTATIONS).length} foundation-owned units in ${JSON_PATH}`);

  // Rewrite the CSV from the now-annotated JSON, preserving build-parity-matrix.mjs's column order.
  const csvCols = [
    'unit_name', 'pas_path', 'form_name', 'form_class', 'has_dfm', 'dfm_confidence',
    'table_count', 'unknown_table_count', 'tables_mapped_count', 'general_function_call_count',
    'report_template_count', 'procedure_count', 'event_handler_count', 'business_logic_count',
    'menu_caption_ar', 'menu_caption_en', 'extraction_confidence', 'notes', 'web_route',
    'parity_status', 'review_notes',
  ];
  const csvEscape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csvLines = [csvCols.join(',')];
  for (const r of matrix.rows) {
    const menuLink = r.menuLinks[0];
    csvLines.push(
      [
        r.unitName, r.pasPath, r.formName ?? '', r.formClass ?? '', r.dfm ? 'yes' : 'no',
        r.dfm?.confidence ?? '', r.tablesTotalCount, r.pas?.unknownTableCount ?? 0,
        r.tablesMappedCount, r.pas?.generalFunctionCallSiteCount ?? 0, r.reportTemplates.length,
        r.pas?.procedureCount ?? 0, r.pas?.eventHandlerCount ?? 0, r.pas?.businessLogicCount ?? 0,
        menuLink?.hintAr ?? '', menuLink?.captionEn ?? '', r.extractionConfidence, r.notes,
        r.web_route, r.parity_status, r.review_notes,
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  fs.writeFileSync(CSV_PATH, csvLines.join('\n') + '\n');
  console.log(`Rewrote ${CSV_PATH}`);
}

main();
