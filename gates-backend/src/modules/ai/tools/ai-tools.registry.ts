/**
 * Named registry surface for scoped AI tools (RBAC + dynamic masking).
 * Execution still goes through `AiToolRegistry` / `BaseAiTool`.
 */
export {
  AI_TOOL_PERMISSION_DENIED_AR,
  CFO_DECISION_ROLES,
  FINANCIAL_DIRECTOR_ROLES,
  OWNER_ROLES,
  extractJwtRoles,
  filterAiTools,
  isAiToolAllowed,
  type AiToolAccessMeta,
} from './ai-tool-access';
export { AiToolRegistry } from './ai-tool-registry';
