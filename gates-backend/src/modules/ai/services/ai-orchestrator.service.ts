import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { getPublicAiConfig } from '../config/ai.config';
import type {
  AIProvider,
  ChatCompletionResult,
  ChatMessage,
  ChatToolCall,
} from '../interfaces/ai-provider';
import {
  buildGatesIntelligenceSystemPrompt,
  type AiClientContext,
} from '../prompts/gates-intelligence-prompt';
import {
  persistChatAudit,
  type RecordedToolCall,
  type RecordedToolResult,
} from '../security/ai-chat-audit';
import { AI_TOOL_PERMISSION_DENIED_AR } from '../tools/ai-tool-access';
import type { AiToolRegistry } from '../tools/ai-tool-registry';
import { stripTenantArgs } from '../tools/strip-tenant-args';
import type { AiToolResult, SecurityContext } from '../tools/types';
import {
  aiConversationStore,
  type ConversationActor,
  type PersistedAssistant,
  type AiConversationStore,
} from './ai-conversation.store';

export const MAX_ORCHESTRATOR_TURNS = 4;
const TOOL_RESULT_CHAR_LIMIT = 12_000;

export type OrchestratorInput = ConversationActor & {
  conversationId?: string;
  message: string;
  title?: string;
  userLabel?: string;
  clientContext?: AiClientContext;
};

export type OrchestratorResult = {
  conversationId: string;
  message: PersistedAssistant;
  finishReason: string | null;
  model: string;
  toolTurns: number;
  hasFinancialAdvisory: boolean;
};

export type OrchestratorStreamEvent = {
  conversationId: string;
  chunk?: { content?: string };
  tool?: { name: string; ok: boolean };
  done?: OrchestratorResult;
};

export type CompanyNameResolver = (companyId: string) => Promise<string | undefined>;

function asTitle(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return 'New conversation';
  return compact.length > 80 ? `${compact.slice(0, 77)}...` : compact;
}

function parseToolArgs(raw: string): unknown {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return { raw };
  }
}

function redactToolPayload(value: unknown): unknown {
  const json = JSON.stringify(value);
  if (json.length <= TOOL_RESULT_CHAR_LIMIT) return value;
  return { truncated: true, preview: json.slice(0, TOOL_RESULT_CHAR_LIMIT) };
}

function extractVisualization(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const data = root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : root;
  const viz = data.visualizationPayload;
  if (data.isVisualization === true && viz && typeof viz === 'object') {
    return { isVisualization: true, visualizationPayload: viz };
  }
  return null;
}

function embedVisualizationJson(content: string | null, visualizations: Record<string, unknown>[]): string {
  const last = visualizations[visualizations.length - 1];
  if (!last) return content ?? '';
  const text = content ?? '';
  if (text.includes('"isVisualization"') || text.includes('"visualizationPayload"')) {
    return text;
  }
  return `${text.trim()}\n\n\`\`\`json\n${JSON.stringify(last)}\n\`\`\``.trim();
}

function argumentKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>).filter(
    (key) =>
      !['companyId', 'tenantId', 'company_id', 'tenant_id', 'companyID', 'tenantID', 'userId', 'user_id', 'userID'].includes(
        key
      )
  );
}

function asToolTraceResult(name: string, payload: unknown): RecordedToolResult {
  const result = payload as AiToolResult;
  return {
    toolName: name,
    ok: result?.ok === true,
    error: result && result.ok === false ? result.error : undefined,
    data: payload,
  };
}

async function resolveFiscalYearName(
  companyId: string,
  fiscalYearId?: string
): Promise<string> {
  if (!fiscalYearId) return 'السنة الحالية';
  try {
    const year = await prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, companyId },
      select: { arabicName: true, englishName: true, legacyYearId: true },
    });
    return year?.arabicName || year?.englishName || year?.legacyYearId || 'السنة الحالية';
  } catch {
    return 'السنة الحالية';
  }
}

async function defaultCompanyName(companyId: string): Promise<string | undefined> {
  try {
    const company = await prisma.company.findFirst({
      where: { id: companyId },
      select: { arabicName: true, englishName: true },
    });
    return company?.arabicName || company?.englishName || undefined;
  } catch {
    return undefined;
  }
}

