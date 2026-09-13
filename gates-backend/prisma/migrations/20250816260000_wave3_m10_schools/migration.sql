-- Wave 3 M10: Schools & education fee billing
-- MySQL 8

CREATE TABLE `school_settings` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `studentArAccountCode` VARCHAR(20) NULL,
  `unearnedTuitionRevenueAccountCode` VARCHAR(20) NULL,
  `earnedTuitionRevenueAccountCode` VARCHAR(20) NULL,
  `tuitionDiscountAccountCode` VARCHAR(20) NULL,
  `busRevenueAccountCode` VARCHAR(20) NULL,
  `booksRevenueAccountCode` VARCHAR(20) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `school_settings_companyId_key` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `school_academic_years` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `yearCode` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `startDate` DATETIME(3) NULL,
  `endDate` DATETIME(3) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `school_academic_years_companyId_yearCode_key` (`companyId`, `yearCode`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `school_academic_terms` (
  `id` VARCHAR(191) NOT NULL,
  `academicYearId` VARCHAR(191) NOT NULL,
  `termCode` VARCHAR(191) NOT NULL,
  `termName` VARCHAR(191) NOT NULL,
  `startDate` DATETIME(3) NULL,
  `endDate` DATETIME(3) NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `school_academic_terms_academicYearId_termCode_key` (`academicYearId`, `termCode`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `academic_grades` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `stageName` VARCHAR(191) NOT NULL,
  `gradeName` VARCHAR(191) NOT NULL,
  `gradeCode` VARCHAR(191) NOT NULL,
  `defaultTuitionFee` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `costCenterId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `academic_grades_companyId_gradeCode_key` (`companyId`, `gradeCode`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `school_bus_routes` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `routeCode` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `annualFee` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `school_bus_routes_companyId_routeCode_key` (`companyId`, `routeCode`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `school_students` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `studentCode` VARCHAR(191) NOT NULL,
  `fullName` VARCHAR(191) NOT NULL,
  `guardianCustomerId` VARCHAR(191) NOT NULL,
  `gradeId` VARCHAR(191) NOT NULL,
  `academicYearId` VARCHAR(191) NOT NULL,
  `busRouteId` VARCHAR(191) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ENROLLED',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `school_students_companyId_studentCode_key` (`companyId`, `studentCode`),
  INDEX `school_students_guardianCustomerId_idx` (`guardianCustomerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_fee_contracts` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NOT NULL,
  `academicYearId` VARCHAR(191) NOT NULL,
  `contractNumber` VARCHAR(191) NOT NULL,
  `totalGrossFee` DECIMAL(15, 2) NOT NULL,
  `totalDiscount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `totalNetFee` DECIMAL(15, 2) NOT NULL,
  `tuitionFee` DECIMAL(15, 2) NOT NULL,
  `busFee` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `booksFee` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `outstandingArBalance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `unearnedTuitionBalance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  `accrualJournalEntryId` VARCHAR(191) NULL,
  `recognitionJournalEntryId` VARCHAR(191) NULL,
  `postedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `student_fee_contracts_companyId_contractNumber_key` (`companyId`, `contractNumber`),
  INDEX `student_fee_contracts_studentId_idx` (`studentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `student_fee_installments` (
  `id` VARCHAR(191) NOT NULL,
  `contractId` VARCHAR(191) NOT NULL,
  `installmentNumber` INTEGER NOT NULL,
  `termName` VARCHAR(191) NULL,
  `dueDate` DATETIME(3) NOT NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `paymentTransactionId` VARCHAR(191) NULL,
  `paidAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `student_fee_installments_contractId_installmentNumber_key` (`contractId`, `installmentNumber`),
  INDEX `student_fee_installments_contractId_status_idx` (`contractId`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `school_settings` ADD CONSTRAINT `school_settings_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_academic_years` ADD CONSTRAINT `school_academic_years_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_academic_terms` ADD CONSTRAINT `school_academic_terms_academicYearId_fkey` FOREIGN KEY (`academicYearId`) REFERENCES `school_academic_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `academic_grades` ADD CONSTRAINT `academic_grades_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `academic_grades` ADD CONSTRAINT `academic_grades_costCenterId_fkey` FOREIGN KEY (`costCenterId`) REFERENCES `cost_centers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `school_bus_routes` ADD CONSTRAINT `school_bus_routes_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_students` ADD CONSTRAINT `school_students_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `school_students` ADD CONSTRAINT `school_students_guardianCustomerId_fkey` FOREIGN KEY (`guardianCustomerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `school_students` ADD CONSTRAINT `school_students_gradeId_fkey` FOREIGN KEY (`gradeId`) REFERENCES `academic_grades`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `school_students` ADD CONSTRAINT `school_students_academicYearId_fkey` FOREIGN KEY (`academicYearId`) REFERENCES `school_academic_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `school_students` ADD CONSTRAINT `school_students_busRouteId_fkey` FOREIGN KEY (`busRouteId`) REFERENCES `school_bus_routes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `student_fee_contracts` ADD CONSTRAINT `student_fee_contracts_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_fee_contracts` ADD CONSTRAINT `student_fee_contracts_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `school_students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `student_fee_contracts` ADD CONSTRAINT `student_fee_contracts_academicYearId_fkey` FOREIGN KEY (`academicYearId`) REFERENCES `school_academic_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `student_fee_installments` ADD CONSTRAINT `student_fee_installments_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `student_fee_contracts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_fee_installments` ADD CONSTRAINT `student_fee_installments_paymentTransactionId_fkey` FOREIGN KEY (`paymentTransactionId`) REFERENCES `cash_transactions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
