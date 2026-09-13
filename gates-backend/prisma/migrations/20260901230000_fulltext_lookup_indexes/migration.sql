-- FULLTEXT indexes for entity typeahead. Prisma field names are camelCase in MySQL
-- (no @map). Semantic mapping from the requested snake_case tuples:
--   invoices (invoice_number, reference_number, notes)
--     → invoiceNumber, record, description
--   partners (name, commercial_name, tax_number, phone)
--     → customers: arabicName, englishName, taxAuthority, mobile
--     → suppliers: arabicName, englishName, registrationNumber, mobile
--   items (name, sku, barcode)
--     → arabicName, serial, barcode

CREATE FULLTEXT INDEX `invoices_ft_lookup`
    ON `invoices` (`invoiceNumber`, `record`, `description`);

CREATE FULLTEXT INDEX `customers_ft_lookup`
    ON `customers` (`arabicName`, `englishName`, `taxAuthority`, `mobile`);

CREATE FULLTEXT INDEX `suppliers_ft_lookup`
    ON `suppliers` (`arabicName`, `englishName`, `registrationNumber`, `mobile`);

CREATE FULLTEXT INDEX `items_ft_lookup`
    ON `items` (`arabicName`, `serial`, `barcode`);
