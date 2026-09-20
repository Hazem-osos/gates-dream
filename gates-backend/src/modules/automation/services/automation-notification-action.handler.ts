/**
 * gates.createNotification — creates an in-app SystemNotification using the
 * SAME direct-write pattern already used by the pre-existing GATES-internal
 * automation event bus (see events/notification-bus.ts). There is no
 * separate "generic notification service" to reuse; SystemNotification IS
 * the domain boundary.
 */
import prisma from '../../../shared/database/prisma';
import { runWithoutTenantScoping } from '../../../shared/database/tenant-context';
import { CREATE_NOTIFICATION_ACTION } from '../catalog/action-catalog';
import { resolveConfigValue } from '../catalog/binding';
import { AutomationActionDispatchError, type ActionExecutionContext, type ActionExecutionResult, type ActionHandler } from './automation-action-dispatch.types';

const RESULT_ENTITY_NOTIFICATION = 'SystemNotification';

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AutomationActionDispatchError(400, `Config field "${field}" resolved to an empty value`);
  }
  return value.slice(0, maxLength);
}

export const notificationActionHandler: ActionHandler = {
  actionType: CREATE_NOTIFICATION_ACTION,

  async execute(ctx: ActionExecutionContext): Promise<ActionExecutionResult> {
    const title = requiredString(resolveConfigValue(ctx.config.title, ctx.eventData), 'title', 200);
    const message = requiredString(resolveConfigValue(ctx.config.message, ctx.eventData), 'message', 2000);
    const linkUrlRaw = resolveConfigValue(ctx.config.linkUrl, ctx.eventData);
    const linkUrl = typeof linkUrlRaw === 'string' && linkUrlRaw.trim() ? linkUrlRaw.slice(0, 500) : null;
    const userId = typeof ctx.config.userId === 'string' ? ctx.config.userId : null;
    const severity = typeof ctx.config.severity === 'string' ? ctx.config.severity : 'info';

    if (userId) {
      const user = await runWithoutTenantScoping(() =>
        prisma.user.findFirst({ where: { id: userId, companyId: ctx.companyId }, select: { id: true } })
      );
      if (!user) {
        throw new AutomationActionDispatchError(400, 'userId does not belong to this company');
      }
    }

    const notification = await runWithoutTenantScoping(() =>
      prisma.systemNotification.create({
        data: {
          companyId: ctx.companyId,
          userId,
          title,
          message,
          type: severity === 'error' ? 'ALERT' : severity === 'warn' ? 'WARNING' : 'INFO',
          category: ctx.eventType.slice(0, 40),
          linkUrl,
          isRead: false,
        },
      })
    );

    return {
      resultEntityType: RESULT_ENTITY_NOTIFICATION,
      resultEntityId: notification.id,
      resultMetadata: { title, severity },
    };
  },
};
