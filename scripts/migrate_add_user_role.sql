USE aitofuture;

SET @has_role := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'aitofuture'
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'role'
);
SET @ddl := IF(
  @has_role = 0,
  'ALTER TABLE users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT ''user'' AFTER email',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE users
SET role = 'user'
WHERE role IS NULL OR role = '';
