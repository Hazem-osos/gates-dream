import { AcademyController } from './academy/AcademyController';
import { AcademyTourService } from './academy/AcademyTourService';
import { AiController } from './controllers/ai.controller';
import type { AIProvider } from './interfaces/ai-provider';
import { OpenAIProvider } from './providers/openai.provider';
import { createAiRouter } from './routes/ai.routes';
import { aiConversationStore } from './services/ai-conversation.store';
import { AiOrchestratorService } from './services/ai-orchestrator.service';
import { AiService } from './services/ai.service';
import { getCoreFinancialToolRegistry, type AiToolRegistry } from './tools';

export class AiModule {
  readonly provider: AIProvider;
  readonly toolRegistry: AiToolRegistry;
  readonly orchestrator: AiOrchestratorService;
  readonly service: AiService;
  readonly controller: AiController;
  readonly academyTourService: AcademyTourService;
  readonly academyController: AcademyController;
  readonly router;

  constructor(provider: AIProvider = new OpenAIProvider()) {
    this.provider = provider;
    this.toolRegistry = getCoreFinancialToolRegistry();
    this.orchestrator = new AiOrchestratorService(
      this.provider,
      this.toolRegistry,
      aiConversationStore
    );
    this.service = new AiService(this.provider, this.orchestrator, aiConversationStore);
    this.controller = new AiController(this.service);
    this.academyTourService = new AcademyTourService(this.provider);
    this.academyController = new AcademyController(this.academyTourService);
    this.router = createAiRouter(this.controller, this.academyController);
  }
}

export const aiModule = new AiModule();
export const aiService = aiModule.service;
export const aiController = aiModule.controller;

export type { AIProvider } from './interfaces/ai-provider';
export { OpenAIProvider } from './providers/openai.provider';
export { AiService } from './services/ai.service';
export { AiController } from './controllers/ai.controller';
export { AiOrchestratorService, MAX_ORCHESTRATOR_TURNS } from './services/ai-orchestrator.service';
export { AiConversationStore, conversationOwnerWhere } from './services/ai-conversation.store';
export { buildCfoSystemPrompt, CFO_SYSTEM_PROMPT } from './prompts/cfo-system-prompt';
export { GATES_ERP_CONSTITUTION } from './constants/gates-constitution';
export { AcademyTourService } from './academy/AcademyTourService';
export { AcademyController } from './academy/AcademyController';
export { buildGatesIntelligenceSystemPrompt } from './prompts/gates-intelligence-prompt';
export {
  BaseAiTool,
  AiToolRegistry,
  createCoreFinancialToolRegistry,
  getCoreFinancialToolRegistry,
} from './tools';
export type { SecurityContext, AiToolResult } from './tools';

export default aiModule.router;
