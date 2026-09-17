import { AppError } from '../../../shared/middleware/error-handler';
import { redisClient } from '../../../shared/cache/redis';

const TTL_MS = 45_000;
const TTL_SEC = 45;

export type DocumentEditLease = {
  userId: string;
  sessionId: string;
  userName: string;
  expiresAt: number;
};

export class DocumentOccupiedError extends AppError {
  readonly holderName: string;

  constructor(holderName: string) {
    super(409, `السند مفتوح حالياً عند ${holderName}`);
    this.holderName = holderName;
  }
}

function redisKey(companyId: string, resourceKey: string): string {
  return `doc-lease:${companyId}:${resourceKey}`;
}

function isLive(lease: DocumentEditLease | null, now = Date.now()): lease is DocumentEditLease {
  return Boolean(lease && lease.expiresAt > now);
}

function isSameHolder(lease: DocumentEditLease, userId: string, sessionId: string): boolean {
  return lease.userId === userId && lease.sessionId === sessionId;
}

export class DocumentEditLeaseService {
  private readonly memory = new Map<string, DocumentEditLease>();

  async acquire(input: {
    companyId: string;
    resourceKey: string;
    userId: string;
    sessionId: string;
    userName: string;
  }): Promise<{ granted: true; lease: DocumentEditLease }> {
    const next: DocumentEditLease = {
      userId: input.userId,
      sessionId: input.sessionId,
      userName: input.userName,
      expiresAt: Date.now() + TTL_MS,
    };

    if (redisClient.isReady()) {
      try {
        return await this.acquireRedis(input.companyId, input.resourceKey, next);
      } catch (error) {
        if (error instanceof DocumentOccupiedError) throw error;
      }
    }

    return this.acquireMemory(input.companyId, input.resourceKey, next);
  }

  async release(input: { companyId: string; resourceKey: string; userId: string; sessionId: string }) {
    if (redisClient.isReady()) {
      try {
        const key = redisKey(input.companyId, input.resourceKey);
        const raw = await redisClient.getClient().get(key);
        const current = raw ? (JSON.parse(raw) as DocumentEditLease) : null;
        if (current && isSameHolder(current, input.userId, input.sessionId)) {
          await redisClient.getClient().del(key);
        }
      } catch {
        /* memory fallback below */
      }
    }

    const memKey = redisKey(input.companyId, input.resourceKey);
    const current = this.memory.get(memKey);
    if (current && isSameHolder(current, input.userId, input.sessionId)) {
      this.memory.delete(memKey);
    }
  }

  private acquireMemory(
    companyId: string,
    resourceKey: string,
    next: DocumentEditLease
  ): { granted: true; lease: DocumentEditLease } {
    const key = redisKey(companyId, resourceKey);
    const current = this.memory.get(key) ?? null;
    if (isLive(current) && !isSameHolder(current, next.userId, next.sessionId)) {
      throw new DocumentOccupiedError(current.userName);
    }
    this.memory.set(key, next);
    return { granted: true, lease: next };
  }

  private async acquireRedis(
    companyId: string,
    resourceKey: string,
    next: DocumentEditLease
  ): Promise<{ granted: true; lease: DocumentEditLease }> {
    const key = redisKey(companyId, resourceKey);
    const redis = redisClient.getClient();
    const raw = await redis.get(key);
    const current = raw ? (JSON.parse(raw) as DocumentEditLease) : null;
    if (isLive(current) && !isSameHolder(current, next.userId, next.sessionId)) {
      throw new DocumentOccupiedError(current.userName);
    }
    await redis.set(key, JSON.stringify(next), 'EX', TTL_SEC);
    this.memory.set(key, next);
    return { granted: true, lease: next };
  }
}

export const documentEditLeaseService = new DocumentEditLeaseService();
