import type { ProjectCostSourceType } from '@prisma/client';

export function buildProjectCostAllocationKey(input: {
  sourceType: ProjectCostSourceType;
  sourceId: string;
  sourceLineId?: string | null;
  projectBOQItemId?: string | null;
  slot?: string;
}): string {
  const line = input.sourceLineId ?? '_';
  const boq = input.projectBOQItemId ?? 'PROJECT';
  const slot = input.slot ?? '0';
  return `${input.sourceType}:${input.sourceId}:${line}:${boq}:${slot}`;
}
