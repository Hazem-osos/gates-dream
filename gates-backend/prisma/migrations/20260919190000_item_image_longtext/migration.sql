-- Item card photos are stored as data URLs; TEXT (64KB) rejects a normal JPG.
ALTER TABLE `items` MODIFY `imageUrl` LONGTEXT NULL;
