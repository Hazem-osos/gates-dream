import prisma from '../../../shared/database/prisma';
import { AutomationRuleService } from './automation-rule.service';

export const automationRuleService = new AutomationRuleService(prisma);
