import { apiClient } from '@/lib/api/client';
import type { AcademyStatus, AcademyTourPlan } from './types';

export async function fetchAcademyStatus(moduleSlug: string, currentPath?: string): Promise<AcademyStatus | null> {
  try {
    const res = await apiClient.get<AcademyStatus>('/ai/academy/check-status', {
      moduleSlug,
      currentPath,
    });
    return res.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchAcademyTour(moduleSlug: string, currentPath?: string): Promise<AcademyTourPlan | null> {
  try {
    const res = await apiClient.get<AcademyTourPlan>('/ai/academy/tour', {
      moduleSlug,
      currentPath,
    });
    return res.data ?? null;
  } catch {
    return null;
  }
}

export async function postAcademyProgress(input: {
  moduleSlug: string;
  isCompleted?: boolean;
  lastStepIndex?: number;
  dismissed?: boolean;
}): Promise<AcademyStatus | null> {
  try {
    const res = await apiClient.post<AcademyStatus>('/ai/academy/progress', input);
    return res.data ?? null;
  } catch {
    return null;
  }
}
