-- 관리자 페이지 관련 스키마

-- API 키 관리 테이블
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    service VARCHAR(50) NOT NULL CHECK (service IN ('openai', 'google', 'azure', 'aws', 'other')),
    api_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP
);

CREATE INDEX idx_api_keys_service ON api_keys(service);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- 모니터링 키워드 테이블
CREATE TABLE monitoring_keywords (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(255) NOT NULL,
    platform VARCHAR(50),
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_keywords_keyword ON monitoring_keywords(keyword);
CREATE INDEX idx_keywords_platform ON monitoring_keywords(platform);
CREATE INDEX idx_keywords_active ON monitoring_keywords(is_active);

-- 모니터링 해시태그 테이블
CREATE TABLE monitoring_hashtags (
    id SERIAL PRIMARY KEY,
    hashtag VARCHAR(255) NOT NULL,
    platform VARCHAR(50),
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hashtags_hashtag ON monitoring_hashtags(hashtag);
CREATE INDEX idx_hashtags_platform ON monitoring_hashtags(platform);
CREATE INDEX idx_hashtags_active ON monitoring_hashtags(is_active);

-- 국가 테이블
CREATE TABLE countries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(10) UNIQUE,
    iso_code VARCHAR(3),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    map_image_url TEXT,
    map_data JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_countries_code ON countries(code);
CREATE INDEX idx_countries_active ON countries(is_active);

-- 지역 테이블에 국가 연결 추가
ALTER TABLE regions ADD COLUMN country_id INTEGER REFERENCES countries(id);
CREATE INDEX idx_regions_country ON regions(country_id);

-- 지도 데이터 테이블
CREATE TABLE map_data (
    id SERIAL PRIMARY KEY,
    country_id INTEGER REFERENCES countries(id),
    region_id INTEGER REFERENCES regions(id),
    map_type VARCHAR(50) NOT NULL CHECK (map_type IN ('country', 'province', 'city', 'district')),
    map_image_url TEXT,
    map_data JSONB,
    boundaries JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_map_data_country ON map_data(country_id);
CREATE INDEX idx_map_data_region ON map_data(region_id);
CREATE INDEX idx_map_data_type ON map_data(map_type);

-- 포스팅 위치 정보 강화
ALTER TABLE posts ADD COLUMN location_name VARCHAR(255);
ALTER TABLE posts ADD COLUMN location_coordinates POINT;
CREATE INDEX idx_posts_location_name ON posts(location_name);
CREATE INDEX idx_posts_location_coords ON posts USING GIST(location_coordinates);

-- 멘션 위치 정보 추가
ALTER TABLE mentions ADD COLUMN location_id INTEGER REFERENCES locations(id);
ALTER TABLE mentions ADD COLUMN location_name VARCHAR(255);
ALTER TABLE mentions ADD COLUMN location_coordinates POINT;
CREATE INDEX idx_mentions_location ON mentions(location_id);
CREATE INDEX idx_mentions_location_name ON mentions(location_name);
CREATE INDEX idx_mentions_location_coords ON mentions USING GIST(location_coordinates);

-- updated_at 트리거 추가
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_keywords_updated_at BEFORE UPDATE ON monitoring_keywords
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hashtags_updated_at BEFORE UPDATE ON monitoring_hashtags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_countries_updated_at BEFORE UPDATE ON countries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_map_data_updated_at BEFORE UPDATE ON map_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 초기 데이터: 인도네시아 국가 추가
INSERT INTO countries (name, code, iso_code, latitude, longitude) VALUES
('Indonesia', 'ID', 'IDN', -0.7893, 113.9213);

-- 기존 지역에 인도네시아 연결
UPDATE regions SET country_id = (SELECT id FROM countries WHERE code = 'ID') WHERE country_id IS NULL;