export class AiOrchestratorService {
  constructor(
    private readonly provider: AIProvider,
    private readonly registry: AiToolRegistry,
    private readonly store: AiConversationStore = aiConversationStore,
    private readonly resolveCompanyName: CompanyNameResolver = defaultCompanyName
  ) {}

  async complete(input: OrchestratorInput, security: SecurityContext): Promise<OrchestratorResult> {
    const started = Date.now();
    const trace = { calls: [] as RecordedToolCall[], results: [] as RecordedToolResult[] };
    try {
      const conversation = await this.resolveConversation(input);
      await this.store.appendMessage(conversation.id, 'user', input.message);
      const { last, toolTurns, visualizations } = await this.runToolLoop(
        conversation.id,
        input,
        security,
        trace
      );
      const content = embedVisualizationJson(last.content, visualizations);
      const assistant = await this.store.persistAssistant(conversation.id, content);
      await this.store.audit(input, 'chat.complete', {
        conversationId: conversation.id,
        latencyMs: Date.now() - started,
        finishReason: last.finishReason,
        toolTurns,
      });
      const audit = await this.recordTurn(input, security, content, started, trace);
      return {
        conversationId: conversation.id,
        message: assistant,
        finishReason: last.finishReason,
        model: last.model,
        toolTurns,
        hasFinancialAdvisory: audit.hasFinancialAdvisory,
      };
    } catch (error) {
      await this.recordTurn(
        input,
        security,
        error instanceof Error ? error.message : 'تعذّر توليد رد Gates Intelligence',
        started,
        trace,
        true
      ).catch((persistError) => console.error('[AI Chat Error]', persistError));
      if (!(error instanceof AppError) || error.statusCode >= 500) {
        console.error('[AI Chat Error]', error);
      }
      if (error instanceof AppError) throw error;
      throw new AppError(
        500,
        error instanceof Error ? error.message : 'تعذّر توليد رد Gates Intelligence'
      );
    }
  }

  async *stream(
    input: OrchestratorInput,
    security: SecurityContext
  ): AsyncGenerator<OrchestratorStreamEvent> {
    const started = Date.now();
    const trace = { calls: [] as RecordedToolCall[], results: [] as RecordedToolResult[] };
    try {
      const conversation = await this.resolveConversation(input);
      await this.store.appendMessage(conversation.id, 'user', input.message);

    const messages = await this.seedMessages(conversation.id, input, security);
    const tools = this.registry.functionDefinitions(security);
    let last: ChatCompletionResult = {
      role: 'assistant',
      content: null,
      finishReason: null,
      model: getPublicAiConfig().model,
    };
    let toolTurns = 0;
    const visualizations: Record<string, unknown>[] = [];

    for (let turn = 0; turn < MAX_ORCHESTRATOR_TURNS; turn += 1) {
      const forceFinal = turn === MAX_ORCHESTRATOR_TURNS - 1;
      const buffered: ChatToolCall[] = [];
      let content = '';
      let finishReason: string | null = null;

      for await (const chunk of this.provider.stream({
        messages,
        tools: forceFinal ? undefined : tools,
        toolChoice: forceFinal ? 'none' : 'auto',
      })) {
        if (chunk.deltaContent) {
          content += chunk.deltaContent;
          if (!buffered.length) {
            yield { conversationId: conversation.id, chunk: { content: chunk.deltaContent } };
          }
        }
        for (const delta of chunk.deltaToolCalls ?? []) {
          const existing = buffered[delta.index] ?? {
            id: '',
            type: 'function' as const,
            function: { name: '', arguments: '' },
          };
          if (delta.id) existing.id = delta.id;
          if (delta.name) existing.function.name += delta.name;
          if (delta.arguments) existing.function.arguments += delta.arguments;
          buffered[delta.index] = existing;
        }
        if (chunk.finishReason) finishReason = chunk.finishReason;
      }

      const toolCalls = buffered.filter((call) => call?.id && call.function.name);
      last = {
        role: 'assistant',
        content: content || null,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        finishReason,
        model: getPublicAiConfig().model,
      };

      if (!toolCalls.length) break;

      toolTurns += 1;
      messages.push({ role: 'assistant', content: last.content, toolCalls });
      await this.store.appendMessage(conversation.id, 'assistant', last.content ?? '', toolCalls);

      for (const call of toolCalls) {
        const result = await this.executeOneTool(conversation.id, input, security, call, trace);
        const visualization = extractVisualization(result.payload);
        if (visualization) visualizations.push(visualization);
        yield { conversationId: conversation.id, tool: { name: call.function.name, ok: result.ok } };
        const payload = redactToolPayload(result.payload);
        messages.push({
          role: 'tool',
          content: JSON.stringify(payload),
          toolCallId: call.id,
          name: call.function.name,
        });
        await this.store.appendMessage(
          conversation.id,
          'tool',
          JSON.stringify(payload),
          undefined,
          call.id
        );
      }
    }

    const content = embedVisualizationJson(last.content, visualizations);
    const assistant = await this.store.persistAssistant(conversation.id, content);
    await this.store.audit(input, 'chat.stream', {
      conversationId: conversation.id,
      latencyMs: Date.now() - started,
      finishReason: last.finishReason,
      toolTurns,
    });
    const audit = await this.recordTurn(input, security, content, started, trace);

    yield {
      conversationId: conversation.id,
      done: {
        conversationId: conversation.id,
        message: assistant,
        finishReason: last.finishReason,
        model: last.model,
        toolTurns,
        hasFinancialAdvisory: audit.hasFinancialAdvisory,
      },
    };
    } catch (error) {
      await this.recordTurn(
        input,
        security,
        error instanceof Error ? error.message : 'تعذّر توليد رد Gates Intelligence',
        started,
        trace,
        true
      ).catch((persistError) => console.error('[AI Chat Error]', persistError));
      if (!(error instanceof AppError) || error.statusCode >= 500) {
        console.error('[AI Chat Error]', error);
      }
      if (error instanceof AppError) throw error;
      throw new AppError(
        500,
        error instanceof Error ? error.message : 'تعذّر توليد رد Gates Intelligence'
      );
    }
  }

