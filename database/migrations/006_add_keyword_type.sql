-- 키워드 타입 필드 추가 (지역, 기관명, 인물명, 제품명 등)
ALTER TABLE monitoring_keywords 
ADD COLUMN IF NOT EXISTS keyword_type VARCHAR(50) CHECK (keyword_type IN ('region', 'organization', 'person', 'product', 'event', 'other'));

ALTER TABLE monitoring_keywords 
ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_keywords_type ON monitoring_keywords(keyword_type);

COMMENT ON COLUMN monitoring_keywords.keyword_type IS '키워드 타입: region(지역), organization(기관명), person(인물명), product(제품명), event(이벤트), other(기타)';

