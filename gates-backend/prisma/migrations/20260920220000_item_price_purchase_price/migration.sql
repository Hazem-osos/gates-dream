-- Purchase price on a price-list row (alongside sale `price` / retailPrice).

ALTER TABLE `item_prices`
    ADD COLUMN `purchasePrice` DECIMAL(18, 4) NULL;
