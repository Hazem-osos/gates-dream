export { SentinelService } from './sentinel.service';
export { sentinelService } from './sentinel.instance';
export { AiSentinelService } from './AiSentinelService';
export { aiSentinelService } from './ai-sentinel.instance';
export { canReceiveNotification, allowedCategoriesForRoles, normalizeCallerRoles } from './notification-rbac';
export { synthesizeSentinelNarrative, buildFallbackNarrative, toCompactPayload } from './synthesize-sentinel';
export * from './sentinel.math';
export * from './sentinel.types';
