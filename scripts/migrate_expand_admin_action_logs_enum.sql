USE aitofuture;

ALTER TABLE admin_action_logs
  MODIFY COLUMN action_type ENUM('grant_points', 'deduct_points', 'enable_user', 'disable_user', 'change_role', 'update_system_settings') NOT NULL;
