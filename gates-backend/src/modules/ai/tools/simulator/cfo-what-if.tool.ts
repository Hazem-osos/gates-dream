import { z } from 'zod';
import { CFO_DECISION_ROLES } from '../ai-tool-access';
import { BaseAiTool } from '../base-ai-tool';
import type { SecurityContext } from '../types';
import { CfoSimulatorService } from './cfo-simulator.service';
import { CFO_SCENARIO_TYPES } from './cfo-simulator.types';

const paramsSchema = z.object({
  scenarioType: z
    .enum(CFO_SCENARIO_TYPES)
    .describe(
      'CASH_DISCOUNT_OFFER = خصم كاش للعملاء، PRICE_ADJUSTMENT = رفع/خفض السعر، OVERHEAD_INCREASE = زيادة أعباء أو رواتب'
    ),
  percentageDelta: z
    .number()
    .min(-80)
    .max(80)
    .describe('Percent change. Use -3 for a 3% cash discount, +5 for a 5% price hike, +10 for 10% overhead.'),
  expectedVolumeDeltaPercent: z
    .number()
    .min(-80)
    .max(200)
    .optional()
    .describe('Expected sales-volume change percent, e.g. 10 for +10% volume. Defaults to 0.'),
  lookbackPeriodMonths: z
    .number()
    .int()
    .min(1)
    .max(24)
    .optional()
    .describe('Posted GL / sales lookback in months. Default 3.'),
});

type Params = z.infer<typeof paramsSchema>;

export class CfoWhatIfTool extends BaseAiTool<Params> {
  readonly name = 'cfo_what_if_tool';
  readonly description =
    'CFO what-if simulator on real posted general-ledger and sales history. Use for hypotheses such as cash discounts, price increases, or payroll/overhead changes and their impact on cash flow, gross margin, DSO, and working capital. Restricted to OWNER / SUPER_ADMIN / FINANCIAL_DIRECTOR.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'report:view';
  readonly allowedRoles = CFO_DECISION_ROLES;
  readonly strictRoles = true;

  constructor(private readonly simulator?: CfoSimulatorService) {
    super();
  }

  protected async run(params: Params, context: SecurityContext) {
    const engine =
      this.simulator ??
      new CfoSimulatorService((await import('./cfo-simulator.ports.prisma')).prismaCfoSimulatorPorts);
    return engine.simulate(
      context.companyId,
      {
        scenarioType: params.scenarioType,
        percentageDelta: params.percentageDelta,
        expectedVolumeDeltaPercent: params.expectedVolumeDeltaPercent,
        lookbackPeriodMonths: params.lookbackPeriodMonths,
      },
      { branchId: context.branchId, fiscalYearId: context.fiscalYearId }
    );
  }
}
