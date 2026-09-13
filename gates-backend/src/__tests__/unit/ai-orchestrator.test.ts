import type { AIProvider, ChatCompletionResult } from '../../modules/ai/interfaces/ai-provider';
import { MAX_ORCHESTRATOR_TURNS, AiOrchestratorService } from '../../modules/ai/services/ai-orchestrator.service';
import type { AiConversationStore, ConversationActor } from '../../modules/ai/services/ai-conversation.store';
import { AppError } from '../../shared/middleware/error-handler';
import type { AiToolRegistry } from '../../modules/ai/tools/ai-tool-registry';
import type { SecurityContext } from '../../modules/ai/tools/types';

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    company: { findFirst: jest.fn() },
    aiAuditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
  },
}));

const COMPANY_A = '11111111-1111-4111-8111-111111111111';
const COMPANY_B = '22222222-2222-4222-8222-222222222222';
const CONV_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const actor: ConversationActor = { userId: 'user-a', companyId: COMPANY_A, ipAddress: '127.0.0.1' };
const security: SecurityContext = {
  userId: actor.userId,
  companyId: COMPANY_A,
  permissions: ['report:view'],
};

function assistant(overrides: Partial<ChatCompletionResult> = {}): ChatCompletionResult {
  return {
    role: 'assistant',
    content: null,
    finishReason: 'stop',
    model: 'gpt-4o-mini',
    ...overrides,
  };
}

function memoryStore(owner: ConversationActor = actor) {
  const messages: Array<{ role: string; content: string; toolCalls?: unknown; toolCallId?: string }> = [];
  const audits: Array<{ action: string; metadata: Record<string, unknown> }> = [];
  const toolExecutions: Array<{ toolName: string; status: string; executionTimeMs: number }> = [];

  const store = {
    owner,
    messages,
    audits,
    toolExecutions,
    async createConversation(_actor: ConversationActor, title?: string) {
      return { id: CONV_ID, title: title || 'New conversation', userId: owner.userId, companyId: owner.companyId };
    },
    async requireConversation(id: string, who: ConversationActor) {
      if (id !== CONV_ID || who.userId !== owner.userId || who.companyId !== owner.companyId) {
        throw new AppError(404, 'Conversation not found');
      }
      return { id: CONV_ID, title: 'AR', userId: owner.userId, companyId: owner.companyId };
    },
    async appendMessage(
      _id: string,
      role: string,
      content: string,
      toolCalls?: unknown,
      toolCallId?: string
    ) {
      const row = { id: `m-${messages.length + 1}`, role, content, toolCalls: toolCalls ?? null, toolCallId, createdAt: new Date() };
      messages.push(row);
      return row;
    },
    async loadProviderMessages(id: string, who: ConversationActor) {
      await store.requireConversation(id, who);
      return messages.map((row) => ({
        role: row.role as 'user' | 'assistant' | 'tool' | 'system',
        content: row.content,
        toolCalls: Array.isArray(row.toolCalls) ? row.toolCalls : undefined,
        toolCallId: row.toolCallId,
      }));
    },
    async persistAssistant(id: string, content: string | null, toolCalls?: unknown) {
      return store.appendMessage(id, 'assistant', content ?? '', toolCalls);
    },
    async recordToolExecution(input: { toolName: string; status: string; executionTimeMs: number }) {
      toolExecutions.push(input);
      return { id: `exec-${toolExecutions.length}` };
    },
    async audit(_who: ConversationActor, action: string, metadata: Record<string, unknown>) {
      audits.push({ action, metadata });
    },
  };

  return store as typeof store & AiConversationStore;
}

function mockProvider(results: ChatCompletionResult[]): AIProvider {
  const complete = jest.fn();
  for (const result of results) {
    complete.mockResolvedValueOnce(result);
  }
  complete.mockResolvedValue(assistant({ content: 'fallback' }));
  return {
    name: 'mock',
    complete,
    async *stream() {
      yield { deltaContent: 'streamed', finishReason: 'stop' };
    },
  };
}

