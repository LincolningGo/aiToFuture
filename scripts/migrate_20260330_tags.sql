USE aitofuture;

CREATE TABLE IF NOT EXISTS tags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(32) NOT NULL,
  color VARCHAR(16) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_tags_user_name (user_id, name),
  KEY idx_tags_user_created (user_id, created_at),
  CONSTRAINT fk_tags_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS job_tags (
  tag_id BIGINT UNSIGNED NOT NULL,
  job_uuid VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tag_id, job_uuid),
  KEY idx_job_tags_job (job_uuid),
  CONSTRAINT fk_job_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  CONSTRAINT fk_job_tags_job FOREIGN KEY (job_uuid) REFERENCES generation_jobs(job_uuid) ON DELETE CASCADE
) ENGINE=InnoDB;

