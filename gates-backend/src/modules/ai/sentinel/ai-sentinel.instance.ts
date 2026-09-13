import { OpenAIProvider } from '../providers/openai.provider';
import { AiSentinelService } from './AiSentinelService';
import { aiNotificationStore } from './ai-notification.store';

export const aiSentinelService = new AiSentinelService(new OpenAIProvider(), aiNotificationStore);