describe('AiOrchestratorService', () => {
  it('runs a tool-calling loop, persists state, and audits timing', async () => {
    const store = memoryStore();
    const execute = jest.fn().mockResolvedValue({
      ok: true,
      tool: 'getSalesSummary',
      data: { totalSales: 1250000 },
      asOf: '2026-09-07T00:00:00.000Z',
    });
    const registry = {
      functionDefinitions: () => [
        { type: 'function' as const, function: { name: 'getSalesSummary', description: 'sales' } },
      ],
      isAvailable: () => true,
      execute,
    } as unknown as AiToolRegistry;

    const provider = mockProvider([
      assistant({
        finishReason: 'tool_calls',
        toolCalls: [
          {
            id: 'call-1',
            type: 'function',
            function: {
              name: 'getSalesSummary',
              arguments: JSON.stringify({
                fromDate: '2026-09-01',
                toDate: '2026-09-07',
                companyId: COMPANY_B,
              }),
            },
          },
        ],
      }),
      assistant({
        content: 'Fact: 1,250,000.00 EGP from getSalesSummary for 2026-09-01–2026-09-07.',
        finishReason: 'stop',
      }),
    ]);

    const orchestrator = new AiOrchestratorService(provider, registry, store, async () => 'شركة أ');
    const result = await orchestrator.complete(
      { ...actor, conversationId: CONV_ID, message: 'sales this week?' },
      security
    );

    expect(result.conversationId).toBe(CONV_ID);
    expect(result.toolTurns).toBe(1);
    expect(result.message.content).toContain('1,250,000.00 EGP');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toBe('getSalesSummary');
    expect(execute.mock.calls[0][2]).toEqual(expect.objectContaining({ companyId: COMPANY_A, userId: actor.userId }));
    expect(execute.mock.calls[0][2].companyId).not.toBe(COMPANY_B);

    const completeReq = (provider.complete as jest.Mock).mock.calls[0][0];
    expect(completeReq.messages[0].role).toBe('system');
    expect(completeReq.messages[0].content).toContain('Gates Intelligence — CFO & Enterprise Business Assistant');
    expect(completeReq.tools).toEqual(
      expect.arrayContaining([expect.objectContaining({ function: expect.objectContaining({ name: 'getSalesSummary' }) })])
    );

    expect(store.messages.map((row) => row.role)).toEqual(['user', 'assistant', 'tool', 'assistant']);
    expect(store.toolExecutions).toEqual([
      expect.objectContaining({ toolName: 'getSalesSummary', status: 'success' }),
    ]);
    expect(store.toolExecutions[0]?.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(store.audits.map((row) => row.action)).toEqual(['tool.execute', 'chat.complete']);
    expect(store.audits[0]?.metadata).toEqual(
      expect.objectContaining({
        conversationId: CONV_ID,
        toolName: 'getSalesSummary',
        ok: true,
      })
    );
    expect(store.audits[1]?.metadata).toEqual(
      expect.objectContaining({ conversationId: CONV_ID, toolTurns: 1 })
    );
  });

  it('does not let another user continue an owned conversation', async () => {
    const store = memoryStore();
    const orchestrator = new AiOrchestratorService(
      mockProvider([assistant({ content: 'nope' })]),
      { functionDefinitions: () => [], isAvailable: () => true, execute: jest.fn() } as unknown as AiToolRegistry,
      store,
      async () => undefined
    );

    await expect(
      orchestrator.complete(
        {
          userId: 'user-intruder',
          companyId: COMPANY_A,
          conversationId: CONV_ID,
          message: 'show me their numbers',
        },
        { ...security, userId: 'user-intruder' }
      )
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(store.messages).toHaveLength(0);
  });

  it(`forces a final answer after ${MAX_ORCHESTRATOR_TURNS} tool turns`, async () => {
    const store = memoryStore();
    const execute = jest.fn().mockResolvedValue({
      ok: true,
      tool: 'getSalesSummary',
      data: { totalSales: 1 },
      asOf: '2026-09-07T00:00:00.000Z',
    });
    const looping = assistant({
      finishReason: 'tool_calls',
      toolCalls: [
        {
          id: 'call-loop',
          type: 'function',
          function: { name: 'getSalesSummary', arguments: '{}' },
        },
      ],
    });
    const provider = mockProvider([
      looping,
      looping,
      looping,
      assistant({ content: 'Stopping after max turns.', finishReason: 'stop' }),
    ]);

    const orchestrator = new AiOrchestratorService(
      provider,
      {
        functionDefinitions: () => [
          { type: 'function' as const, function: { name: 'getSalesSummary' } },
        ],
        isAvailable: () => true,
        execute,
      } as unknown as AiToolRegistry,
      store,
      async () => undefined
    );

    const result = await orchestrator.complete({ ...actor, conversationId: CONV_ID, message: 'loop' }, security);

    expect(result.toolTurns).toBe(3);
    expect(provider.complete).toHaveBeenCalledTimes(4);
    const lastReq = (provider.complete as jest.Mock).mock.calls[3][0];
    expect(lastReq.toolChoice).toBe('none');
    expect(lastReq.tools).toBeUndefined();
  });

  it('swallows tool execution throws and still returns a final assistant reply', async () => {
    const store = memoryStore();
    const execute = jest.fn().mockRejectedValue(new Error('socket hang up'));
    const provider = mockProvider([
      assistant({
        finishReason: 'tool_calls',
        toolCalls: [
          {
            id: 'call-boom',
            type: 'function',
            function: { name: 'getInventoryStatus', arguments: '{}' },
          },
        ],
      }),
      assistant({ content: 'تعذّر قراءة المخزن.', finishReason: 'stop' }),
    ]);

    const orchestrator = new AiOrchestratorService(
      provider,
      {
        functionDefinitions: () => [
          { type: 'function' as const, function: { name: 'getInventoryStatus' } },
        ],
        isAvailable: () => true,
        execute,
      } as unknown as AiToolRegistry,
      store,
      async () => undefined
    );

    const result = await orchestrator.complete(
      { ...actor, conversationId: CONV_ID, message: 'نواقص المخزن؟' },
      security
    );

    expect(result.message.content).toContain('المخزن');
    expect(result.toolTurns).toBe(1);
    expect(store.messages.some((row) => row.role === 'tool')).toBe(true);
  });
});
