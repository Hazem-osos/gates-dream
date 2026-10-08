-- Sales order line images are embedded in lineNotes JSON; TEXT (64KB) was too small.
ALTER TABLE `invoice_lines` MODIFY `lineNotes` LONGTEXT NULL;
