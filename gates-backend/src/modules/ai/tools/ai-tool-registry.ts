import type { ChatToolDefinition } from '../interfaces/ai-provider';
import { AI_TOOL_PERMISSION_DENIED_AR, filterAiTools, isAiToolAllowed } from './ai-tool-access';
import type { BaseAiTool } from './base-ai-tool';
import { bindSessionTenant } from './strip-tenant-args';
import type { AiToolResult, SecurityContext } from './types';

export class AiToolRegistry {
  private readonly tools = new Map<string, BaseAiTool>();

  register(tool: BaseAiTool): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): BaseAiTool | undefined {
    return this.tools.get(name);
  }

  list(): BaseAiTool[] {
    return [...this.tools.values()];
  }

  available(context: SecurityContext): BaseAiTool[] {
    return filterAiTools(this.list(), context);
  }

  isAvailable(name: string, context: SecurityContext): boolean {
    const tool = this.tools.get(name);
    return Boolean(tool && isAiToolAllowed(tool, context));
  }

  functionDefinitions(context?: SecurityContext): ChatToolDefinition[] {
    const tools = context ? this.available(context) : this.list();
    return tools.map((tool) => tool.toFunctionDefinition());
  }

  async execute(name: string, rawParams: unknown, context: SecurityContext): Promise<AiToolResult> {
    if (!context.userId?.trim() || !context.companyId?.trim()) {
      return {
        ok: false,
        tool: name,
        error: 'INVALID_CONTEXT',
        message: 'Security context must include userId and companyId from the authenticated request',
      };
    }

    const { sanitizedParams, session } = bindSessionTenant(rawParams, context);
    const pinned: SecurityContext = {
      ...context,
      companyId: session.companyId,
      userId: session.userId,
    };

    const tool = this.tools.get(name);
    if (!tool) {
      return {
        ok: false,
        tool: name,
        error: 'PERMISSION_DENIED',
        message: AI_TOOL_PERMISSION_DENIED_AR,
      };
    }
    if (!isAiToolAllowed(tool, pinned)) {
      return {
        ok: false,
        tool: name,
        error: 'PERMISSION_DENIED',
        message: AI_TOOL_PERMISSION_DENIED_AR,
      };
    }
    try {
      return await tool.execute(sanitizedParams, pinned);
    } catch (error) {
      console.error('[AI Chat Error]', error);
      return {
        ok: false,
        tool: name,
        error: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Tool execution failed',
      };
    }
  }
}
