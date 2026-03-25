CREATE DATABASE IF NOT EXISTS aitofuture DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE aitofuture;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  points INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_username (username),
  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS points_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  change_amount INT NOT NULL,
  balance_after INT NOT NULL,
  reason VARCHAR(80) NOT NULL,
  reference_type VARCHAR(40) DEFAULT NULL,
  reference_id VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_points_user_created (user_id, created_at),
  CONSTRAINT fk_points_ledger_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS generation_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_uuid VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  capability ENUM('text_to_image', 'image_to_image', 'text_to_video', 'text_to_audio') NOT NULL,
  provider VARCHAR(40) NOT NULL,
  prompt_text TEXT,
  input_image_path VARCHAR(255) DEFAULT NULL,
  status ENUM('queued', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'queued',
  cost_points INT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_generation_jobs_uuid (job_uuid),
  KEY idx_generation_user_created (user_id, created_at),
  CONSTRAINT fk_generation_jobs_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS generation_outputs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id BIGINT UNSIGNED NOT NULL,
  file_type ENUM('image', 'video', 'audio') NOT NULL,
  local_path VARCHAR(255) NOT NULL,
  public_url VARCHAR(255) NOT NULL,
  metadata_json JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_outputs_job (job_id),
  CONSTRAINT fk_generation_outputs_job FOREIGN KEY (job_id) REFERENCES generation_jobs(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS generation_cost_rules (
  capability ENUM('text_to_image', 'image_to_image', 'text_to_video', 'text_to_audio') NOT NULL,
  cost_points INT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (capability)
) ENGINE=InnoDB;

INSERT INTO generation_cost_rules (capability, cost_points) VALUES
('text_to_image', 10),
('image_to_image', 12),
('text_to_video', 30),
('text_to_audio', 8)
ON DUPLICATE KEY UPDATE cost_points = VALUES(cost_points);
