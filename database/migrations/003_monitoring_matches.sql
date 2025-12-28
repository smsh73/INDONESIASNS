-- 모니터링 매칭 결과 저장 테이블

CREATE TABLE IF NOT EXISTS monitoring_matches (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    mention_id INTEGER REFERENCES mentions(id) ON DELETE CASCADE,
    match_type VARCHAR(20) NOT NULL CHECK (match_type IN ('keyword', 'hashtag', 'both')),
    keyword_ids INTEGER[],
    hashtag_ids INTEGER[],
    priority_score INTEGER DEFAULT 0,
    matched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_monitoring_matches_post ON monitoring_matches(post_id);
CREATE INDEX idx_monitoring_matches_mention ON monitoring_matches(mention_id);
CREATE INDEX idx_monitoring_matches_type ON monitoring_matches(match_type);
CREATE INDEX idx_monitoring_matches_processed ON monitoring_matches(processed);
CREATE INDEX idx_monitoring_matches_priority ON monitoring_matches(priority_score DESC);

