import { getPublicAiConfig } from '../config/ai.config';
import type { AIProvider } from '../interfaces/ai-provider';
import type { SecurityContext } from '../tools/types';
import {
  aiConversationStore,
  type AiConversationStore,
  type ConversationActor,
} from './ai-conversation.store';
import {
  AiOrchestratorService,
  type OrchestratorInput,
  type OrchestratorResult,
  type OrchestratorStreamEvent,
} from './ai-orchestrator.service';
import {
  aiActionExecutionService,
  type AiActionExecutionService,
} from '../actions/ai-action-execution.service';
import {
  documentIngestionService,
  type DocumentIngestionService,
  type IngestDocumentInput,
} from '../rag/document-ingestion.service';
import { insightStore, type InsightStore } from '../proactive/insight.store';
import { proactiveCfoJob, type ProactiveCfoJob } from '../proactive/proactive-cfo.job';
import type { SentinelService } from '../sentinel/sentinel.service';
import { sentinelService } from '../sentinel/sentinel.instance';
import type { DiagnosticService } from '../diagnostic/diagnostic.service';
import { diagnosticService } from '../diagnostic/diagnostic.instance';
import {
  errorDiagnosticService,
  type ErrorDiagnosticService,
} from '../diagnostic/error-diagnostic.service';
import type { DiagnoseErrorInput } from '../diagnostic/error-diagnostic.types';
import { AppError } from '../../../shared/middleware/error-handler';
import { ingestPurchaseInvoiceService } from '../ocr/ingest-purchase-invoice.service';

export type ActorContext = ConversationActor;

export type ChatTurnInput = OrchestratorInput;

export type ChatTurnResult = OrchestratorResult;

export class AiService {
  constructor(
    private readonly provider: AIProvider,
    private readonly orchestrator: AiOrchestratorService,
    private readonly store: AiConversationStore = aiConversationStore,
    private readonly actions: AiActionExecutionService = aiActionExecutionService,
    private readonly documents: DocumentIngestionService = documentIngestionService,
    private readonly insights: InsightStore = insightStore,
    private readonly proactive: ProactiveCfoJob = proactiveCfoJob,
    private readonly sentinel: SentinelService = sentinelService,
    private readonly diagnostic: DiagnosticService = diagnosticService,
    private readonly errorDiagnostic: ErrorDiagnosticService = errorDiagnosticService
  ) {}

  getHealth() {
    return getPublicAiConfig();
  }

  listConversations(actor: ActorContext) {
    return this.store.listConversations(actor);
  }

  getConversation(conversationId: string, actor: ActorContext) {
    return this.store.getConversation(conversationId, actor);
  }

  createConversation(actor: ActorContext, title?: string) {
    return this.store.createConversation(actor, title);
  }

  deleteConversation(conversationId: string, actor: ActorContext) {
    return this.store.deleteConversation(conversationId, actor);
  }

  async completeChat(input: ChatTurnInput, security: SecurityContext) {
    try {
      return await this.orchestrator.complete(input, security);
    } catch (error) {
      console.error('[AI Chat Error]', error);
      throw error;
    }
  }

  async sendMessage(
    conversationId: string,
    input: Omit<ChatTurnInput, 'conversationId'>,
    security: SecurityContext
  ) {
    try {
      return await this.orchestrator.complete({ ...input, conversationId }, security);
    } catch (error) {
      console.error('[AI Chat Error]', error);
      throw error;
    }
  }

  async *streamChat(
    input: ChatTurnInput,
    security: SecurityContext
  ): AsyncGenerator<OrchestratorStreamEvent> {
    try {
      yield* this.orchestrator.stream(input, security);
    } catch (error) {
      console.error('[AI Chat Error]', error);
      throw error;
    }
  }

  async *streamMessage(
    conversationId: string,
    input: Omit<ChatTurnInput, 'conversationId'>,
    security: SecurityContext
  ): AsyncGenerator<OrchestratorStreamEvent> {
    try {
      yield* this.orchestrator.stream({ ...input, conversationId }, security);
    } catch (error) {
      console.error('[AI Chat Error]', error);
      throw error;
    }
  }

  listActions(conversationId: string, actor: ActorContext) {
    return this.actions.listForConversation(conversationId, actor);
  }

  getAction(actionId: string, actor: ActorContext) {
    return this.actions.getAction(actionId, actor);
  }

  confirmAction(actionId: string, actor: ActorContext, security: SecurityContext) {
    return this.actions.confirm(actionId, actor, security);
  }

  rejectAction(actionId: string, actor: ActorContext) {
    return this.actions.reject(actionId, actor);
  }

  acknowledgeAction(
    actionId: string,
    actor: ActorContext,
    input: { resultingEntityId: string; documentNumber?: string }
  ) {
    return this.actions.acknowledge(actionId, actor, input);
  }

  ingestPurchaseInvoice(
    actor: ActorContext,
    input: {
      conversationId?: string;
      fileName: string;
      mimeType: string;
      buffer: Buffer;
      caption?: string;
    }
  ) {
    return ingestPurchaseInvoiceService.ingest(actor, input);
  }

  ocrCreateItem(actor: ActorContext, actionId: string, lineIndex: number) {
    return ingestPurchaseInvoiceService.createMissingItem(actor, actionId, lineIndex);
  }

  uploadDocument(input: IngestDocumentInput) {
    return this.documents.ingest(input);
  }

  listDocuments(companyId: string) {
    return this.documents.list(companyId);
  }

  listActiveInsights(companyId: string) {
    return this.insights.listActive(companyId);
  }

  async dismissInsight(insightId: string, companyId: string) {
    try {
      return await this.insights.dismiss(insightId, companyId);
    } catch {
      throw new AppError(404, 'التنبيه غير موجود');
    }
  }

  runProactiveScan(companyId: string) {
    return this.proactive.runForCompany(companyId);
  }

  getSentinelExecutiveReport(companyId: string) {
    return this.sentinel.getExecutiveReport(companyId);
  }

  getDiagnosticReport(companyId: string) {
    return this.diagnostic.buildReport(companyId);
  }

  diagnoseError(
    actor: ConversationActor,
    input: DiagnoseErrorInput,
    extras?: { userRole?: string }
  ) {
    return this.errorDiagnostic.diagnose(actor, input, extras);
  }
}
