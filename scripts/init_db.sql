CREATE DATABASE IF NOT EXISTS aitofuture DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE aitofuture;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'user',
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

CREATE TABLE IF NOT EXISTS ai_models (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider VARCHAR(40) NOT NULL,
  capability ENUM('text_to_image', 'image_to_image', 'text_to_video', 'text_to_audio') NOT NULL,
  model_code VARCHAR(80) NOT NULL,
  model_name VARCHAR(120) NOT NULL,
  unit_cost_points INT NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  metadata_json JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_models_provider_code (provider, model_code),
  KEY idx_models_capability_active (capability, is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS generation_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_uuid VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  model_id BIGINT UNSIGNED DEFAULT NULL,
  capability ENUM('text_to_image', 'image_to_image', 'text_to_video', 'text_to_audio') NOT NULL,
  provider VARCHAR(40) NOT NULL,
  model_code VARCHAR(80) NOT NULL,
  model_name VARCHAR(120) NOT NULL,
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
  KEY idx_generation_model (model_id),
  CONSTRAINT fk_generation_jobs_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_generation_jobs_model FOREIGN KEY (model_id) REFERENCES ai_models(id)
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

INSERT INTO ai_models
(provider, capability, model_code, model_name, unit_cost_points, is_default, is_active, metadata_json)
VALUES
('minimax_mock', 'text_to_image', 'minimax-image-01', 'MiniMax Image 01 (Mock)', 10, 1, 1, JSON_OBJECT('track', 'image')),
('minimax_mock', 'image_to_image', 'minimax-image-edit-01', 'MiniMax Image Edit 01 (Mock)', 12, 1, 1, JSON_OBJECT('track', 'image_edit')),
('minimax_mock', 'text_to_video', 'minimax-video-01', 'MiniMax Video 01 (Mock)', 30, 1, 1, JSON_OBJECT('track', 'video')),
('minimax_mock', 'text_to_audio', 'minimax-voice-01', 'MiniMax Voice 01 (Mock)', 8, 1, 1, JSON_OBJECT('track', 'audio')),
('minimax', 'text_to_image', 'image-01', 'MiniMax Image 01', 10, 1, 1, JSON_OBJECT('track', 'image')),
('minimax', 'image_to_image', 'image-01-i2i', 'MiniMax Image 01 (I2I)', 12, 1, 1, JSON_OBJECT('track', 'image_edit')),
('minimax', 'text_to_video', 'T2V-01-Director', 'MiniMax T2V-01-Director', 30, 1, 1, JSON_OBJECT('track', 'video')),
('minimax', 'text_to_audio', 'speech-02-hd', 'MiniMax Speech 02 HD', 8, 1, 1, JSON_OBJECT('track', 'audio'))
ON DUPLICATE KEY UPDATE
  model_name = VALUES(model_name),
  unit_cost_points = VALUES(unit_cost_points),
  is_default = VALUES(is_default),
  is_active = VALUES(is_active),
  metadata_json = VALUES(metadata_json);
