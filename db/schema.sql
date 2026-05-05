-- HawkVision MySQL 8 schema
-- Executed automatically by the mysql Docker image on first boot.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- -------------------------------------------------------------------------
-- users
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  email         VARCHAR(255)    NOT NULL,
  password_hash VARCHAR(255)    NOT NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------------------
-- sessions
-- One row per uploaded video / analysis job.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id         CHAR(36)                                    NOT NULL,
  user_id    INT UNSIGNED                                NOT NULL,
  video_url  VARCHAR(512)                                NOT NULL,
  fps        FLOAT                                       NOT NULL DEFAULT 30,
  status     ENUM('queued','processing','done','failed') NOT NULL DEFAULT 'queued',
  created_at DATETIME                                    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------------------
-- session_tracks
-- One row per session — the entire frame array stored as a JSON blob.
-- Using a separate table keeps sessions light for list queries.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_tracks (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id  CHAR(36)     NOT NULL,
  track_data  JSON         NOT NULL,
  computed_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tracks_session (session_id),
  CONSTRAINT fk_tracks_session FOREIGN KEY (session_id) REFERENCES sessions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Generated column for fast bounce-count queries without unpacking JSON
ALTER TABLE session_tracks
  ADD COLUMN bounce_count INT UNSIGNED AS (JSON_LENGTH(track_data, '$.bounces')) VIRTUAL;