  private async runToolLoop(
    conversationId: string,
    actor: ConversationActor,
    security: SecurityContext,
    trace: { calls: RecordedToolCall[]; results: RecordedToolResult[] }
  ): Promise<{ last: ChatCompletionResult; toolTurns: number; visualizations: Record<string, unknown>[] }> {
    const messages = await this.seedMessages(conversationId, actor, security);
    const tools = this.registry.functionDefinitions(security);
    let last: ChatCompletionResult = {
      role: 'assistant',
      content: null,
      finishReason: null,
      model: getPublicAiConfig().model,
    };
    let toolTurns = 0;
    const visualizations: Record<string, unknown>[] = [];

    for (let turn = 0; turn < MAX_ORCHESTRATOR_TURNS; turn += 1) {
      const forceFinal = turn === MAX_ORCHESTRATOR_TURNS - 1;
      last = await this.provider.complete({
        messages,
        tools: forceFinal ? undefined : tools,
        toolChoice: forceFinal ? 'none' : 'auto',
      });

      if (!last.toolCalls?.length) {
        return { last, toolTurns, visualizations };
      }

      toolTurns += 1;
      messages.push({
        role: 'assistant',
        content: last.content,
        toolCalls: last.toolCalls,
      });
      await this.store.appendMessage(conversationId, 'assistant', last.content ?? '', last.toolCalls);

      for (const call of last.toolCalls) {
        const result = await this.executeOneTool(conversationId, actor, security, call, trace);
        const visualization = extractVisualization(result.payload);
        if (visualization) visualizations.push(visualization);
        const payload = redactToolPayload(result.payload);
        messages.push({
          role: 'tool',
          content: JSON.stringify(payload),
          toolCallId: call.id,
          name: call.function.name,
        });
        await this.store.appendMessage(
          conversationId,
          'tool',
          JSON.stringify(payload),
          undefined,
          call.id
        );
      }
    }

    last = await this.provider.complete({ messages, toolChoice: 'none' });
    return { last, toolTurns, visualizations };
  }

