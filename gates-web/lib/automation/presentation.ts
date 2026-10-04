import type { LucideIcon } from 'lucide-react';
import { Bell, Boxes, Building2, FileText, Mail, Package, ShoppingCart, UserPlus, Users, Webhook, Zap } from 'lucide-react';

/** Visual only. Availability still comes from metadata. */
export function eventIcon(eventType: string): LucideIcon {
  if (eventType.startsWith('inventory.')) return Boxes;
  if (eventType.startsWith('sales.')) return FileText;
  if (eventType.startsWith('customer.')) return UserPlus;
  if (eventType.startsWith('purchase.') || eventType.startsWith('supplier.')) return Package;
  if (eventType.startsWith('hr.')) return Users;
  if (eventType.startsWith('project.')) return Building2;
  return Zap;
}

export function actionIcon(actionType: string): LucideIcon {
  if (actionType === 'gates.createPurchaseRequest') return ShoppingCart;
  if (actionType === 'gates.createNotification') return Bell;
  if (actionType === 'email.send') return Mail;
  if (actionType === 'webhook') return Webhook;
  return Zap;
}
