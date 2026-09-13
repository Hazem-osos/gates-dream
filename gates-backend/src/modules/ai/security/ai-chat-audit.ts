import { AiAuditStatus, Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import type { ConversationActor } from '../services/ai-conversation.store';

export const OUT_OF_SCOPE_REFUSAL_AR =
  'أنا مساعد Gates Intelligence المخصص لعمليات Gates ERP فقط. كيف يمكنني مساعدتك في حساباتك اليوم؟';

export const NO_MATCHING_RECORD_AR =
  'لا توجد بيانات مسجلة مطابقة في شركتكم، أو قد لا تملك صلاحية الاطلاع على هذا السجل';

const FINANCIAL_TOOL_NAMES = new Set([
  'getProfitAndLossSummary',
  'getSalesSummary',
  'getCashAndBankBalances',
  'financial_overview_tool',
  'cfo_what_if_tool',
  'customer_aging_tool',
  'getOverdueReceivables',
  'getSupplierPayables',
  'vendor_payable_tool',
  'cost_center_projects_tool',
  'hr_payroll_tool',
  'getProjectProfitability',
  'wht_report',
  'render_data_visualization',
]);

const FINANCIAL_KEYWORD =
  /قائمة الدخل|قائمة المركز|الميزانية|ضريبة|خصم المنبع|القيمة المضافة|صافي الربح|إجمالي الربح|السيولة|سيولة|مصروفات|التدفقات|WHT|VAT|tax|income statement|balance sheet|payroll|رواتب/i;

export type RecordedToolCall = {
  toolName: string;
  inputParams: unknown;
};

export type RecordedToolResult = {
  toolName: string;
  ok: boolean;
  error?: string;
  data: unknown;
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

export function detectFinancialAdvisory(input: {
  toolNames: string[];
  prompt: string;
  response: string;
}): boolean {
  if (input.toolNames.some((name) => FINANCIAL_TOOL_NAMES.has(name))) return true;
  return FINANCIAL_KEYWORD.test(input.prompt) || FINANCIAL_KEYWORD.test(input.response);
}

export function classifyChatAuditStatus(input: {
  failed?: boolean;
  response: string;
  toolResults: RecordedToolResult[];
}): AiAuditStatus {
  if (input.failed) return AiAuditStatus.FAILED;
  if (input.response.includes(OUT_OF_SCOPE_REFUSAL_AR)) return AiAuditStatus.OUT_OF_SCOPE;
  const denied = input.toolResults.filter((row) => row.error === 'PERMISSION_DENIED');
  if (denied.length && denied.length === input.toolResults.length) {
    return AiAuditStatus.BLOCKED_BY_RBAC;
  }
  return AiAuditStatus.SUCCESS;
}

export async function persistChatAudit(input: {
  actor: ConversationActor;
  userRole?: string;
  currentScreen?: string | null;
  userPrompt: string;
  toolCalls: RecordedToolCall[];
  toolResults: RecordedToolResult[];
  aiResponse: string;
  latencyMs: number;
  tokensUsed?: number;
  failed?: boolean;
  action?: string;
}): Promise<{ status: AiAuditStatus; hasFinancialAdvisory: boolean }> {
  const status = classifyChatAuditStatus({
    failed: input.failed,
    response: input.aiResponse,
    toolResults: input.toolResults,
  });
  const hasFinancialAdvisory = detectFinancialAdvisory({
    toolNames: input.toolCalls.map((row) => row.toolName),
    prompt: input.userPrompt,
    response: input.aiResponse,
  });

  await prisma.aiAuditLog.create({
    data: {
      companyId: input.actor.companyId,
      userId: input.actor.userId,
      userRole: input.userRole?.slice(0, 80) || null,
      currentScreen: input.currentScreen?.slice(0, 500) || null,
      userPrompt: input.userPrompt,
      toolCalls: toJson(input.toolCalls),
      toolResults: toJson(input.toolResults),
      aiResponse: input.aiResponse,
      status,
      latencyMs: input.latencyMs,
      tokensUsed: input.tokensUsed ?? null,
      action: input.action?.slice(0, 80) || 'chat.turn',
      metadata: toJson({ hasFinancialAdvisory }),
      ipAddress: input.actor.ipAddress?.slice(0, 45),
    },
  });

  return { status, hasFinancialAdvisory };
}