  private async seedMessages(
    conversationId: string,
    actor: ConversationActor & { userLabel?: string; clientContext?: AiClientContext },
    security: SecurityContext
  ): Promise<ChatMessage[]> {
    const history = await this.store.loadProviderMessages(conversationId, actor);
    const [companyName, fiscalYearName] = await Promise.all([
      this.resolveCompanyName(security.companyId),
      resolveFiscalYearName(security.companyId, security.fiscalYearId),
    ]);
    const system = security.boundCustomerId
      ? [
          `You are Gates Intelligence customer assistant for ${companyName}.`,
          `This chat is bound to customer ${security.boundCustomerId} only.`,
          'Use only getCustomerStatement, prepareCreateQuotation, and searchCompanyDocuments.',
          `Always pass customerId=${security.boundCustomerId}. Never query another customer.`,
          'Quotations are drafts only — tell the customer sales will confirm in Gates ERP.',
          'Reply in the user language.',
        ].join('\n')
      : buildGatesIntelligenceSystemPrompt({
          companyName,
          companyId: security.companyId,
          userLabel: actor.userLabel,
          role: security.role || security.roles?.[0],
          permissions: security.permissions,
          fiscalYearName,
          clientContext: actor.clientContext,
        });
    return [
      { role: 'system', content: system },
      ...history.filter((row) => row.role !== 'system'),
    ];
  }

  private async executeOneTool(
    conversationId: string,
    actor: ConversationActor,
    security: SecurityContext,
    call: ChatToolCall,
    trace: { calls: RecordedToolCall[]; results: RecordedToolResult[] }
  ): Promise<{ ok: boolean; payload: unknown }> {
    const started = Date.now();
    const args = parseToolArgs(call.function.arguments);
    const record = (payload: unknown, ok: boolean) => {
      trace.calls.push({ toolName: call.function.name, inputParams: stripTenantArgs(args) });
      trace.results.push(asToolTraceResult(call.function.name, payload));
      return { ok, payload };
    };
    try {
      if (!this.registry.isAvailable(call.function.name, security)) {
        const denied = {
          ok: false as const,
          tool: call.function.name,
          error: 'PERMISSION_DENIED' as const,
          message: AI_TOOL_PERMISSION_DENIED_AR,
        };
        try {
          await this.store.recordToolExecution({
            conversationId,
            toolName: call.function.name,
            inputArgs: args,
            outputResult: denied,
            status: 'error',
            executionTimeMs: Date.now() - started,
          });
          await this.store.audit(actor, 'tool.execute', {
            conversationId,
            toolName: call.function.name,
            ok: false,
            denied: true,
            latencyMs: Date.now() - started,
            argumentKeys: argumentKeys(args),
          });
        } catch (persistError) {
          console.error('[AI Chat Error]', persistError);
        }
        return record(denied, false);
      }
      const result = await this.registry.execute(call.function.name, args, {
        ...security,
        conversationId,
        companyId: security.companyId,
        userId: security.userId,
      });
      const executionTimeMs = Date.now() - started;
      try {
        await this.store.recordToolExecution({
          conversationId,
          toolName: call.function.name,
          inputArgs: args,
          outputResult: result,
          status: result.ok ? 'success' : 'error',
          executionTimeMs,
        });
        await this.store.audit(actor, 'tool.execute', {
          conversationId,
          toolName: call.function.name,
          ok: result.ok,
          latencyMs: executionTimeMs,
          argumentKeys: argumentKeys(args),
        });
      } catch (persistError) {
        console.error('[AI Chat Error]', persistError);
      }
      return record(result, result.ok);
    } catch (error) {
      console.error('[AI Chat Error]', error);
      return record(
        {
          ok: false,
          tool: call.function.name,
          error: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Tool execution failed',
        },
        false
      );
    }
  }

  private async recordTurn(
    input: OrchestratorInput,
    security: SecurityContext,
    aiResponse: string,
    started: number,
    trace: { calls: RecordedToolCall[]; results: RecordedToolResult[] },
    failed = false
  ) {
    try {
      return await persistChatAudit({
        actor: input,
        userRole: security.role || security.roles?.[0],
        currentScreen: input.clientContext?.currentPath ?? null,
        userPrompt: input.message,
        toolCalls: trace.calls,
        toolResults: trace.results,
        aiResponse,
        latencyMs: Date.now() - started,
        failed,
      });
    } catch (error) {
      console.error('[AI Chat Error]', error);
      return { hasFinancialAdvisory: false, status: 'FAILED' as const };
    }
  }

  private async resolveConversation(input: OrchestratorInput) {
    if (input.conversationId) {
      return this.store.requireConversation(input.conversationId, input);
    }
    return this.store.createConversation(input, input.title || asTitle(input.message));
  }
}
