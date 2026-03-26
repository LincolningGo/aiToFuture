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

CREATE TABLE IF NOT EXISTS admin_action_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  target_user_id BIGINT UNSIGNED NOT NULL,
  action_type ENUM('grant_points', 'deduct_points', 'enable_user', 'disable_user', 'change_role') NOT NULL,
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

CREATE TABLE IF NOT EXISTS ai_models (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider VARCHAR(40) NOT NULL,
  capability ENUM('text_to_image', 'image_to_image', 'text_to_video', 'text_to_audio', 'lyrics_generation', 'music_generation') NOT NULL,
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
  capability ENUM('text_to_image', 'image_to_image', 'text_to_video', 'text_to_audio', 'lyrics_generation', 'music_generation') NOT NULL,
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
  file_type ENUM('image', 'video', 'audio', 'text') NOT NULL,
  local_path VARCHAR(255) NOT NULL,
  public_url VARCHAR(255) NOT NULL,
  metadata_json JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_outputs_job (job_id),
  CONSTRAINT fk_generation_outputs_job FOREIGN KEY (job_id) REFERENCES generation_jobs(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS generation_cost_rules (
  capability ENUM('text_to_image', 'image_to_image', 'text_to_video', 'text_to_audio', 'lyrics_generation', 'music_generation') NOT NULL,
  cost_points INT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (capability)
) ENGINE=InnoDB;

INSERT INTO generation_cost_rules (capability, cost_points) VALUES
('text_to_image', 10),
('image_to_image', 12),
('text_to_video', 30),
('text_to_audio', 8),
('lyrics_generation', 6),
('music_generation', 20)
ON DUPLICATE KEY UPDATE cost_points = VALUES(cost_points);

INSERT INTO ai_models
(provider, capability, model_code, model_name, unit_cost_points, is_default, is_active, metadata_json)
VALUES
('minimax_mock', 'text_to_image', 'minimax-image-01', 'MiniMax Image 01 (Mock)', 10, 0, 0, JSON_OBJECT('track', 'image')),
('minimax_mock', 'image_to_image', 'minimax-image-edit-01', 'MiniMax Image Edit 01 (Mock)', 12, 0, 0, JSON_OBJECT('track', 'image_edit')),
('minimax_mock', 'text_to_video', 'minimax-video-01', 'MiniMax Video 01 (Mock)', 30, 0, 0, JSON_OBJECT('track', 'video')),
('minimax_mock', 'text_to_audio', 'minimax-voice-01', 'MiniMax Voice 01 (Mock)', 8, 0, 0, JSON_OBJECT('track', 'audio')),
('minimax', 'text_to_image', 'image-01', 'MiniMax Image 01', 10, 1, 1, JSON_OBJECT('track', 'image')),
('minimax', 'text_to_image', 'image-01-live', 'MiniMax Image 01 Live', 10, 0, 1, JSON_OBJECT('track', 'image')),
('minimax', 'image_to_image', 'image-01-i2i', 'MiniMax Image 01', 12, 1, 1, JSON_OBJECT('track', 'image_edit')),
('minimax', 'image_to_image', 'image-01-live-i2i', 'MiniMax Image 01 Live', 12, 0, 1, JSON_OBJECT('track', 'image_edit')),
('minimax', 'text_to_video', 'MiniMax-Hailuo-2.3', 'MiniMax Hailuo 2.3', 30, 0, 1, JSON_OBJECT('track', 'video')),
('minimax', 'text_to_video', 'MiniMax-Hailuo-02', 'MiniMax Hailuo 02', 30, 0, 1, JSON_OBJECT('track', 'video')),
('minimax', 'text_to_video', 'T2V-01-Director', 'T2V-01 Director', 30, 1, 1, JSON_OBJECT('track', 'video')),
('minimax', 'text_to_video', 'T2V-01', 'T2V-01', 30, 0, 1, JSON_OBJECT('track', 'video')),
('minimax', 'lyrics_generation', 'lyrics_generation', 'Lyrics Generation', 6, 1, 1, JSON_OBJECT('track', 'lyrics')),
('minimax', 'music_generation', 'music-2.5+', 'Music 2.5+', 20, 1, 1, JSON_OBJECT('track', 'music')),
('minimax', 'music_generation', 'music-2.5', 'Music 2.5', 20, 0, 1, JSON_OBJECT('track', 'music')),
('minimax', 'text_to_audio', 'speech-2.8-hd', 'Speech 2.8 HD', 8, 0, 1, JSON_OBJECT('track', 'audio')),
('minimax', 'text_to_audio', 'speech-2.8-turbo', 'Speech 2.8 Turbo', 8, 0, 1, JSON_OBJECT('track', 'audio')),
('minimax', 'text_to_audio', 'speech-2.6-hd', 'Speech 2.6 HD', 8, 0, 1, JSON_OBJECT('track', 'audio')),
('minimax', 'text_to_audio', 'speech-2.6-turbo', 'Speech 2.6 Turbo', 8, 0, 1, JSON_OBJECT('track', 'audio')),
('minimax', 'text_to_audio', 'speech-02-hd', 'Speech 02 HD', 8, 1, 1, JSON_OBJECT('track', 'audio')),
('minimax', 'text_to_audio', 'speech-02-turbo', 'Speech 02 Turbo', 8, 0, 1, JSON_OBJECT('track', 'audio')),
('minimax', 'text_to_audio', 'speech-01-hd', 'Speech 01 HD', 8, 0, 1, JSON_OBJECT('track', 'audio')),
('minimax', 'text_to_audio', 'speech-01-turbo', 'Speech 01 Turbo', 8, 0, 1, JSON_OBJECT('track', 'audio'))
ON DUPLICATE KEY UPDATE
  model_name = VALUES(model_name),
  unit_cost_points = VALUES(unit_cost_points),
  is_default = VALUES(is_default),
  is_active = VALUES(is_active),
  metadata_json = VALUES(metadata_json);
