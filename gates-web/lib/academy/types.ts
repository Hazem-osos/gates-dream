export type AcademyExpectedAction = 'CLICK' | 'TYPE' | 'INFO_NEXT';

export type AcademyTourStep = {
  stepNumber: number;
  targetSelector: string;
  titleAr: string;
  descriptionAr: string;
  expectedAction: AcademyExpectedAction;
  simulatedValue?: string;
};

export type AcademyTourPlan = {
  moduleSlug: string;
  titleAr: string;
  estimatedSeconds: number;
  steps: AcademyTourStep[];
  source?: 'blueprint' | 'ai';
};

export type AcademyStatus = {
  moduleSlug: string;
  shouldTrigger: boolean;
  isCompleted: boolean;
  lastStepIndex: number;
  dismissedCount: number;
};

export type AcademyMissionCard = {
  slug: string;
  titleAr: string;
  descriptionAr: string;
  href: string;
};
