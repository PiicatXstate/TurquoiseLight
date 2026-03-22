-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(128) NOT NULL,
  ip VARCHAR(45),
  created_at BIGINT NOT NULL
);

-- 文章表
CREATE TABLE IF NOT EXISTS articles (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  annotations TEXT,
  author_id VARCHAR(64) NOT NULL,
  author_name VARCHAR(50) NOT NULL,
  likes INT DEFAULT 0,
  downloads INT DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_author (author_id),
  INDEX idx_created (created_at DESC)
);

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  username VARCHAR(50) NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  INDEX idx_user (user_id)
);

-- 点赞记录表
CREATE TABLE IF NOT EXISTS likes (
  id VARCHAR(64) PRIMARY KEY,
  article_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE KEY uk_article_user (article_id, user_id),
  INDEX idx_article (article_id)
);

-- IP注册记录表
CREATE TABLE IF NOT EXISTS ip_registrations (
  ip VARCHAR(45) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  created_at BIGINT NOT NULL
);
