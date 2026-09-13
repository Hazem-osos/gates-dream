import { licenseSubscriptionService } from '../../platform/services/license-subscription.service';
import { OpenAIProvider } from '../providers/openai.provider';
import { prismaDiagnosticPorts } from './diagnostic.ports.prisma';
import { DiagnosticService } from './diagnostic.service';

export const diagnosticService = new DiagnosticService(
  {
    getCurrent: (companyId) => licenseSubscriptionService.getCurrent(companyId),
    ...prismaDiagnosticPorts,
  },
  new OpenAIProvider()
);
