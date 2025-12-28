-- 인도네시아 검찰청 SNS 분석 AI 포털 데이터베이스 스키마

-- 확장 기능 활성화
-- Azure PostgreSQL에서는 일부 확장이 허용되지 않음
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- Azure에서 허용되지 않음, gen_random_uuid() 사용
-- CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- Azure에서 허용되지 않음

-- 사용자 테이블
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'analyst')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- 인도네시아 행정구역 테이블
CREATE TABLE regions (
    id SERIAL PRIMARY KEY,
    province VARCHAR(100) NOT NULL,
    city VARCHAR(100),
    district VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_regions_province ON regions(province);
CREATE INDEX idx_regions_city ON regions(city);
CREATE INDEX idx_regions_location ON regions(latitude, longitude);

-- 위치 정보 테이블
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    province VARCHAR(100),
    city VARCHAR(100),
    district VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    address TEXT,
    region_id INTEGER REFERENCES regions(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_locations_province ON locations(province);
CREATE INDEX idx_locations_city ON locations(city);
CREATE INDEX idx_locations_region ON locations(region_id);
CREATE INDEX idx_locations_coords ON locations(latitude, longitude);

-- 모니터링 대상 계정 테이블
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'facebook', 'linkedin', 'whatsapp', 'tiktok')),
    is_official BOOLEAN DEFAULT FALSE,
    account_id VARCHAR(255),
    follower_count INTEGER DEFAULT 0,
    metadata JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accounts_platform ON accounts(platform);
CREATE INDEX idx_accounts_official ON accounts(is_official);
CREATE INDEX idx_accounts_username ON accounts(username);
CREATE INDEX idx_accounts_active ON accounts(is_active);

-- 포스팅 테이블
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    post_id VARCHAR(255) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    author_username VARCHAR(255),
    url TEXT,
    media_urls TEXT[],
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    hashtags TEXT[],
    mentions TEXT[],
    location_id INTEGER REFERENCES locations(id),
    posted_at TIMESTAMP,
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_posts_account ON posts(account_id);
CREATE INDEX idx_posts_platform ON posts(platform);
CREATE INDEX idx_posts_post_id ON posts(post_id);
CREATE INDEX idx_posts_posted_at ON posts(posted_at);
CREATE INDEX idx_posts_location ON posts(location_id);
CREATE INDEX idx_posts_hashtags ON posts USING GIN(hashtags);
CREATE INDEX idx_posts_content_search ON posts USING GIN(to_tsvector('english', content));

