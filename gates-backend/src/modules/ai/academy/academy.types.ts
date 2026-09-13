export type TourExpectedAction = 'CLICK' | 'TYPE' | 'INFO_NEXT';

export interface TourStep {
  stepNumber: number;
  targetSelector: string;
  titleAr: string;
  descriptionAr: string;
  expectedAction: TourExpectedAction;
  simulatedValue?: string;
}

export interface ModuleTourPlan {
  moduleSlug: string;
  titleAr: string;
  estimatedSeconds: number;
  steps: TourStep[];
  source: 'blueprint' | 'ai';
}

export interface AcademyStatus {
  moduleSlug: string;
  shouldTrigger: boolean;
  isCompleted: boolean;
  lastStepIndex: number;
  dismissedCount: number;
}

export interface AcademyProgressInput {
  moduleSlug: string;
  isCompleted?: boolean;
  lastStepIndex?: number;
  dismissed?: boolean;
}

export const MAX_TOUR_DISMISSES = 3;
