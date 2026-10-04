-- Onboarding stores the company logo as a data URL. VARCHAR(191) rejects it (P2000) and rolls the whole setup back.
ALTER TABLE `company_settings` MODIFY `logoUrl` LONGTEXT NULL;
