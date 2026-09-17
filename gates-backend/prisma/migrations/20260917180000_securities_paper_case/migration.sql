ALTER TABLE `securities_receipts`
  ADD COLUMN `paperCase` VARCHAR(24) NOT NULL DEFAULT 'ISSUED';

ALTER TABLE `securities_payments`
  ADD COLUMN `paperCase` VARCHAR(24) NOT NULL DEFAULT 'ISSUED';

UPDATE `securities_receipts`
SET `paperCase` = 'BOUNCED'
WHERE `isCancelled` = true;

UPDATE `securities_receipts`
SET `paperCase` = 'COLLECTED'
WHERE `isPosted` = true AND `isCancelled` = false;

UPDATE `securities_receipts` sr
SET `paperCase` = 'MULTI_COLLECTED'
WHERE `isPosted` = true
  AND `isCancelled` = false
  AND EXISTS (
    SELECT 1 FROM `multi_collection_lines` m
    WHERE m.paperId = sr.id AND m.paperKind = 'RECEIPT'
  );

UPDATE `securities_receipts`
SET `paperCase` = 'ENDORSED'
WHERE `isCancelled` = false
  AND `isPosted` = false
  AND `description` LIKE '%تظهير%';

UPDATE `securities_payments`
SET `paperCase` = 'BOUNCED'
WHERE `isCancelled` = true;

UPDATE `securities_payments`
SET `paperCase` = 'COLLECTED'
WHERE `isPosted` = true AND `isCancelled` = false;

UPDATE `securities_payments` sp
SET `paperCase` = 'MULTI_COLLECTED'
WHERE `isPosted` = true
  AND `isCancelled` = false
  AND EXISTS (
    SELECT 1 FROM `multi_collection_lines` m
    WHERE m.paperId = sp.id AND m.paperKind = 'PAYMENT'
  );
