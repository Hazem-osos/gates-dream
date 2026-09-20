-- Dedicated automation idempotency key on purchase_orders.
-- Nullable so manual / imported POs are unchanged (MySQL UNIQUE allows many NULLs).
-- Enforces at most one PO per (companyId, automation action identity).

ALTER TABLE `purchase_orders`
    ADD COLUMN `automationIdempotencyKey` VARCHAR(255) NULL;

CREATE UNIQUE INDEX `purchase_orders_companyId_automationIdempotencyKey_key`
    ON `purchase_orders`(`companyId`, `automationIdempotencyKey`);
