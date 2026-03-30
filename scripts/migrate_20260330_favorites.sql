USE aitofuture;

CREATE TABLE IF NOT EXISTS favorites (
  user_id BIGINT UNSIGNED NOT NULL,
  job_uuid VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, job_uuid),
  KEY idx_favorites_job (job_uuid),
  CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_favorites_job FOREIGN KEY (job_uuid) REFERENCES generation_jobs(job_uuid)
) ENGINE=InnoDB;

