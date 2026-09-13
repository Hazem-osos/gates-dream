-- Add missing self-relation FK: Department.managementId -> Department.id
-- Fixes 500 error on HR Departments listing/create/update/get, which used
-- `include: { management: true }` in department.service.ts without a
-- matching Prisma relation, causing a query validation error.
CREATE INDEX `departments_managementId_idx` ON `departments`(`managementId`);

ALTER TABLE `departments` ADD CONSTRAINT `departments_managementId_fkey`
  FOREIGN KEY (`managementId`) REFERENCES `departments`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
