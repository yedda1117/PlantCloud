CREATE TABLE IF NOT EXISTS photo_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  plant_id BIGINT NOT NULL,
  plant_log_id BIGINT NULL,
  photo_date DATE NOT NULL,
  original_image_url VARCHAR(255) NOT NULL,
  processed_image_url VARCHAR(255) NULL,
  thumbnail_url VARCHAR(255) NULL,
  ai_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  ai_confidence DECIMAL(5,2) NULL,
  ai_result_json JSON NULL,
  remark VARCHAR(500) NULL,
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_plant_date (plant_id, photo_date)
);
