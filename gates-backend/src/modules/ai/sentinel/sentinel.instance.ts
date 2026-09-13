import { OpenAIProvider } from '../providers/openai.provider';
import { prismaSentinelPorts } from './sentinel.ports.prisma';
import { sentinelSnapshotStore } from './sentinel.snapshot.store';
import { SentinelService } from './sentinel.service';

export const sentinelService = new SentinelService(
  prismaSentinelPorts,
  new OpenAIProvider(),
  sentinelSnapshotStore
);
