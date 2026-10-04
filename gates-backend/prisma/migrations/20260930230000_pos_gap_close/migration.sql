ALTER TABLE pos_approvals
  ADD COLUMN consumedByOrderId VARCHAR(191) NULL;

CREATE UNIQUE INDEX pos_approvals_consumed_order ON pos_approvals (consumedByOrderId);

ALTER TABLE pos_credit_collections
  ADD COLUMN clientRequestId VARCHAR(64) NULL;

CREATE UNIQUE INDEX pos_credit_collections_company_request ON pos_credit_collections (companyId, clientRequestId);
