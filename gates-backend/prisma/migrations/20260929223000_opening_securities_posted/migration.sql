-- Opening securities are saved posted (no issue journal). Backfill existing rows.
UPDATE `securities_receipts`
SET `isPosted` = 1,
    `postedAt` = COALESCE(`postedAt`, UTC_TIMESTAMP(3))
WHERE `isOpening` = 1
  AND `isCancelled` = 0
  AND `isPosted` = 0;
