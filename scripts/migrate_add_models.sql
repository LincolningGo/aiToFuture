USE aitofuture;

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

ALTER TABLE generation_jobs
  ADD COLUMN IF NOT EXISTS model_id BIGINT UNSIGNED NULL AFTER user_id,
  ADD COLUMN IF NOT EXISTS model_code VARCHAR(80) NULL AFTER provider,
  ADD COLUMN IF NOT EXISTS model_name VARCHAR(120) NULL AFTER model_code;

UPDATE generation_jobs
SET model_code = COALESCE(NULLIF(model_code, ''), 'unknown_model'),
    model_name = COALESCE(NULLIF(model_name, ''), 'Unknown Model')
WHERE model_code IS NULL OR model_code = '' OR model_name IS NULL OR model_name = '';

ALTER TABLE generation_jobs
  MODIFY COLUMN model_code VARCHAR(80) NOT NULL,
  MODIFY COLUMN model_name VARCHAR(120) NOT NULL;

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
