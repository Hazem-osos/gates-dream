-- P0-1: Enterprise canonical stack for new contracting projects.

ALTER TABLE `contracting_projects`
  ADD COLUMN `canonicalStack` ENUM('ENTERPRISE', 'LEGACY_WAVE3') NOT NULL DEFAULT 'ENTERPRISE';

-- Projects that already used Wave3 documents keep legacy write paths.
UPDATE `contracting_projects` cp
SET cp.`canonicalStack` = 'LEGACY_WAVE3'
WHERE EXISTS (SELECT 1 FROM `contract_extracts` ce WHERE ce.`projectId` = cp.`id`)
   OR EXISTS (SELECT 1 FROM `client_extracts` cx WHERE cx.`projectId` = cp.`id`)
   OR EXISTS (SELECT 1 FROM `subcontractor_extracts` sx WHERE sx.`projectId` = cp.`id`)
   OR EXISTS (SELECT 1 FROM `project_boq_items` pb WHERE pb.`projectId` = cp.`id`);
