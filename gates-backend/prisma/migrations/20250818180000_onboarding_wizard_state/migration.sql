ALTER TABLE `companies`
  ADD COLUMN `onboardingStep` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `hasCompletedTour` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `launchChecklist` JSON NULL;
