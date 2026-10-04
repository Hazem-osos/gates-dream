-- P0-4: allow REVERSED on canonical certificate status enums.

ALTER TABLE `client_invoices`
  MODIFY `status` ENUM(
    'DRAFT',
    'SUBMITTED_TO_CLIENT',
    'CLIENT_APPROVED',
    'FINANCE_POSTED',
    'REJECTED',
    'PAID',
    'REVERSED'
  ) NOT NULL DEFAULT 'DRAFT';

ALTER TABLE `subcontract_invoices`
  MODIFY `status` ENUM(
    'DRAFT',
    'SITE_SUBMITTED',
    'CONSULTANT_APPROVED',
    'TECH_OFFICE_APPROVED',
    'FINANCE_POSTED',
    'REJECTED',
    'PAID',
    'REVERSED'
  ) NOT NULL DEFAULT 'DRAFT';