-- 멘션/댓글 테이블
CREATE TABLE mentions (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    mention_id VARCHAR(255),
    author_username VARCHAR(255),
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    parent_mention_id INTEGER REFERENCES mentions(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mentions_post ON mentions(post_id);
CREATE INDEX idx_mentions_author ON mentions(author_username);
CREATE INDEX idx_mentions_parent ON mentions(parent_mention_id);
CREATE INDEX idx_mentions_content_search ON mentions USING GIN(to_tsvector('english', content));

-- 감정 분석 결과 테이블
CREATE TABLE sentiment_analysis (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    mention_id INTEGER REFERENCES mentions(id) ON DELETE CASCADE,
    sentiment_category VARCHAR(50) NOT NULL CHECK (sentiment_category IN ('positive', 'negative', 'neutral', 'hot', 'angry', 'concerned')),
    confidence_score DECIMAL(5, 4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    analysis_details JSONB,
    model_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, mention_id)
);

CREATE INDEX idx_sentiment_post ON sentiment_analysis(post_id);
CREATE INDEX idx_sentiment_mention ON sentiment_analysis(mention_id);
CREATE INDEX idx_sentiment_category ON sentiment_analysis(sentiment_category);
CREATE INDEX idx_sentiment_confidence ON sentiment_analysis(confidence_score);
CREATE UNIQUE INDEX idx_sentiment_unique_post ON sentiment_analysis(post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX idx_sentiment_unique_mention ON sentiment_analysis(mention_id) WHERE mention_id IS NOT NULL;

-- 위험 분류 결과 테이블
CREATE TABLE risk_classification (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    mention_id INTEGER REFERENCES mentions(id) ON DELETE CASCADE,
    risk_category VARCHAR(50) NOT NULL CHECK (risk_category IN ('terrorism', 'crime', 'protest', 'accident', 'emergency', 'action_risk', 'incident', 'riot', 'reaction')),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    confidence_score DECIMAL(5, 4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    analysis_details JSONB,
    model_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, mention_id)
);

CREATE INDEX idx_risk_post ON risk_classification(post_id);
CREATE INDEX idx_risk_mention ON risk_classification(mention_id);
CREATE INDEX idx_risk_category ON risk_classification(risk_category);
CREATE INDEX idx_risk_level ON risk_classification(risk_level);
CREATE INDEX idx_risk_confidence ON risk_classification(confidence_score);
CREATE UNIQUE INDEX idx_risk_unique_post ON risk_classification(post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX idx_risk_unique_mention ON risk_classification(mention_id) WHERE mention_id IS NOT NULL;

-- 알림 테이블
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
    risk_id INTEGER REFERENCES risk_classification(id) ON DELETE SET NULL,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_resolved ON alerts(resolved);
CREATE INDEX idx_alerts_post ON alerts(post_id);
CREATE INDEX idx_alerts_risk ON alerts(risk_id);
CREATE INDEX idx_alerts_created ON alerts(created_at);

-- 집계 데이터 테이블 (성능 최적화)
CREATE TABLE analytics_summary (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    region_id INTEGER REFERENCES regions(id),
    platform VARCHAR(50),
    account_type VARCHAR(20) CHECK (account_type IN ('official', 'public')),
    sentiment_category VARCHAR(50),
    risk_category VARCHAR(50),
    risk_level VARCHAR(20),
    post_count INTEGER DEFAULT 0,
    mention_count INTEGER DEFAULT 0,
    total_engagement INTEGER DEFAULT 0,
    avg_confidence DECIMAL(5, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, region_id, platform, account_type, sentiment_category, risk_category, risk_level)
);

CREATE INDEX idx_analytics_date ON analytics_summary(date);
CREATE INDEX idx_analytics_region ON analytics_summary(region_id);
CREATE INDEX idx_analytics_platform ON analytics_summary(platform);
CREATE INDEX idx_analytics_sentiment ON analytics_summary(sentiment_category);
CREATE INDEX idx_analytics_risk ON analytics_summary(risk_category);

-- 수집 작업 로그 테이블
CREATE TABLE collection_jobs (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    account_id INTEGER REFERENCES accounts(id),
    job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('posts', 'mentions', 'reactions')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    items_collected INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jobs_platform ON collection_jobs(platform);
CREATE INDEX idx_jobs_status ON collection_jobs(status);
CREATE INDEX idx_jobs_account ON collection_jobs(account_id);
CREATE INDEX idx_jobs_created ON collection_jobs(created_at);

-- 트렌드 분석 테이블
CREATE TABLE trends (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(255) NOT NULL,
    platform VARCHAR(50),
    region_id INTEGER REFERENCES regions(id),
    mention_count INTEGER DEFAULT 0,
    sentiment_score DECIMAL(5, 4),
    risk_score DECIMAL(5, 4),
    trend_direction VARCHAR(20) CHECK (trend_direction IN ('up', 'down', 'stable')),
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trends_keyword ON trends(keyword);
CREATE INDEX idx_trends_platform ON trends(platform);
CREATE INDEX idx_trends_region ON trends(region_id);
CREATE INDEX idx_trends_period ON trends(period_start, period_end);

-- 영향력 있는 사용자 테이블
CREATE TABLE influential_users (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    follower_count INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5, 4),
    influence_score DECIMAL(5, 4),
    risk_mentions_count INTEGER DEFAULT 0,
    last_analyzed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_influential_account ON influential_users(account_id);
CREATE INDEX idx_influential_platform ON influential_users(platform);
CREATE INDEX idx_influential_score ON influential_users(influence_score);

-- 워크플로우 관리 테이블
CREATE TABLE workflows (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('risk_level', 'sentiment', 'keyword', 'region')),
    trigger_conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workflows_active ON workflows(is_active);
CREATE INDEX idx_workflows_trigger ON workflows(trigger_type);

-- 워크플로우 실행 로그 테이블
CREATE TABLE workflow_executions (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES workflows(id) ON DELETE CASCADE,
    trigger_post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
    trigger_risk_id INTEGER REFERENCES risk_classification(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    actions_executed JSONB,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_executions_status ON workflow_executions(status);
CREATE INDEX idx_executions_created ON workflow_executions(created_at);

-- 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_at 자동 업데이트 트리거 생성
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mentions_updated_at BEFORE UPDATE ON mentions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analytics_summary_updated_at BEFORE UPDATE ON analytics_summary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_influential_users_updated_at BEFORE UPDATE ON influential_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

