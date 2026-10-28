import { apiClient } from '@/lib/api/client';

export type HcmEventType =
  | 'TRANSFER'
  | 'PROMOTION'
  | 'DEMOTION'
  | 'SUSPENSION'
  | 'RETURN_FROM_SUSPENSION'
  | 'TERMINATION'
  | 'RESIGNATION';

/**
 * Apply an employment change through the HCM event workflow
 * (draft → submit → approve → applied). This is what updates the employment
 * status, the effective-dated assignment and payroll eligibility — writing the
 * employee row directly does not.
 */
export async function applyEmploymentEvent(input: {
  employeeId: string;
  eventType: HcmEventType;
  effectiveDate: string;
  payload?: Record<string, unknown>;
  reason?: string;
  notes?: string;
}) {
  let employmentId: string | undefined;
  try {
    const at = await apiClient.get<{ employmentId: string }>(`/hr/employees/${input.employeeId}/assignment-at`, {
      date: input.effectiveDate,
    });
    employmentId = at.data?.employmentId;
  } catch {
    employmentId = undefined;
  }
  if (!employmentId) {
    throw new Error('لا يوجد توظيف ساري لهذا الموظف في هذا التاريخ');
  }

  const draft = await apiClient.post<{ id: string }>('/hr/employment-events', {
    employmentId,
    eventType: input.eventType,
    effectiveDate: input.effectiveDate,
    payload: input.payload ?? {},
    reason: input.reason || undefined,
    notes: input.notes || undefined,
  });
  const eventId = draft.data?.id;
  if (!eventId) throw new Error('تعذر إنشاء الإجراء');
  await apiClient.post(`/hr/employment-events/${eventId}/submit`, {});
  await apiClient.post(`/hr/employment-events/${eventId}/approve`, {});
  return { eventId, employmentId };
}
