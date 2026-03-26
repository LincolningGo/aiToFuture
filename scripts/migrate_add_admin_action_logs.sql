USE aitofuture;

CREATE TABLE IF NOT EXISTS admin_action_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  target_user_id BIGINT UNSIGNED NOT NULL,
  action_type ENUM('grant_points', 'deduct_points', 'enable_user', 'disable_user', 'change_role', 'update_system_settings') NOT NULL,
  change_amount INT DEFAULT NULL,
  before_value INT DEFAULT NULL,
  after_value INT DEFAULT NULL,
  note VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_admin_action_created (created_at),
  KEY idx_admin_action_target (target_user_id, created_at),
  CONSTRAINT fk_admin_action_admin_user FOREIGN KEY (admin_user_id) REFERENCES users(id),
  CONSTRAINT fk_admin_action_target_user FOREIGN KEY (target_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

ALTER TABLE admin_action_logs
  MODIFY COLUMN action_type ENUM('grant_points', 'deduct_points', 'enable_user', 'disable_user', 'change_role', 'update_system_settings') NOT NULL;
