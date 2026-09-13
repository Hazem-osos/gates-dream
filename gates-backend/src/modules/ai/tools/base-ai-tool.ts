import type { ZodType } from 'zod';
import type { ChatToolDefinition } from '../interfaces/ai-provider';
import { AI_TOOL_PERMISSION_DENIED_AR, isAiToolAllowed } from './ai-tool-access';
import { stripTenantArgs } from './strip-tenant-args';
import type { AiToolResult, SecurityContext } from './types';
import { zodObjectToJsonSchema } from './zod-json-schema';

export abstract class BaseAiTool<TParams = unknown, TResult = unknown> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters: ZodType<TParams>;
  abstract readonly requiredPermission: string;
  readonly requiredPermissions?: string[];
  readonly allowedRoles?: readonly string[];
  readonly strictRoles?: boolean;

  async execute(rawParams: unknown, context: SecurityContext): Promise<AiToolResult<TResult>> {
    if (!context?.userId?.trim() || !context?.companyId?.trim()) {
      return {
        ok: false,
        tool: this.name,
        error: 'INVALID_CONTEXT',
        message: 'Security context must include userId and companyId from the authenticated request',
      };
    }

    if (!this.hasPermission(context)) {
      return {
        ok: false,
        tool: this.name,
        error: 'PERMISSION_DENIED',
        message: AI_TOOL_PERMISSION_DENIED_AR,
      };
    }

    const parsed = this.parameters.safeParse(stripTenantArgs(rawParams ?? {}));
    if (!parsed.success) {
      return {
        ok: false,
        tool: this.name,
        error: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((issue) => issue.message).join('; ') || 'Invalid tool arguments',
      };
    }

    try {
      const data = await this.run(parsed.data, context);
      return {
        ok: true,
        tool: this.name,
        data,
        asOf: new Date().toISOString(),
      };
    } catch (error) {
      return {
        ok: false,
        tool: this.name,
        error: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Tool execution failed',
      };
    }
  }

  toFunctionDefinition(): ChatToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: zodObjectToJsonSchema(this.parameters),
      },
    };
  }

  protected hasPermission(context: SecurityContext): boolean {
    return isAiToolAllowed(this, context);
  }

  /**
   * Implementations MUST pass `context.companyId` into every service call.
   * Never read company/tenant identifiers from `params`.
   */
  protected abstract run(params: TParams, context: SecurityContext): Promise<TResult>;
}
